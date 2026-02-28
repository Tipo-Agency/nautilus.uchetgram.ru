"""Application configuration."""
from pydantic import model_validator
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings from environment. Production requires PostgreSQL (no SQLite)."""

    # Database — обязателен в production; SQLite запрещён
    DATABASE_URL: str = ""

    @model_validator(mode="after")
    def check_database_url(self) -> "Settings":
        if not self.DATABASE_URL or "sqlite" in self.DATABASE_URL.lower():
            raise ValueError(
                "DATABASE_URL must be set to a PostgreSQL URL (e.g. postgresql+asyncpg://user:pass@host:5432/db). "
                "SQLite is not allowed. Set DATABASE_URL in server/.env or environment."
            )
        return self

    # Auth
    SECRET_KEY: str = "change-me-in-production-use-openssl-rand-hex-32"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # CORS
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"

    # API prefix
    API_PREFIX: str = "/api"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()
