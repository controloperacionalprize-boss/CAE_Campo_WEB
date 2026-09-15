"""Acceso a la API: sin credencial, con clave móvil, con sesión web por rol.

No usa base de datos: se reemplaza la carga del usuario y las rutas probadas
fallan por permisos antes de consultar.
"""

import pytest
from fastapi.testclient import TestClient

from app import permisos
from app.config import get_settings
from app.main import app
from app.permisos import huella_password
from app.seguridad import crear_token

HASH = "scrypt$16384$8$1$c2FsdA$ZGlnZXN0"

USUARIOS = {
    1: {"id": 1, "dni": "11111111", "nombre": "ADMIN", "activo": True, "password_hash": HASH, "rol": "ADMINISTRADOR"},
    2: {"id": 2, "dni": "22222222", "nombre": "SUPER", "activo": True, "password_hash": HASH, "rol": "SUPERVISOR"},
    3: {"id": 3, "dni": "33333333", "nombre": "ACOPIO", "activo": True, "password_hash": HASH, "rol": "AUXILIAR DE ACOPIO"},
    4: {"id": 4, "dni": "44444444", "nombre": "OPERARIO", "activo": True, "password_hash": HASH, "rol": "OPERARIO"},
    5: {"id": 5, "dni": "55555555", "nombre": "BAJA", "activo": False, "password_hash": HASH, "rol": "ADMINISTRADOR"},
}


@pytest.fixture(autouse=True)
def usuarios_falsos(monkeypatch):
    monkeypatch.setattr(permisos, "cargar_usuario", lambda uid: USUARIOS.get(uid))


@pytest.fixture
def client():
    return TestClient(app)


def bearer(uid: int, pwh: str | None = None) -> dict:
    token, _ = crear_token(
        {"sub": uid, "pwh": pwh if pwh is not None else huella_password(HASH)},
        get_settings().secreto_tokens,
        300,
    )
    return {"Authorization": f"Bearer {token}"}


def test_sin_credencial_401(client):
    r = client.get("/api/v1/guias-ingreso")
    assert r.status_code == 401
    assert r.json()["detail"] == "Inicie sesión para continuar"


def test_api_key_incorrecta_401(client):
    assert client.get("/api/v1/guias-ingreso", headers={"X-API-Key": "no"}).status_code == 401


def test_token_basura_401(client):
    assert client.get("/api/v1/reportes/diario", headers={"Authorization": "Bearer abc.def"}).status_code == 401


def test_usuario_inactivo_401(client):
    assert client.get("/api/v1/reportes/diario", headers=bearer(5)).status_code == 401


def test_token_tras_cambio_de_contrasena_401(client):
    r = client.get("/api/v1/reportes/diario", headers=bearer(1, pwh="huella-vieja"))
    assert r.status_code == 401 and "contraseña cambió" in r.json()["detail"]


def test_operario_no_entra_a_la_web_403(client):
    assert client.get("/api/v1/auth/me", headers=bearer(4)).status_code == 403


@pytest.mark.parametrize(
    ("uid", "metodo", "ruta", "esperado"),
    [
        # Supervisor: ve reportes, no edita maestros ni operación
        (2, "post", "/api/v1/fundos", 403),
        (2, "patch", "/api/v1/guias-ingreso/1", 403),
        (2, "delete", "/api/v1/viajes/1", 403),
        # Auxiliar de acopio: no ve reportes ni edita
        (3, "get", "/api/v1/reportes/diario", 403),
        (3, "post", "/api/v1/usuarios", 403),
        (3, "post", "/api/v1/usuarios/1/restablecer-password", 403),
        # Solo el móvil usa login-movil
        (1, "post", "/api/v1/auth/login-movil", 403),
    ],
)
def test_permisos_por_rol(client, uid, metodo, ruta, esperado):
    kwargs = {"headers": bearer(uid)}
    if metodo in {"post", "patch"}:
        kwargs["json"] = {"dni": "12345678"} if "login-movil" in ruta else {}
    r = getattr(client, metodo)(ruta, **kwargs)
    assert r.status_code == esperado, r.text


def test_perfil_devuelve_permisos_del_rol(client):
    r = client.get("/api/v1/auth/me", headers=bearer(2))
    assert r.status_code == 200
    body = r.json()
    assert body["usuario"]["rol"] == "SUPERVISOR"
    assert "reportes.ver" in body["permisos"] and "maestros.editar" not in body["permisos"]


def test_login_valida_formato(client):
    assert client.post("/api/v1/auth/login", json={"dni": "1", "password": ""}).status_code == 422


def test_health_publico_y_request_id(client):
    r = client.get("/api/health")
    assert r.status_code == 200 and r.json() == {"ok": True}
    assert len(r.headers.get("X-Request-ID", "")) >= 8
