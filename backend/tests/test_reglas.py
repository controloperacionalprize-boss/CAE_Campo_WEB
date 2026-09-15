from datetime import datetime, timezone

import pytest

from app import tiempo
from app.config import Settings
from app.crud import _escape_like, _where_clause
from app.permisos import (
    MAESTROS_EDITAR,
    OPERACION_EDITAR,
    OPERACION_VER,
    PRINCIPAL_MOVIL,
    REPORTES_VER,
    WEB,
    huella_password,
    permisos_de_rol,
)
from app.realtime_pg import _dsn_directo


# ---------- Zona horaria (antes el día cambiaba a las 19:00 de Lima)


def test_hoy_usa_hora_de_lima(monkeypatch):
    # 15/09 23:30 UTC = 15/09 18:30 Lima; 16/09 01:00 UTC = 15/09 20:00 Lima.
    for utc, esperado in [
        (datetime(2026, 9, 15, 23, 30, tzinfo=timezone.utc), "2026-09-15"),
        (datetime(2026, 9, 16, 1, 0, tzinfo=timezone.utc), "2026-09-15"),
        (datetime(2026, 9, 16, 5, 30, tzinfo=timezone.utc), "2026-09-16"),
    ]:
        monkeypatch.setattr(tiempo, "ahora", lambda utc=utc: utc.astimezone(tiempo.ZONA))
        assert tiempo.hoy().isoformat() == esperado


# ---------- Permisos por rol


def test_matriz_de_roles():
    admin = permisos_de_rol("ADMINISTRADOR")
    assert {WEB, MAESTROS_EDITAR, OPERACION_EDITAR, REPORTES_VER} <= admin
    sup = permisos_de_rol("supervisor ")
    assert WEB in sup and REPORTES_VER in sup and MAESTROS_EDITAR not in sup and OPERACION_EDITAR not in sup
    acopio = permisos_de_rol("AUXILIAR DE ACOPIO")
    assert acopio == {WEB, OPERACION_VER}
    assert WEB not in permisos_de_rol("OPERARIO")
    assert permisos_de_rol(None) == frozenset()
    assert permisos_de_rol("ROL INVENTADO") == frozenset()


def test_movil_opera_pero_no_entra_a_la_web():
    assert PRINCIPAL_MOVIL.puede(OPERACION_EDITAR)
    assert not PRINCIPAL_MOVIL.puede(WEB)


def test_huella_cambia_con_la_contrasena():
    assert huella_password("scrypt$a") != huella_password("scrypt$b")


# ---------- Búsqueda (regresión: ESCAPE con dos barras rompía todas las búsquedas)


def test_busqueda_usa_escape_de_un_caracter():
    sql, params = _where_clause("guia_ingreso", {"estado": "registrado"}, "50%_a\\b")
    assert "ESCAPE '\\'" in sql and "ESCAPE '\\\\'" not in sql
    assert params[0] == "registrado"
    assert params[1] == "%50\\%\\_a\\\\b%"


def test_escape_like():
    assert _escape_like("a_b%c") == "a\\_b\\%c"


def test_filtro_con_columna_no_permitida_se_ignora():
    sql, params = _where_clause("usuario", {"password_hash": "x", "dni": "1"}, None)
    assert "password_hash" not in sql and params == ["1"]


# ---------- Configuración


def test_produccion_exige_secretos():
    s = Settings(database_url="postgresql://x", api_key="corta", auth_secret="", app_env="production")
    with pytest.raises(RuntimeError, match="AUTH_SECRET"):
        s.validar_produccion()


def test_produccion_rechaza_cors_comodin():
    s = Settings(
        database_url="postgresql://x",
        api_key="k" * 30,
        auth_secret="s" * 40,
        app_env="production",
        cors_origins="*",
    )
    with pytest.raises(ValueError):
        s.validar_produccion()


def test_dsn_directo_quita_pooler_de_neon():
    dsn = _dsn_directo("postgresql://u:p@ep-abc-123-pooler.c-5.us-east-2.aws.neon.tech/db?sslmode=require")
    assert "-pooler" not in dsn and "ep-abc-123.c-5.us-east-2.aws.neon.tech" in dsn
