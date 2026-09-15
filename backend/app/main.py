import asyncio
import logging
from contextlib import asynccontextmanager

import psycopg2
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

from .config import get_settings
from .crud import _raise_db
from .db import close_pool, get_conn
from .errors import format_validation, json_error, normalize_http_detail
from .middleware import RateLimitMiddleware, RequestLogMiddleware, SecurityHeadersMiddleware, configurar_logging
from .permisos import (
    MAESTROS_EDITAR,
    OPERACION_EDITAR,
    OPERACION_VER,
    REPORTES_VER,
    autenticado,
    por_metodo,
    requiere,
)
from .realtime import hub
from .realtime_pg import start_listener, stop_listener
from .routers.auth import router as auth_router
from .routers.eventos import instalar_cierre_sse, router as eventos_router
from .routers.guias import router as guias_router
from .routers.maestros import router as maestros_router
from .routers.reportes import router as reportes_router
from .routers.ubicaciones import router as ubicaciones_router
from .routers.viajes import router as viajes_router

logger = logging.getLogger("despacho")
settings = get_settings()
settings.validar_produccion()
configurar_logging(settings.log_level)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    hub.bind_loop(asyncio.get_running_loop())
    instalar_cierre_sse()
    start_listener()
    logger.info("API lista")
    yield
    stop_listener()
    hub.close()
    close_pool()


app = FastAPI(
    title="Despacho Campo API",
    version="0.1.0",
    description=(
        "API compartida para app móvil y web. La web usa `Authorization: Bearer` (POST /api/v1/auth/login); la app móvil, `X-API-Key`. "
        "Los errores responden `{ \"detail\": \"texto en español\" }`; "
        "en validación (422) se agrega `errors` con campo y mensaje."
    ),
    lifespan=lifespan,
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
    openapi_url="/openapi.json" if not settings.is_production else None,
    responses={
        401: {"description": "Sin sesión o credencial inválida", "content": {"application/json": {"example": {"detail": "Inicie sesión para continuar"}}}},
        403: {"description": "Sin permiso para la operación", "content": {"application/json": {"example": {"detail": "No tiene permiso para esta operación"}}}},
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
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware, max_per_minute=settings.rate_limit_per_minute)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.trusted_host_list())
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list(),
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-API-Key", "Accept", "X-Request-ID"],
    expose_headers=["X-Request-ID", "Retry-After"],
)
# Último en agregarse = primero en ejecutarse: el request-id cubre toda la cadena.
app.add_middleware(RequestLogMiddleware)

# Permisos por router. Lectura de catálogos: cualquier sesión válida; el resto según rol.
app.include_router(auth_router)
app.include_router(maestros_router, dependencies=[Depends(por_metodo(None, MAESTROS_EDITAR))])
app.include_router(ubicaciones_router, dependencies=[Depends(por_metodo(None, MAESTROS_EDITAR))])
app.include_router(guias_router, dependencies=[Depends(por_metodo(OPERACION_VER, OPERACION_EDITAR))])
app.include_router(viajes_router, dependencies=[Depends(por_metodo(OPERACION_VER, OPERACION_EDITAR))])
app.include_router(reportes_router, dependencies=[Depends(por_metodo(REPORTES_VER, REPORTES_VER))])
app.include_router(eventos_router, dependencies=[Depends(requiere(OPERACION_VER))])


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


@app.exception_handler(psycopg2.Error)
async def db_error_handler(_request: Request, exc: psycopg2.Error):
    """Errores de BD de consultas directas (fuera de insert_row/update_row) con mensaje en español."""
    try:
        _raise_db(exc)
    except HTTPException as mapped:
        return json_error(mapped.status_code, normalize_http_detail(mapped.status_code, mapped.detail))
    logger.exception("Error de base de datos no controlado")
    return json_error(500, "Error interno del servidor. Intente más tarde")


@app.exception_handler(Exception)
async def unhandled_handler(_request: Request, exc: Exception):
    logger.exception("Error no controlado")
    return json_error(500, "Error interno del servidor. Intente más tarde")


# HEAD además de GET: monitores externos (UptimeRobot) chequean con HEAD por defecto
# y un 405 los haría marcar la API como caída.
@app.api_route("/api/health", methods=["GET", "HEAD"])
def health():
    return {"ok": True}


@app.get("/api/ready")
def ready(_=Depends(autenticado)):
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
