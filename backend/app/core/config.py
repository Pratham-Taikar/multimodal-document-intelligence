from typing import List
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Application Info
    APP_ENV: str = Field(default="development", description="Environment: development, testing, production")
    APP_NAME: str = Field(default="Multimodal Document Intelligence API")
    APP_HOST: str = Field(default="0.0.0.0")
    APP_PORT: int = Field(default=8000)
    LOG_LEVEL: str = Field(default="INFO")

    # Security & CORS
    CORS_ORIGINS: str = Field(
        default="http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173",
        description="Comma-separated list of allowed CORS origins"
    )

    # PostgreSQL Database
    POSTGRES_USER: str = Field(default="mdi_user")
    POSTGRES_PASSWORD: str = Field(default="mdi_password_local_dev")
    POSTGRES_DB: str = Field(default="mdi_db")
    POSTGRES_HOST: str = Field(default="localhost")
    POSTGRES_PORT: int = Field(default=5433)

    # Full async database connection URL
    DATABASE_URL: str = Field(default="")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=True
    )

    @field_validator("DATABASE_URL", mode="before")
    def assemble_db_connection(cls, v: str, info) -> str:
        if isinstance(v, str) and v.strip():
            return v.strip()
        data = info.data
        user = data.get("POSTGRES_USER", "mdi_user")
        pwd = data.get("POSTGRES_PASSWORD", "mdi_password_local_dev")
        host = data.get("POSTGRES_HOST", "localhost")
        port = data.get("POSTGRES_PORT", 5433)
        db = data.get("POSTGRES_DB", "mdi_db")
        return f"postgresql+asyncpg://{user}:{pwd}@{host}:{port}/{db}"

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


settings = Settings()
