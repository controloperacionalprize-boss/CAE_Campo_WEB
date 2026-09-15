from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, field_validator

from ..config import get_settings
from ..db import get_conn
from ..permisos import (
    USUARIOS_ADMIN,
    WEB,
    Principal,
    huella_password,
    olvidar_usuario,
    permisos_de_rol,
    requiere,
    resolver_principal,
)
from ..seguridad import FrenoIntentos, crear_token, hash_password, verify_password

router = APIRouter(prefix="/api/v1", tags=["autenticación"])

_freno = FrenoIntentos(max_fallos=5, ventana_seg=600)
_CREDENCIALES_INVALIDAS = "DNI o contraseña incorrectos"
_HASH_REFERENCIA = hash_password("referencia-sin-usuario")


class LoginIn(BaseModel):
    dni: str = Field(min_length=8, max_length=15)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("dni", mode="before")
    @classmethod
    def limpiar_dni(cls, v: object) -> object:
        return v.strip() if isinstance(v, str) else v


class LoginMovilIn(BaseModel):
    dni: str = Field(min_length=8, max_length=15)

    @field_validator("dni", mode="before")
    @classmethod
    def limpiar_dni(cls, v: object) -> object:
        return v.strip() if isinstance(v, str) else v


class CambiarPasswordIn(BaseModel):
    actual: str = Field(min_length=1, max_length=128)
    nueva: str = Field(min_length=8, max_length=128)


class UsuarioSesion(BaseModel):
    id: int
    dni: str
    nombre: str
    rol: str | None


class SesionOut(BaseModel):
    token: str
    expira: int
    usuario: UsuarioSesion
    permisos: list[str]
    debe_cambiar_password: bool


class PerfilOut(BaseModel):
    usuario: UsuarioSesion
    permisos: list[str]


class UsuarioMovilOut(BaseModel):
    id: int
    dni: str
    nombre: str
    activo: bool
    rol_id: int | None
    rol: str | None
    grupo_id: int | None
    cargo_id: int | None
    area_id: int | None


def _buscar_por_dni(cur, dni: str) -> dict | None:
    cur.execute(
        """
        SELECT u.id, u.dni, u.nombre, u.activo, u.password_hash, u.rol_id, u.grupo_id,
               u.cargo_id, u.area_id, r.nombre AS rol
        FROM usuario u
        LEFT JOIN rol r ON r.id = u.rol_id
        WHERE u.dni = %s
        """,
        (dni,),
    )
    row = cur.fetchone()
    return dict(row) if row else None


def _sesion(usuario: dict, password_hash: str, debe_cambiar: bool) -> dict:
    settings = get_settings()
    permisos = sorted(permisos_de_rol(usuario.get("rol")))
    token, expira = crear_token(
        {"sub": usuario["id"], "dni": usuario["dni"], "pwh": huella_password(password_hash)},
        settings.secreto_tokens,
        settings.sesion_horas * 3600,
    )
    return {
        "token": token,
        "expira": expira,
        "usuario": {"id": usuario["id"], "dni": usuario["dni"], "nombre": usuario["nombre"], "rol": usuario.get("rol")},
        "permisos": permisos,
        "debe_cambiar_password": debe_cambiar,
    }


@router.post("/auth/login", response_model=SesionOut)
def login(payload: LoginIn, request: Request):
    """Login web con DNI y contraseña. Un usuario sin contraseña asignada entra con su DNI como contraseña."""
    ip = request.client.host if request.client else "desconocida"
    claves = (f"dni:{payload.dni}", f"ip:{ip}")
    if _freno.bloqueado(*claves):
        raise HTTPException(
            status_code=429,
            detail="Demasiados intentos fallidos. Espere 10 minutos e intente de nuevo",
            headers={"Retry-After": "600"},
        )

    with get_conn() as conn:
        cur = conn.cursor()
        usuario = _buscar_por_dni(cur, payload.dni)
        stored = (usuario or {}).get("password_hash") or ""
        if usuario and not stored:
            valida = payload.password == usuario["dni"]
            if valida:
                stored = hash_password(usuario["dni"])
                cur.execute(
                    "UPDATE usuario SET password_hash = %s WHERE id = %s AND (password_hash IS NULL OR password_hash = '')",
                    (stored, usuario["id"]),
                )
        elif usuario:
            valida = verify_password(payload.password, stored)
        else:
            # Mismo costo que un usuario real: no revela por tiempo si el DNI existe.
            verify_password(payload.password, _HASH_REFERENCIA)
            valida = False

        if not valida:
            _freno.fallo(*claves)
            raise HTTPException(status_code=401, detail=_CREDENCIALES_INVALIDAS)
        if not usuario.get("activo"):
            raise HTTPException(status_code=403, detail="Su usuario está inactivo. Contacte al administrador")
        if WEB not in permisos_de_rol(usuario.get("rol")):
            rol = usuario.get("rol") or "sin rol"
            raise HTTPException(
                status_code=403,
                detail=f"El rol {rol} no tiene acceso a la web. Use la app móvil",
            )

    _freno.exito(*claves)
    olvidar_usuario(usuario["id"])
    return _sesion(usuario, stored, debe_cambiar=payload.password == usuario["dni"])


@router.get("/auth/me", response_model=PerfilOut)
def perfil(principal: Principal = Depends(requiere(WEB))):
    return {
        "usuario": {
            "id": principal.usuario_id,
            "dni": principal.dni,
            "nombre": principal.nombre,
            "rol": principal.rol,
        },
        "permisos": sorted(principal.permisos),
    }


@router.post("/auth/cambiar-password", response_model=SesionOut)
def cambiar_password(payload: CambiarPasswordIn, principal: Principal = Depends(requiere(WEB))):
    if payload.nueva == principal.dni:
        raise HTTPException(status_code=400, detail="La nueva contraseña no puede ser su DNI")
    with get_conn() as conn:
        cur = conn.cursor()
        usuario = _buscar_por_dni(cur, principal.dni or "")
        if not usuario or not verify_password(payload.actual, usuario.get("password_hash")):
            raise HTTPException(status_code=400, detail="La contraseña actual no es correcta")
        nuevo = hash_password(payload.nueva)
        cur.execute("UPDATE usuario SET password_hash = %s WHERE id = %s", (nuevo, usuario["id"]))
    olvidar_usuario(usuario["id"])
    return _sesion(usuario, nuevo, debe_cambiar=False)


@router.post("/usuarios/{usuario_id}/restablecer-password", status_code=204)
def restablecer_password(usuario_id: int, _: Principal = Depends(requiere(USUARIOS_ADMIN))):
    """Deja la contraseña igual al DNI; el usuario deberá cambiarla al entrar."""
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT dni FROM usuario WHERE id = %s", (usuario_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="No se encontró el usuario")
        cur.execute(
            "UPDATE usuario SET password_hash = %s WHERE id = %s",
            (hash_password(row["dni"]), usuario_id),
        )
    olvidar_usuario(usuario_id)


@router.post("/auth/login-movil", response_model=UsuarioMovilOut)
def login_movil(payload: LoginMovilIn, request: Request):
    """App móvil (con X-API-Key): identifica al operador solo por DNI y devuelve su rol."""
    principal = resolver_principal(request)
    if principal.tipo != "movil":
        raise HTTPException(status_code=403, detail="Este acceso es solo para la app móvil")
    with get_conn(write=False) as conn:
        usuario = _buscar_por_dni(conn.cursor(), payload.dni)
    if not usuario:
        raise HTTPException(status_code=404, detail="DNI no registrado en el sistema")
    if not usuario.get("activo"):
        raise HTTPException(status_code=403, detail="Su usuario está inactivo. Contacte al administrador")
    return usuario
