import time

import pytest

from app.seguridad import FrenoIntentos, TokenInvalido, crear_token, hash_password, leer_token, verify_password

SECRETO = "secreto-de-prueba-0123456789-abcdefghij"


def test_password_correcta_e_incorrecta():
    h = hash_password("75809624")
    assert h.startswith("scrypt$")
    assert verify_password("75809624", h)
    assert not verify_password("otra", h)


def test_hash_con_sal_distinta_cada_vez():
    assert hash_password("x") != hash_password("x")


@pytest.mark.parametrize("almacenado", [None, "", "texto-plano", "bcrypt$algo", "scrypt$1$2$3"])
def test_hash_invalido_no_autentica(almacenado):
    assert not verify_password("cualquiera", almacenado)


def test_token_ida_y_vuelta():
    token, exp = crear_token({"sub": 7, "pwh": "abc"}, SECRETO, 60)
    claims = leer_token(token, SECRETO)
    assert claims["sub"] == 7 and claims["pwh"] == "abc" and claims["exp"] == exp


def test_token_con_otro_secreto_se_rechaza():
    token, _ = crear_token({"sub": 1}, SECRETO, 60)
    with pytest.raises(TokenInvalido):
        leer_token(token, "otro-secreto")


def test_token_alterado_se_rechaza():
    token, _ = crear_token({"sub": 1}, SECRETO, 60)
    payload, firma = token.split(".")
    alterado = payload[:-2] + ("AA" if payload[-2:] != "AA" else "BB") + "." + firma
    with pytest.raises(TokenInvalido):
        leer_token(alterado, SECRETO)


def test_token_vencido_se_rechaza(monkeypatch):
    token, _ = crear_token({"sub": 1}, SECRETO, 10)
    real = time.time
    monkeypatch.setattr(time, "time", lambda: real() + 3600)
    with pytest.raises(TokenInvalido, match="vencida"):
        leer_token(token, SECRETO)


def test_freno_bloquea_tras_fallos_y_libera_con_exito():
    freno = FrenoIntentos(max_fallos=3, ventana_seg=60)
    for _ in range(3):
        assert not freno.bloqueado("dni:1")
        freno.fallo("dni:1")
    assert freno.bloqueado("dni:1")
    assert not freno.bloqueado("dni:2")
    freno.exito("dni:1")
    assert not freno.bloqueado("dni:1")
