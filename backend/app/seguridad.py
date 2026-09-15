"""Contraseñas, tokens de sesión y freno a intentos de login.

Solo biblioteca estándar: scrypt para el hash y HMAC-SHA256 para firmar el
token, así no se agregan dependencias criptográficas al despliegue.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import threading
import time
from collections import defaultdict

_SCRYPT_N = 2**14
_SCRYPT_R = 8
_SCRYPT_P = 1
_SCRYPT_LEN = 32


def _b64e(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _b64d(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


# ---------- Contraseñas


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(
        password.encode("utf-8"), salt=salt, n=_SCRYPT_N, r=_SCRYPT_R, p=_SCRYPT_P, dklen=_SCRYPT_LEN
    )
    return f"scrypt${_SCRYPT_N}${_SCRYPT_R}${_SCRYPT_P}${_b64e(salt)}${_b64e(digest)}"


def verify_password(password: str, stored: str | None) -> bool:
    if not stored:
        return False
    try:
        algo, n, r, p, salt, digest = stored.split("$")
        if algo != "scrypt":
            return False
        expected = _b64d(digest)
        actual = hashlib.scrypt(
            password.encode("utf-8"),
            salt=_b64d(salt),
            n=int(n),
            r=int(r),
            p=int(p),
            dklen=len(expected),
        )
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(actual, expected)


# ---------- Tokens de sesión (formato: payload.firma, ambos base64url)


class TokenInvalido(Exception):
    pass


def crear_token(claims: dict, secret: str, ttl_seg: int) -> tuple[str, int]:
    now = int(time.time())
    exp = now + ttl_seg
    payload = _b64e(json.dumps({**claims, "iat": now, "exp": exp}, separators=(",", ":")).encode("utf-8"))
    firma = _b64e(hmac.new(secret.encode("utf-8"), payload.encode("ascii"), hashlib.sha256).digest())
    return f"{payload}.{firma}", exp


def leer_token(token: str, secret: str) -> dict:
    try:
        payload, firma = token.split(".")
    except ValueError:
        raise TokenInvalido("Formato de token inválido") from None
    esperada = _b64e(hmac.new(secret.encode("utf-8"), payload.encode("ascii"), hashlib.sha256).digest())
    if not hmac.compare_digest(firma, esperada):
        raise TokenInvalido("Firma inválida")
    try:
        claims = json.loads(_b64d(payload))
    except (ValueError, TypeError):
        raise TokenInvalido("Contenido ilegible") from None
    if int(claims.get("exp") or 0) < int(time.time()):
        raise TokenInvalido("Sesión vencida")
    return claims


# ---------- Freno a intentos fallidos de login (por DNI y por IP)


class FrenoIntentos:
    def __init__(self, max_fallos: int = 5, ventana_seg: int = 600) -> None:
        self.max_fallos = max_fallos
        self.ventana_seg = ventana_seg
        self._fallos: dict[str, list[float]] = defaultdict(list)
        self._lock = threading.Lock()

    def _vigentes(self, clave: str, ahora: float) -> list[float]:
        return [t for t in self._fallos.get(clave, ()) if t > ahora - self.ventana_seg]

    def bloqueado(self, *claves: str) -> bool:
        ahora = time.monotonic()
        with self._lock:
            return any(len(self._vigentes(c, ahora)) >= self.max_fallos for c in claves)

    def fallo(self, *claves: str) -> None:
        ahora = time.monotonic()
        with self._lock:
            for c in claves:
                self._fallos[c] = [*self._vigentes(c, ahora), ahora]
            if len(self._fallos) > 5000:
                for k in [k for k, v in self._fallos.items() if not self._vigentes(k, ahora)]:
                    self._fallos.pop(k, None)

    def exito(self, *claves: str) -> None:
        with self._lock:
            for c in claves:
                self._fallos.pop(c, None)
