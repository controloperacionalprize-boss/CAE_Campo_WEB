"""Puente Postgres -> SSE.

Los triggers de sql/eventos_notify.sql emiten pg_notify('despacho_eventos') en
cada cambio de guías/viajes/GRR, venga de donde venga (Render, otro worker, un
script). Este hilo escucha ese canal con una conexión dedicada y reenvía el
evento al hub en memoria, que lo empuja a las pestañas conectadas.

LISTEN no funciona a través del pooler de Neon (PgBouncer en modo transacción),
por eso esta conexión usa el host directo.
"""

from __future__ import annotations

import json
import logging
import select
import threading
from urllib.parse import urlparse, urlunparse

import psycopg2
import psycopg2.extensions

from .config import get_settings
from .crud import get_row
from .db import _harden_dsn, get_conn
from .guia_ingreso import serialize_guia
from .realtime import hub
from .viajes import get_viaje

logger = logging.getLogger("despacho")

CANAL = "despacho_eventos"
POLL_SEC = 5
BACKOFF_MAX_SEC = 30


def _dsn_directo(url: str) -> str:
    parsed = urlparse(url)
    host = parsed.hostname or ""
    if "-pooler" not in host:
        return _harden_dsn(url)
    netloc = parsed.netloc.replace(host, host.replace("-pooler", "", 1), 1)
    return _harden_dsn(urlunparse(parsed._replace(netloc=netloc)))


def _evento(t: str, tb: str, op: str, ref_id: int) -> dict | None:
    with get_conn(write=False) as conn:
        cur = conn.cursor()
        try:
            if t == "guia":
                guia = serialize_guia(get_row(cur, "guia_ingreso", "id", ref_id))
                tipo = "guia.created" if op == "INSERT" else "guia.updated"
                return {"type": tipo, "guia": guia}
            if t == "viaje":
                viaje = get_viaje(cur, ref_id)
                tipo = "viaje.created" if op == "INSERT" and tb == "viaje" else "viaje.updated"
                return {"type": tipo, "viaje": viaje}
        except Exception:
            # Fila borrada antes de leerla (p. ej. rollback posterior): no hay nada que avisar.
            logger.debug("Evento %s %s sin fila", t, ref_id)
    return None


class PgListener(threading.Thread):
    def __init__(self) -> None:
        super().__init__(name="pg-listener", daemon=True)
        self._halt = threading.Event()

    def stop(self) -> None:
        self._halt.set()

    def run(self) -> None:
        delay = 1.0
        while not self._halt.is_set():
            conn = None
            try:
                conn = psycopg2.connect(_dsn_directo(get_settings().database_url), connect_timeout=10)
                conn.set_isolation_level(psycopg2.extensions.ISOLATION_LEVEL_AUTOCOMMIT)
                cur = conn.cursor()
                cur.execute("SELECT 1 FROM pg_trigger WHERE tgname = 'despacho_notify_guia'")
                if cur.fetchone() is None:
                    # Sin triggers no llegarían avisos: se mantiene la publicación directa.
                    logger.warning("Tiempo real: faltan los triggers de sql/eventos_notify.sql")
                    return
                cur.execute(f"LISTEN {CANAL}")
                hub.external = True
                delay = 1.0
                logger.info("Tiempo real: escuchando Postgres (%s)", CANAL)
                while not self._halt.is_set():
                    if select.select([conn], [], [], POLL_SEC) == ([], [], []):
                        continue
                    conn.poll()
                    self._despachar(conn)
            except Exception:
                logger.warning("Tiempo real: se perdió la conexión LISTEN; reintentando", exc_info=True)
            finally:
                hub.external = False
                if conn is not None:
                    try:
                        conn.close()
                    except Exception:
                        pass
            self._halt.wait(delay)
            delay = min(delay * 2, BACKOFF_MAX_SEC)

    def _despachar(self, conn) -> None:
        # Una transacción puede tocar viaje + grr + guías: se agrupan por entidad
        # para que la web recargue una sola vez.
        pendientes: dict[tuple[str, int], tuple[str, str]] = {}
        while conn.notifies:
            n = conn.notifies.pop(0)
            try:
                data = json.loads(n.payload)
                key = (str(data["t"]), int(data["id"]))
            except (ValueError, KeyError, TypeError):
                continue
            tb, op = str(data.get("tb") or ""), str(data.get("op") or "UPDATE")
            previo = pendientes.get(key)
            if previo is None or (op == "INSERT" and tb in {"viaje", "guia_ingreso"}):
                pendientes[key] = (tb, op)
        for (t, ref_id), (tb, op) in pendientes.items():
            try:
                event = _evento(t, tb, op, ref_id)
            except Exception:
                logger.exception("Tiempo real: no se pudo leer %s %s", t, ref_id)
                continue
            if event:
                hub.publish(event)


_listener: PgListener | None = None


def start_listener() -> None:
    global _listener
    if _listener is None or not _listener.is_alive():
        _listener = PgListener()
        _listener.start()


def stop_listener() -> None:
    if _listener is not None:
        _listener.stop()
