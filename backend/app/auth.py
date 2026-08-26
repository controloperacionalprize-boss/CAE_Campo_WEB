import hashlib
import hmac
from typing import Annotated

from fastapi import Header, HTTPException, status

from .config import get_settings


def require_api_key(x_api_key: Annotated[str | None, Header()] = None) -> None:
    expected = get_settings().api_key
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="La API no está configurada. Falta la clave de acceso en el servidor",
        )
    provided = x_api_key or ""
    ok = hmac.compare_digest(
        hashlib.sha256(provided.encode("utf-8")).digest(),
        hashlib.sha256(expected.encode("utf-8")).digest(),
    )
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key inválida o ausente. Envíe el header X-API-Key",
            headers={"WWW-Authenticate": "ApiKey"},
        )
