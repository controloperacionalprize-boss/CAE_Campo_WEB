import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

from .auth import require_api_key
from .config import get_settings
from .db import close_pool, get_conn
from .errors import format_validation, json_error, normalize_http_detail
from .middleware import RateLimitMiddleware, RequestLogMiddleware, SecurityHeadersMiddleware
from .realtime import hub
from .routers.eventos import router as eventos_router
from .routers.guias import router as guias_router
from .routers.maestros import router as maestros_router
from .routers.ubicaciones import router as ubicaciones_router
from .routers.viajes import router as viajes_router

logger = logging.getLogger("despacho")
settings = get_settings()


def _configure_logging() -> None:
    log = logging.getLogger("despacho")
    log.setLevel(logging.INFO)
    log.propagate = True


@asynccontextmanager
async def lifespan(_app: FastAPI):
    _configure_logging()
    hub.bind_loop(asyncio.get_running_loop())
    logger.info("API lista")
    yield
    hub.close()
    close_pool()


app = FastAPI(
    title="Despacho Campo API",
    version="0.1.0",
    description=(
        "API compartida para app móvil y web. Requiere header X-API-Key. "
        "Los errores responden `{ \"detail\": \"texto en español\" }`; "
        "en validación (422) se agrega `errors` con campo y mensaje."
    ),
    lifespan=lifespan,
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
    openapi_url="/openapi.json" if not settings.is_production else None,
    responses={
        401: {"description": "Sin API key o clave inválida", "content": {"application/json": {"example": {"detail": "API key inválida o ausente. Envíe el header X-API-Key"}}}},
        404: {"description": "Recurso no encontrado", "content": {"application/json": {"example": {"detail": "No se encontró el fundo"}}}},
        409: {"description": "Dato duplicado o referencia inválida", "content": {"application/json": {"example": {"detail": "Ya existe un registro con ese DNI"}}}},
        422: {
            "description": "Datos inválidos",
            "content": {
                "application/json": {
                    "example": {
                        "detail": "El campo nombre es obligatorio.",
                        "errors": [{"campo": "nombre", "mensaje": "El campo nombre es obligatorio."}],
                    }
                }
            },
        },
    },
)
app.add_middleware(RequestLogMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware, max_per_minute=settings.rate_limit_per_minute)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.trusted_host_list())
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-API-Key", "Accept"],
)
app.include_router(maestros_router, dependencies=[Depends(require_api_key)])
app.include_router(ubicaciones_router, dependencies=[Depends(require_api_key)])
app.include_router(guias_router, dependencies=[Depends(require_api_key)])
app.include_router(viajes_router, dependencies=[Depends(require_api_key)])
app.include_router(eventos_router, dependencies=[Depends(require_api_key)])


@app.exception_handler(RequestValidationError)
async def validation_handler(_request: Request, exc: RequestValidationError):
    detail, errors = format_validation(exc.errors())
    return json_error(422, detail, errors=errors)


@app.exception_handler(StarletteHTTPException)
async def http_handler(_request: Request, exc: StarletteHTTPException):
    return json_error(
        exc.status_code,
        normalize_http_detail(exc.status_code, exc.detail),
        headers=getattr(exc, "headers", None) or {},
    )


@app.exception_handler(Exception)
async def unhandled_handler(_request: Request, exc: Exception):
    logger.exception("Error no controlado")
    return json_error(500, "Error interno del servidor. Intente más tarde")


@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/ready")
def ready(_: None = Depends(require_api_key)):
    try:
        with get_conn(write=False) as conn:
            conn.cursor().execute("SELECT 1")
        return {"ok": True, "db": "ok"}
    except Exception:
        logger.exception("Fallo de conectividad")
        raise HTTPException(
            status_code=503,
            detail="La base de datos no está disponible. Intente más tarde",
        )
