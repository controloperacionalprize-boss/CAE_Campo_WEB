import contextvars
import logging
import secrets
import time
from collections import defaultdict
from threading import Lock

from starlette.datastructures import Headers, MutableHeaders
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from .config import get_settings
from .seguridad import TokenInvalido, leer_token

logger = logging.getLogger("despacho")

_SIN_LIMITE = {"/api/health", "/api/v1/eventos"}
_SKIP_LOG = {"/api/health", "/api/v1/eventos"}
_MUTATIONS = {"POST", "PUT", "PATCH", "DELETE"}

request_id_var: contextvars.ContextVar[str] = contextvars.ContextVar("request_id", default="-")


class RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_var.get()
        return True


class SinHealthCheckFilter(logging.Filter):
    """Oculta del log de acceso de uvicorn /api/health y /api/v1/eventos.

    Render consulta el health check cada pocos segundos y cada pestaña reconecta
    el stream de eventos cada 5 minutos: taparían las líneas útiles. El resto de
    peticiones sigue registrándose.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        args = record.args
        if isinstance(args, tuple) and len(args) >= 3:
            ruta = str(args[2]).split("?", 1)[0]
            return ruta not in _SKIP_LOG
        return "/api/health" not in record.getMessage()


def configurar_logging(nivel: str) -> None:
    """Handler propio para el logger de la app: sin él, INFO no llega a la consola de Render."""
    acceso = logging.getLogger("uvicorn.access")
    if not any(isinstance(f, SinHealthCheckFilter) for f in acceso.filters):
        acceso.addFilter(SinHealthCheckFilter())
    log = logging.getLogger("despacho")
    log.setLevel(nivel.upper())
    if not any(getattr(h, "_despacho", False) for h in log.handlers):
        handler = logging.StreamHandler()
        handler.setFormatter(
            logging.Formatter("%(asctime)s %(levelname)s [%(request_id)s] %(name)s: %(message)s")
        )
        handler.addFilter(RequestIdFilter())
        handler._despacho = True  # type: ignore[attr-defined]
        log.addHandler(handler)
    log.propagate = False


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
                    headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
            await send(message)

        await self.app(scope, receive, send_with_headers)


def _clave_limite(scope: Scope) -> str:
    """Sesión web → por usuario. App móvil → por IP del dispositivo (requiere --proxy-headers)."""
    headers = Headers(scope=scope)
    auth = headers.get("authorization") or ""
    if auth.lower().startswith("bearer "):
        try:
            claims = leer_token(auth[7:].strip(), get_settings().secreto_tokens)
            return f"u:{claims.get('sub')}"
        except TokenInvalido:
            pass
    client = scope.get("client")
    return f"ip:{client[0] if client else 'desconocida'}"


class RateLimitMiddleware:
    def __init__(self, app: ASGIApp, max_per_minute: int = 240):
        self.app = app
        self.max_per_minute = max_per_minute
        self._hits: dict[str, list[float]] = defaultdict(list)
        self._lock = Lock()

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = scope.get("path") or ""
        if path in _SIN_LIMITE or scope.get("method") == "OPTIONS":
            await self.app(scope, receive, send)
            return

        key = _clave_limite(scope)
        now = time.monotonic()
        window = now - 60
        with self._lock:
            stamps = [t for t in self._hits.get(key, ()) if t > window]
            if len(stamps) >= self.max_per_minute:
                self._hits[key] = stamps
                response = JSONResponse(
                    {"detail": "Demasiadas solicitudes. Espere un momento e intente de nuevo"},
                    status_code=429,
                    headers={"Retry-After": "60"},
                )
                await response(scope, receive, send)
                return
            stamps.append(now)
            self._hits[key] = stamps
            if len(self._hits) > 4000:
                stale = [k for k, ts in self._hits.items() if not ts or ts[-1] <= window]
                for k in stale:
                    self._hits.pop(k, None)

        await self.app(scope, receive, send)


class RequestLogMiddleware:
    """Asigna X-Request-ID y registra mutaciones y errores. Sin body (PII)."""

    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        entrante = Headers(scope=scope).get("x-request-id") or ""
        rid = entrante[:64] if entrante.isascii() and entrante else secrets.token_hex(8)
        token = request_id_var.set(rid)

        path = scope.get("path") or ""
        method = scope.get("method") or ""
        started = time.perf_counter()
        status_code = 500

        async def send_logged(message: dict) -> None:
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = int(message.get("status") or 500)
                MutableHeaders(raw=message.setdefault("headers", []))["X-Request-ID"] = rid
            await send(message)

        try:
            await self.app(scope, receive, send_logged)
        finally:
            if path not in _SKIP_LOG and method != "OPTIONS":
                ms = (time.perf_counter() - started) * 1000
                if status_code >= 500:
                    logger.error("%s %s → %s (%.0f ms)", method, path, status_code, ms)
                elif status_code >= 400:
                    logger.warning("%s %s → %s (%.0f ms)", method, path, status_code, ms)
                elif method in _MUTATIONS:
                    logger.info("%s %s → %s (%.0f ms)", method, path, status_code, ms)
            request_id_var.reset(token)
