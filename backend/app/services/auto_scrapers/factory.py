"""
Factory for creating scraper instances and orchestrating multiple scrapers.
"""

import asyncio
from typing import List, Dict, Optional

from .base_scraper import BaseScraper, ScraperResult
from .fcc_scraper import FCCScraper
from .ofcom_scraper import OfcomScraper
from .soumu_scraper import SoumuScraper


def get_scraper(source: str) -> Optional[BaseScraper]:
    """
    Get scraper instance by source name.

    Args:
        source: Source identifier (fcc, ofcom, soumu)

    Returns:
        Scraper instance or None if source not found
    """
    scrapers = {
        'fcc': FCCScraper,
        'ofcom': OfcomScraper,
        'soumu': SoumuScraper,
    }

    scraper_class = scrapers.get(source.lower())
    if scraper_class:
        return scraper_class()
    return None


async def scrape_all_sources(
    sources: List[str],
    date_range: str = 'this-week',
    max_articles: int = 25,
) -> Dict[str, ScraperResult]:
    """
    Scrape multiple sources in parallel.

    Args:
        sources: List of source identifiers (fcc, ofcom, soumu)
        date_range: Date filter (today, this-week, last-week, or YYYY-MM)
        max_articles: Maximum articles per source

    Returns:
        Dictionary mapping source name to ScraperResult
    """
    tasks = []
    source_names = []

    for source in sources:
        scraper = get_scraper(source)
        if not scraper:
            continue

        # Create scraping task
        task = scraper.scrape(
            date_range=date_range,
            max_articles=max_articles,
        )
        tasks.append(task)
        source_names.append(source.lower())

    # Run all scrapers in parallel
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Build result dictionary
    result_dict = {}
    for source_name, result in zip(source_names, results):
        if isinstance(result, Exception):
            # Handle exception as failed result
            result_dict[source_name] = ScraperResult(
                articles=[],
                total_count=0,
                source=source_name,
                success=False,
                error=str(result)
            )
        else:
            result_dict[source_name] = result

    return result_dict
