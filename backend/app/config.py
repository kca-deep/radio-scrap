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

    # OpenAI Settings
    OPENAI_MODEL: str = "gpt-4o"

    # Prompt File Paths (relative to backend directory)
    PROMPT_EXTRACT_FCC: str = "prompts/extract_fcc.txt"
    PROMPT_EXTRACT_SOUMU: str = "prompts/extract_soumu.txt"
    PROMPT_EXTRACT_OFCOM: str = "prompts/extract_ofcom.txt"
    PROMPT_EXTRACT_DEFAULT: str = "prompts/extract_default.txt"
    PROMPT_TRANSLATE: str = "prompts/translate.txt"

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./database.db"

    # Storage
    ATTACHMENT_DIR: str = "./storage/attachments"

    # Email (SMTP)
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str
    SMTP_PASSWORD: str

    # CORS - Load from environment variable (JSON array string)
    # Example: CORS_ORIGINS='["http://localhost:3000","http://localhost:3001"]'
    CORS_ORIGINS: List[str]

    # App
    DEBUG: bool = True
    DB_ECHO: bool = False  # SQL query logging (separate from DEBUG)

    # Auto-scraper settings
    FCC_URL: str = (
        "https://www.fcc.gov/news-events/headlines"
        "?year_released=all&tid%5B541%5D=541&items_per_page=25"
    )
    OFCOM_URL: str = (
        "https://www.ofcom.org.uk/consultations-and-statements"
        "?query=&SelectedTopic=67891&SelectedSubTopics=&ContentStatus="
        "&UpdatedAfter=&UpdatedBefore=&IncludePDF=true&SortBy=Newest&NumberOfResults=27"
    )
    SOUMU_URL: str = "https://www.soumu.go.jp/menu_news/s-news"
    # Soumu keywords - can be overridden in .env as JSON array
    SOUMU_DEFAULT_KEYWORDS: List[str] = [
        # Frequency terms
        "周波数", "kHz", "MHz", "GHz", "帯域",
        # Mobile generations
        "5世代", "6世代", "4世代", "3G", "4G",
        "LTE", "5G", "6G",
        # Wireless/communication
        "伝播", "広帯域", "移動通信", "モバイル", "無線",
        # Licensing
        "免許", "割当", "割当計画", "免許状", "周波数再編",
        # Testing/experiments
        "実証実験", "技術試験",
        # Satellite
        "衛星通信", "非静止衛星", "ゲートウェイ局", "衛星地球局",
        # Standards/regulations
        "技術基準", "告示改正", "省令改正", "ガイドライン",
        # International
        "WRC", "ITU-R",
        # Advanced tech
        "ローカル5G", "プライベート5G", "FWA", "ミリ波", "テラヘルツ",
        "AFC", "コグニティブ無線", "ダイナミック周波数共有",
    ]
    PLAYWRIGHT_HEADLESS: bool = True
    SCRAPER_TIMEOUT: int = 90

    # Weekly Scraping Settings
    WEEKLY_SCRAPE_SCHEDULE: str = ""
    SCRAPING_DAYS_AGO: int = 7
    SCRAPING_MAX_ARTICLES_PER_SITE: int = 2
    SCRAPING_TIMEOUT_SECONDS: int = 30
    SCRAPING_RATE_LIMIT_INTERVAL: int = 5

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True
    )

    @field_validator("CORS_ORIGINS", "SOUMU_DEFAULT_KEYWORDS", mode="before")
    @classmethod
    def parse_json_list(cls, v):
        """Parse JSON array string to list."""
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
