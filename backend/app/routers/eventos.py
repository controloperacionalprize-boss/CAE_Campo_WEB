import asyncio
import json

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from ..realtime import hub

router = APIRouter(prefix="/api/v1", tags=["eventos"])

KEEPALIVE_SEC = 20
STREAM_MAX_SEC = 45


@router.get("/eventos")
async def stream_eventos():
    """Canal SSE para la web. El móvil no lo usa: sigue creando guías por REST."""

    async def gen():
        queue = hub.subscribe()
        started = asyncio.get_running_loop().time()
        try:
            yield 'event: ready\ndata: {"ok":true}\n\n'
            while True:
                if asyncio.get_running_loop().time() - started >= STREAM_MAX_SEC:
                    break
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
