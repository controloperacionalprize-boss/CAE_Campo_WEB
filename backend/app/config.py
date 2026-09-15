import hashlib
import logging
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[2]

logger = logging.getLogger("despacho")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(ROOT / ".env", Path(__file__).resolve().parents[1] / ".env"),
        extra="ignore",
    )

    database_url: str
    # Credencial de la app móvil (header X-API-Key). Nunca debe ir en la web.
    api_key: str
    # Firma de los tokens de sesión web. Obligatorio en producción.
    auth_secret: str = ""
    sesion_horas: int = 12
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    trusted_hosts: str = "localhost,127.0.0.1"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    port: int | None = None
    app_env: str = "development"
    # Límite por sesión web o por IP del dispositivo móvil.
    rate_limit_per_minute: int = 240
    db_pool_max: int = 10
    log_level: str = "INFO"

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() in {"prod", "production"}

    @property
    def listen_port(self) -> int:
        return self.port if self.port is not None else self.api_port

    @property
    def secreto_tokens(self) -> str:
        if self.auth_secret:
            return self.auth_secret
        # Solo desarrollo: se deriva de la API key para no exigir otra variable local.
        return hashlib.sha256(f"dev-tokens:{self.api_key}".encode("utf-8")).hexdigest()

    def validar_produccion(self) -> None:
        if not self.is_production:
            return
        faltantes = []
        if len(self.auth_secret) < 32:
            faltantes.append("AUTH_SECRET (mínimo 32 caracteres)")
        if len(self.api_key) < 24:
            faltantes.append("API_KEY (mínimo 24 caracteres)")
        if faltantes:
            raise RuntimeError("Configuración de producción incompleta: " + ", ".join(faltantes))
        self.cors_origin_list()

    def cors_origin_list(self) -> list[str]:
        origins = [o.strip() for o in self.cors_origins.split(",") if o.strip()]
        if self.is_production and "*" in origins:
            raise ValueError("CORS no puede usar * en producción")
        return origins

    def trusted_host_list(self) -> list[str]:
        hosts = [h.strip() for h in self.trusted_hosts.split(",") if h.strip()]
        return hosts or ["localhost", "127.0.0.1"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
