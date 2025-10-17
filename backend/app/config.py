"""
Application configuration using Pydantic Settings.
Loads environment variables from .env file.
"""
from functools import lru_cache
from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.
    Uses pydantic-settings for automatic .env file parsing.
    """

    # API Keys
    FIRECRAWL_API_KEY: str
    OPENAI_API_KEY: str

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./database.db"

    # Storage
    ATTACHMENT_DIR: str = "./storage/attachments"

    # Email (SMTP)
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str
    SMTP_PASSWORD: str

    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:3000"]

    # App
    DEBUG: bool = True

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True
    )

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        """Parse CORS_ORIGINS from string or list."""
        if isinstance(v, str):
            import json
            return json.loads(v)
        return v


@lru_cache
def get_settings() -> Settings:
    """
    Create and cache Settings instance.
    Uses lru_cache to avoid repeated .env file reads.
    """
    return Settings()


# Export singleton instance
settings = get_settings()
