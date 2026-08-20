import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from .auth import require_api_key
from .config import get_settings
from .db import close_pool, get_conn
from .middleware import RateLimitMiddleware, SecurityHeadersMiddleware
from .routers.maestros import router as maestros_router
from .routers.ubicaciones import router as ubicaciones_router

logger = logging.getLogger("despacho")
settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    yield
    close_pool()


app = FastAPI(
    title="Despacho Campo API",
    version="0.1.0",
    description="API compartida para app móvil y web. Requiere header X-API-Key.",
    lifespan=lifespan,
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
    openapi_url="/openapi.json" if not settings.is_production else None,
)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware, max_per_minute=settings.rate_limit_per_minute)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.trusted_host_list())
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-API-Key"],
)
app.include_router(maestros_router, dependencies=[Depends(require_api_key)])
app.include_router(ubicaciones_router, dependencies=[Depends(require_api_key)])


@app.exception_handler(RequestValidationError)
async def validation_handler(_request: Request, exc: RequestValidationError):
    detail = [
        {"loc": list(err.get("loc", [])), "msg": err.get("msg"), "type": err.get("type")}
        for err in exc.errors()
    ]
    return JSONResponse(status_code=422, content={"detail": detail})


@app.exception_handler(StarletteHTTPException)
async def http_handler(_request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=getattr(exc, "headers", None) or {},
    )


@app.exception_handler(Exception)
async def unhandled_handler(_request: Request, exc: Exception):
    logger.exception("Error no controlado")
    return JSONResponse(status_code=500, content={"detail": "Error interno"})


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
        raise HTTPException(status_code=503, detail="Base de datos no disponible")
