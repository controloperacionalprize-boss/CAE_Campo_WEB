import time
from collections import defaultdict
from threading import Lock

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from .config import get_settings


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Cache-Control"] = "no-store"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        if get_settings().is_production:
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains"
            )
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, max_per_minute: int = 120):
        super().__init__(app)
        self.max_per_minute = max_per_minute
        self._hits: dict[str, list[float]] = defaultdict(list)
        self._lock = Lock()

    async def dispatch(self, request: Request, call_next) -> Response:
        ip = request.client.host if request.client else "unknown"
        now = time.monotonic()
        window = now - 60
        with self._lock:
            stamps = [t for t in self._hits[ip] if t > window]
            if len(stamps) >= self.max_per_minute:
                self._hits[ip] = stamps
                return JSONResponse(
                    {"detail": "Demasiadas solicitudes"},
                    status_code=429,
                    headers={"Retry-After": "60"},
                )
            stamps.append(now)
            self._hits[ip] = stamps
        return await call_next(request)
