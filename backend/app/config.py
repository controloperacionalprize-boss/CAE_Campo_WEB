from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(ROOT / ".env", Path(__file__).resolve().parents[1] / ".env"),
        extra="ignore",
    )

    database_url: str
    api_key: str
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    # En Railway: *.up.railway.app o * (Starlette acepta *)
    trusted_hosts: str = "localhost,127.0.0.1"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    # Railway inyecta PORT; si existe, manda sobre api_port
    port: int | None = None
    app_env: str = "development"
    rate_limit_per_minute: int = 120

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() in {"prod", "production"}

    @property
    def listen_port(self) -> int:
        return self.port if self.port is not None else self.api_port

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
