import time
from collections import defaultdict
from threading import Lock

from starlette.datastructures import MutableHeaders
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from .config import get_settings


class SecurityHeadersMiddleware:
    """ASGI puro para no bufferizar SSE (BaseHTTPMiddleware sí lo hace)."""

    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_with_headers(message: dict) -> None:
            if message["type"] == "http.response.start":
                headers = MutableHeaders(raw=message.setdefault("headers", []))
                headers["X-Content-Type-Options"] = "nosniff"
                headers["X-Frame-Options"] = "DENY"
                headers["Referrer-Policy"] = "no-referrer"
                headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
                content_type = headers.get("content-type", "")
                if "text/event-stream" not in content_type:
                    headers["Cache-Control"] = "no-store"
                if get_settings().is_production:
                    headers["Strict-Transport-Security"] = (
                        "max-age=31536000; includeSubDomains"
                    )
            await send(message)

        await self.app(scope, receive, send_with_headers)


class RateLimitMiddleware:
    def __init__(self, app: ASGIApp, max_per_minute: int = 120):
        self.app = app
        self.max_per_minute = max_per_minute
        self._hits: dict[str, list[float]] = defaultdict(list)
        self._lock = Lock()

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = scope.get("path") or ""
        if path in {"/api/health", "/api/v1/eventos"}:
            await self.app(scope, receive, send)
            return

        client = scope.get("client")
        ip = client[0] if client else "unknown"
        now = time.monotonic()
        window = now - 60
        with self._lock:
            stamps = [t for t in self._hits[ip] if t > window]
            if len(stamps) >= self.max_per_minute:
                self._hits[ip] = stamps
                response = JSONResponse(
                    {
                        "detail": "Demasiadas solicitudes. Espere un momento e intente de nuevo",
                    },
                    status_code=429,
                    headers={"Retry-After": "60"},
                )
                await response(scope, receive, send)
                return
            stamps.append(now)
            self._hits[ip] = stamps

        await self.app(scope, receive, send)
