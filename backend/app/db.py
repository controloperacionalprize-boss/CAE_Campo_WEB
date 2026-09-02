from contextlib import contextmanager
from threading import Lock
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

import psycopg2
import psycopg2.extras
from psycopg2.pool import SimpleConnectionPool

from .config import get_settings

_pool: SimpleConnectionPool | None = None
_pool_lock = Lock()


def _harden_dsn(url: str) -> str:
    parsed = urlparse(url)
    query = dict(parse_qsl(parsed.query, keep_blank_values=True))
    query.pop("channel_binding", None)
    if query.get("sslmode") not in {"require", "verify-ca", "verify-full"}:
        query["sslmode"] = "require"
    return urlunparse(parsed._replace(query=urlencode(query)))


def _make_pool(url: str) -> SimpleConnectionPool:
    return SimpleConnectionPool(
        1,
        8,
        dsn=_harden_dsn(url),
        cursor_factory=psycopg2.extras.RealDictCursor,
        connect_timeout=10,
    )


def get_pool() -> SimpleConnectionPool:
    global _pool
    if _pool is None:
        with _pool_lock:
            if _pool is None:
                _pool = _make_pool(get_settings().database_url)
    return _pool


def close_pool() -> None:
    global _pool
    with _pool_lock:
        if _pool is not None:
            _pool.closeall()
            _pool = None


def _conn_is_alive(conn) -> bool:
    try:
        conn.cursor().execute("SELECT 1")
        conn.rollback()
        return True
    except Exception:
        return False


@contextmanager
def get_conn(*, write: bool = True):
    pool = get_pool()
    conn = pool.getconn()
    if conn.closed or not _conn_is_alive(conn):
        pool.putconn(conn, close=True)
        conn = pool.getconn()
    closed = False
    try:
        yield conn
        if write:
            conn.commit()
        else:
            conn.rollback()
    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass
        pool.putconn(conn, close=True)
        closed = True
        raise
    finally:
        if not closed:
            pool.putconn(conn)
