"""Hub en proceso para empujar cambios de guías a la web (SSE).

Un worker de uvicorn (como en Render) es suficiente: el móvil sigue por REST
y, tras el commit, se notifica a las pestañas conectadas.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

logger = logging.getLogger("despacho")


class EventHub:
    def __init__(self) -> None:
        self._subs: set[asyncio.Queue[dict[str, Any]]] = set()
        self._loop: asyncio.AbstractEventLoop | None = None

    def bind_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    def subscribe(self) -> asyncio.Queue[dict[str, Any]]:
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=64)
        self._subs.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue[dict[str, Any]]) -> None:
        self._subs.discard(queue)

    def close(self) -> None:
        def _close() -> None:
            for queue in list(self._subs):
                try:
                    queue.put_nowait({"type": "shutdown"})
                except Exception:
                    pass
                self._subs.discard(queue)

        loop = self._loop
        if loop is not None and loop.is_running():
            loop.call_soon_threadsafe(_close)
        else:
            _close()

    def publish(self, event: dict[str, Any]) -> None:
        loop = self._loop
        if loop is None or not loop.is_running():
            return

        def _put() -> None:
            for queue in list(self._subs):
                try:
                    queue.put_nowait(event)
                except asyncio.QueueFull:
                    self._subs.discard(queue)

        loop.call_soon_threadsafe(_put)


hub = EventHub()


def publish_guia(event_type: str, guia: dict[str, Any]) -> None:
    try:
        hub.publish({"type": event_type, "guia": guia})
    except Exception:
        logger.exception("No se pudo publicar el evento en vivo")
