"""
FCC (USA) auto-scraper using BeautifulSoup + requests.
Scrapes Wireless Telecommunications headlines from FCC website.
"""

import asyncio
import time
from typing import List
from bs4 import BeautifulSoup
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from .base_scraper import BaseScraper, ScraperResult, ArticlePreview
from .date_utils import parse_date_flexible, is_date_in_range, format_date_for_display
from app.config import settings


def create_session_with_retries(retries=3, backoff_factor=0.5):
    """Create a requests session with retry logic"""
    session = requests.Session()
    retry_strategy = Retry(
        total=retries,
        backoff_factor=backoff_factor,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["GET"],
        raise_on_status=False
    )
    adapter = HTTPAdapter(max_retries=retry_strategy)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session


class FCCScraper(BaseScraper):
    """FCC scraper using BeautifulSoup + requests for static scraping"""

    def __init__(self):
        super().__init__()
        self.fcc_url = getattr(
            settings,
            'FCC_URL',
            'https://www.fcc.gov/news-events/headlines?year_released=all&tid%5B541%5D=541&items_per_page=25'
        )

    def get_source_name(self) -> str:
        return 'fcc'

    async def scrape(
        self,
        date_range: str = 'this-week',
        max_articles: int = 25,
        **kwargs
    ) -> ScraperResult:
        """
        Scrape FCC headlines with BeautifulSoup.

        Args:
            date_range: Date filter (today, this-week, last-week)
            max_articles: Maximum articles to return

        Returns:
            ScraperResult with FCC articles
        """
        self.log_info(f"Starting scrape (date_range={date_range}, max={max_articles})")
        articles = []
        warnings = []

        try:
            self.log_info(f"Fetching: {self.fcc_url}")

            # Simple headers like test_fcc_scraper.py
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }

            def fetch_with_retry():
                """Fetch URL with session and retry logic"""
                session = create_session_with_retries(retries=3, backoff_factor=1.0)
                try:
                    response = session.get(
                        self.fcc_url,
                        headers=headers,
                        timeout=(10, 30)  # (connect_timeout, read_timeout)
                    )
                    return response
                finally:
                    session.close()

            # Use requests in asyncio thread pool (requests is sync library)
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(None, fetch_with_retry)

            if response.status_code != 200:
                error_msg = f"HTTP {response.status_code} error"
                self.log_error(error_msg)
                return ScraperResult(
                    articles=[],
                    total_count=0,
                    source='fcc',
                    success=False,
                    error=error_msg
                )

            self.log_info(f"Received {len(response.content)} bytes, parsing HTML...")
            soup = BeautifulSoup(response.content, 'html.parser')

            # Find article containers (Drupal views-row pattern)
            article_containers = soup.find_all('div', class_='views-row')

            if not article_containers:
                # Try alternative selector
                article_containers = soup.find_all('article')

            self.log_info(f"Found {len(article_containers)} article elements")

            seen_urls = set()

            for container in article_containers:
                if len(articles) >= max_articles:
                    break

                try:
                    # FCC site uses: div.headline-title > a.title
                    title_elem = container.find('div', class_='headline-title')
                    if title_elem:
                        link = title_elem.find('a', class_='title')
                    else:
                        # Fallback: try h3, h2
                        title_elem = container.find('h3') or container.find('h2')
                        link = title_elem.find('a') if title_elem else None

                    if not link:
                        # Try finding any link with title class
                        link = container.find('a', class_='title')

                    if not link:
                        continue

                    title = link.get_text(strip=True)
                    href = link.get('href', '')

                    if not title or not href:
                        continue

                    # Make URL absolute
                    if href.startswith('/'):
                        url = f'https://www.fcc.gov{href}'
                    else:
                        url = href

                    # Skip duplicates
                    if url in seen_urls:
                        continue
                    seen_urls.add(url)

                    # Extract published date from edoc__release-dt
                    published_date = None
                    date_elem = container.find('div', class_='edoc__release-dt')
                    if date_elem:
                        published_date = date_elem.get_text(strip=True)
                    else:
                        # Fallback: try time element
                        time_elem = container.find('time')
                        if time_elem:
                            published_date = time_elem.get('datetime') or time_elem.get_text(strip=True)

                    # Parse and filter by date
                    parsed_date = parse_date_flexible(published_date) if published_date else None

                    # Apply date filter (skip if 'all' or no date_range)
                    if date_range and date_range != 'all' and parsed_date:
                        if not is_date_in_range(parsed_date, date_range):
                            continue

                    # Extract document type from edoc__doctype
                    doctype = None
                    doctype_elem = container.find('div', class_='edoc__doctype')
                    if doctype_elem:
                        field_item = doctype_elem.find('div', class_='field__item')
                        if field_item:
                            doctype = field_item.get_text(strip=True)

                    # No snippet in this layout
                    snippet = None

                    article = ArticlePreview(
                        title=title,
                        url=url,
                        published_date=format_date_for_display(parsed_date),
                        source='FCC',
                        snippet=snippet,
                        document_type=doctype
                    )

                    articles.append(article)

                except Exception as e:
                    self.log_warning(f"Failed to parse article: {str(e)}")
                    continue

            self.log_info(f"Successfully scraped {len(articles)} articles")

            return ScraperResult(
                articles=articles,
                total_count=len(articles),
                source='fcc',
                success=True,
                warnings=warnings
            )

        except requests.Timeout as e:
            error_msg = f"Request timeout: {str(e)}"
            self.log_error(error_msg)
            return ScraperResult(
                articles=[],
                total_count=0,
                source='fcc',
                success=False,
                error=error_msg,
                warnings=warnings
            )
        except requests.RequestException as e:
            error_msg = f"Request error: {type(e).__name__}: {str(e)}"
            self.log_error(error_msg)
            return ScraperResult(
                articles=[],
                total_count=0,
                source='fcc',
                success=False,
                error=error_msg,
                warnings=warnings
            )
        except Exception as e:
            self.log_error(f"Scraping failed: {str(e)}")
            return ScraperResult(
                articles=[],
                total_count=0,
                source='fcc',
                success=False,
                error=str(e),
                warnings=warnings
            )
