"""Pool de conexiones a Postgres (Neon).

- ThreadedConnectionPool: FastAPI atiende rutas síncronas en varios hilos.
- Semáforo: si el pool está lleno, la petición espera un turno (hasta
  POOL_ESPERA_SEG) en vez de fallar al instante.
- Conexiones inactivas se verifican antes de usarlas: Neon cierra las
  conexiones al suspender el cómputo y la primera consulta fallaría.
"""

from __future__ import annotations

import logging
import threading
import time
from contextlib import contextmanager
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

import psycopg2
import psycopg2.extras
from fastapi import HTTPException
from psycopg2.pool import ThreadedConnectionPool

from .config import get_settings

logger = logging.getLogger("despacho")

POOL_ESPERA_SEG = 10
VERIFICAR_TRAS_SEG = 30

_pool: ThreadedConnectionPool | None = None
_cupos: threading.BoundedSemaphore | None = None
_ultimo_uso: dict[int, float] = {}
_pool_lock = threading.Lock()


def _harden_dsn(url: str) -> str:
    parsed = urlparse(url)
    query = dict(parse_qsl(parsed.query, keep_blank_values=True))
    query.pop("channel_binding", None)
    if query.get("sslmode") not in {"require", "verify-ca", "verify-full"}:
        query["sslmode"] = "require"
    query.setdefault("keepalives", "1")
    query.setdefault("keepalives_idle", "30")
    query.setdefault("keepalives_interval", "10")
    query.setdefault("keepalives_count", "3")
    query.setdefault("application_name", "despacho-campo")
    return urlunparse(parsed._replace(query=urlencode(query)))


def _get_pool() -> tuple[ThreadedConnectionPool, threading.BoundedSemaphore]:
    global _pool, _cupos
    if _pool is None:
        with _pool_lock:
            if _pool is None:
                settings = get_settings()
                maximo = max(2, settings.db_pool_max)
                _pool = ThreadedConnectionPool(
                    1,
                    maximo,
                    dsn=_harden_dsn(settings.database_url),
                    cursor_factory=psycopg2.extras.RealDictCursor,
                    connect_timeout=10,
                )
                _cupos = threading.BoundedSemaphore(maximo)
    assert _pool is not None and _cupos is not None
    return _pool, _cupos


def close_pool() -> None:
    global _pool, _cupos
    with _pool_lock:
        if _pool is not None:
            _pool.closeall()
        _pool = None
        _cupos = None
        _ultimo_uso.clear()


def _conexion_viva(conn) -> bool:
    if conn.closed:
        return False
    if time.monotonic() - _ultimo_uso.get(id(conn), 0) < VERIFICAR_TRAS_SEG:
        return True
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
        conn.rollback()
        return True
    except psycopg2.Error:
        return False


def _checkout(pool: ThreadedConnectionPool):
    for _ in range(3):
        conn = pool.getconn()
        if _conexion_viva(conn):
            return conn
        logger.info("Conexión a la BD cerrada por el servidor; se abre otra")
        _ultimo_uso.pop(id(conn), None)
        pool.putconn(conn, close=True)
    return pool.getconn()


@contextmanager
def get_conn(*, write: bool = True):
    pool, cupos = _get_pool()
    if not cupos.acquire(timeout=POOL_ESPERA_SEG):
        raise HTTPException(status_code=503, detail="El servidor está ocupado. Intente de nuevo en unos segundos")
    conn = None
    descartar = False
    try:
        conn = _checkout(pool)
        yield conn
        if write:
            conn.commit()
        else:
            conn.rollback()
    except Exception as exc:
        if conn is not None:
            try:
                conn.rollback()
            except Exception:
                descartar = True
            if isinstance(exc, (psycopg2.OperationalError, psycopg2.InterfaceError)):
                descartar = True
        raise
    finally:
        if conn is not None:
            if conn.closed:
                descartar = True
            _ultimo_uso[id(conn)] = time.monotonic()
            if descartar:
                _ultimo_uso.pop(id(conn), None)
            pool.putconn(conn, close=descartar)
        cupos.release()
