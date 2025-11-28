"""
Auto-scraper services for collecting articles from government websites.

Supported sources:
- FCC (USA): Wireless Telecommunications news
- Ofcom (UK): Spectrum consultations and statements
- Soumu (Japan): Ministry news with keyword filtering
"""

from .base_scraper import BaseScraper, ScraperResult
from .fcc_scraper import FCCScraper
from .ofcom_scraper import OfcomScraper
from .soumu_scraper import SoumuScraper
from .factory import get_scraper, scrape_all_sources

__all__ = [
    'BaseScraper',
    'ScraperResult',
    'FCCScraper',
    'OfcomScraper',
    'SoumuScraper',
    'get_scraper',
    'scrape_all_sources',
]
