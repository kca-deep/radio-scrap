"""
Base scraper abstract class for auto-collection.
All scrapers must inherit from this class and implement the scrape method.
"""

import logging
from abc import ABC, abstractmethod
from datetime import datetime
from typing import List, Dict, Optional
from pydantic import BaseModel


logger = logging.getLogger(__name__)


class ArticlePreview(BaseModel):
    """Article preview data model"""
    title: str
    url: str
    published_date: Optional[str] = None
    last_updated: Optional[str] = None  # Ofcom articles have separate last_updated date
    source: str
    snippet: Optional[str] = None
    document_type: Optional[str] = None
    matched_keywords: List[str] = []
    is_duplicate: bool = False


class ScraperResult(BaseModel):
    """Scraper result containing articles and metadata"""
    articles: List[ArticlePreview]
    total_count: int
    source: str
    success: bool
    error: Optional[str] = None
    warnings: List[str] = []


class BaseScraper(ABC):
    """
    Abstract base class for all auto-scrapers.

    Each scraper must implement:
    - scrape(): Main scraping logic
    - get_source_name(): Return source identifier
    """

    def __init__(self):
        self.logger = logging.getLogger(self.__class__.__name__)

    @abstractmethod
    async def scrape(
        self,
        date_range: str = 'this-week',
        max_articles: int = 25,
        **kwargs
    ) -> ScraperResult:
        """
        Scrape articles from the source.

        Args:
            date_range: Date range filter (today, this-week, last-week)
            max_articles: Maximum number of articles to return
            **kwargs: Additional scraper-specific parameters

        Returns:
            ScraperResult with articles and metadata
        """
        pass

    @abstractmethod
    def get_source_name(self) -> str:
        """Return the source identifier (fcc, ofcom, soumu)"""
        pass

    def log_info(self, message: str):
        """Log info message"""
        self.logger.info(f"[{self.get_source_name().upper()}] {message}")

    def log_error(self, message: str):
        """Log error message"""
        self.logger.error(f"[{self.get_source_name().upper()}] {message}")

    def log_warning(self, message: str):
        """Log warning message"""
        self.logger.warning(f"[{self.get_source_name().upper()}] {message}")
