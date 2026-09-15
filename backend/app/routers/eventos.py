import asyncio
import json
import signal
import threading
import time

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from ..realtime import hub

router = APIRouter(prefix="/api/v1", tags=["eventos"])

KEEPALIVE_SEC = 15
# Tope de vida por conexión: el cliente reconecta solo y recarga lo perdido.
MAX_CONEXION_SEC = 300


def instalar_cierre_sse() -> None:
    """uvicorn espera a que cierren las conexiones antes de correr el shutdown
    del lifespan; un SSE nunca cierra solo, así que el reinicio (--reload o un
    deploy) quedaba colgado. Se envuelven los manejadores de señal que uvicorn
    ya instaló para cerrar los streams apenas llega la señal.
    Debe llamarse desde el hilo principal (lifespan de uvicorn)."""
    if threading.current_thread() is not threading.main_thread():
        return
    for nombre in ("SIGINT", "SIGTERM", "SIGBREAK"):
        sig = getattr(signal, nombre, None)
        if sig is None:
            continue
        previo = signal.getsignal(sig)
        if getattr(previo, "_cierra_sse", False) or not callable(previo):
            continue

        def manejador(s, frame, _previo=previo):
            hub.close()
            _previo(s, frame)

        manejador._cierra_sse = True  # type: ignore[attr-defined]
        signal.signal(sig, manejador)


@router.get("/eventos")
async def stream_eventos():
    """Canal SSE para la web. El móvil no lo usa: sigue creando guías por REST."""

    async def gen():
        queue = hub.subscribe()
        fin = time.monotonic() + MAX_CONEXION_SEC
        try:
            yield 'event: ready\ndata: {"ok":true}\n\n'
            while time.monotonic() < fin:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=KEEPALIVE_SEC)
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
                    continue
                if event.get("type") == "shutdown":
                    break
                name = str(event.get("type") or "message")
                payload = json.dumps(event, ensure_ascii=False, default=str)
                yield f"event: {name}\ndata: {payload}\n\n"
        finally:
            hub.unsubscribe(queue)

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
