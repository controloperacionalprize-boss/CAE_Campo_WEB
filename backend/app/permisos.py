"""Autenticación y permisos por rol.

Dos tipos de cliente:
- Web: inicia sesión con DNI + contraseña y envía `Authorization: Bearer <token>`.
  Lo que puede hacer depende de su rol (PERMISOS_POR_ROL).
- App móvil: envía `X-API-Key` (credencial del dispositivo, nunca va en la web).
  Tiene acceso operativo completo; las vistas por rol las resuelve la propia app.

Para cambiar qué ve o hace cada rol en la web, editar solo PERMISOS_POR_ROL.
"""

from __future__ import annotations

import hashlib
import hmac
import threading
import time
from dataclasses import dataclass, field

from fastapi import HTTPException, Request, status

from .config import get_settings
from .db import get_conn
from .seguridad import TokenInvalido, leer_token

# Permisos
WEB = "web"  # puede iniciar sesión en la web
OPERACION_VER = "operacion.ver"  # Inicio, Despacho, Viajes, Recepción, eventos en vivo
OPERACION_EDITAR = "operacion.editar"  # altas/cambios de guías, viajes, croquis, GRR, recepción
REPORTES_VER = "reportes.ver"
MAESTROS_VER = "maestros.ver"  # pantallas de Fundos, Personas y Flota
MAESTROS_EDITAR = "maestros.editar"  # crear, editar y desactivar catálogos
USUARIOS_ADMIN = "usuarios.admin"  # restablecer contraseñas

TODOS = frozenset(
    {WEB, OPERACION_VER, OPERACION_EDITAR, REPORTES_VER, MAESTROS_VER, MAESTROS_EDITAR, USUARIOS_ADMIN}
)

PERMISOS_POR_ROL: dict[str, frozenset[str]] = {
    "ADMINISTRADOR": TODOS,
    "SUPERVISOR": frozenset({WEB, OPERACION_VER, REPORTES_VER, MAESTROS_VER}),
    "AUXILIAR DE ACOPIO": frozenset({WEB, OPERACION_VER}),
    # Operario de campo: trabaja solo desde la app móvil.
    "OPERARIO": frozenset(),
}


def permisos_de_rol(nombre_rol: str | None) -> frozenset[str]:
    return PERMISOS_POR_ROL.get((nombre_rol or "").strip().upper(), frozenset())


@dataclass(frozen=True)
class Principal:
    tipo: str  # "usuario" | "movil"
    permisos: frozenset[str] = field(default_factory=frozenset)
    usuario_id: int | None = None
    dni: str | None = None
    nombre: str | None = None
    rol: str | None = None

    def puede(self, permiso: str) -> bool:
        return permiso in self.permisos


PRINCIPAL_MOVIL = Principal(tipo="movil", permisos=TODOS - {WEB})


def huella_password(password_hash: str | None) -> str:
    """Cambia cuando cambia la contraseña: invalida los tokens anteriores."""
    return hashlib.sha256((password_hash or "").encode("utf-8")).hexdigest()[:12]


# ---------- Usuario vigente (cache corto para no consultar la BD en cada petición)

_CACHE_SEG = 60
_cache: dict[int, tuple[float, dict | None]] = {}
_cache_lock = threading.Lock()


def cargar_usuario(usuario_id: int) -> dict | None:
    ahora = time.monotonic()
    with _cache_lock:
        hit = _cache.get(usuario_id)
        if hit and hit[0] > ahora:
            return hit[1]
    with get_conn(write=False) as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT u.id, u.dni, u.nombre, u.activo, u.password_hash, r.nombre AS rol
            FROM usuario u
            LEFT JOIN rol r ON r.id = u.rol_id
            WHERE u.id = %s
            """,
            (usuario_id,),
        )
        row = cur.fetchone()
    data = dict(row) if row else None
    with _cache_lock:
        _cache[usuario_id] = (ahora + _CACHE_SEG, data)
    return data


def olvidar_usuario(usuario_id: int) -> None:
    with _cache_lock:
        _cache.pop(usuario_id, None)


def _api_key_valida(provista: str | None) -> bool:
    esperada = get_settings().api_key
    if not esperada or not provista:
        return False
    return hmac.compare_digest(
        hashlib.sha256(provista.encode("utf-8")).digest(),
        hashlib.sha256(esperada.encode("utf-8")).digest(),
    )


def _no_autorizado(detalle: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detalle,
        headers={"WWW-Authenticate": "Bearer"},
    )


def resolver_principal(request: Request) -> Principal:
    cached = getattr(request.state, "principal", None)
    if cached is not None:
        return cached

    auth = request.headers.get("authorization") or ""
    if auth.lower().startswith("bearer "):
        try:
            claims = leer_token(auth[7:].strip(), get_settings().secreto_tokens)
        except TokenInvalido as exc:
            raise _no_autorizado(
                "Su sesión venció. Inicie sesión nuevamente" if "vencida" in str(exc) else "Sesión inválida. Inicie sesión nuevamente"
            ) from None
        usuario = cargar_usuario(int(claims.get("sub") or 0))
        if not usuario or not usuario.get("activo"):
            raise _no_autorizado("El usuario ya no está activo")
        if claims.get("pwh") != huella_password(usuario.get("password_hash")):
            raise _no_autorizado("La contraseña cambió. Inicie sesión nuevamente")
        permisos = permisos_de_rol(usuario.get("rol"))
        if WEB not in permisos:
            raise HTTPException(status_code=403, detail="Su rol no tiene acceso a la web")
        principal = Principal(
            tipo="usuario",
            permisos=permisos,
            usuario_id=usuario["id"],
            dni=usuario["dni"],
            nombre=usuario["nombre"],
            rol=usuario.get("rol"),
        )
    elif _api_key_valida(request.headers.get("x-api-key")):
        principal = PRINCIPAL_MOVIL
    else:
        if not get_settings().api_key:
            raise HTTPException(status_code=503, detail="La API no está configurada. Falta la clave de acceso en el servidor")
        raise _no_autorizado("Inicie sesión para continuar")

    request.state.principal = principal
    return principal


def autenticado(request: Request) -> Principal:
    return resolver_principal(request)


def requiere(*permisos: str):
    def dependencia(request: Request) -> Principal:
        principal = resolver_principal(request)
        faltan = [p for p in permisos if not principal.puede(p)]
        if faltan:
            raise HTTPException(status_code=403, detail="No tiene permiso para esta operación")
        return principal

    return dependencia


_LECTURA = {"GET", "HEAD", "OPTIONS"}


def por_metodo(lectura: str | None, escritura: str):
    """Permiso según el verbo HTTP: `lectura` para GET (None = cualquier sesión válida)."""

    def dependencia(request: Request) -> Principal:
        principal = resolver_principal(request)
        necesario = lectura if request.method in _LECTURA else escritura
        if necesario and not principal.puede(necesario):
            raise HTTPException(status_code=403, detail="No tiene permiso para esta operación")
        return principal

    return dependencia
