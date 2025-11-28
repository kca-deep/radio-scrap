"""
Soumu (Japan Ministry of Internal Affairs and Communications) auto-scraper.
Uses Firecrawl API with keyword filtering for Japanese spectrum/wireless news.
"""

import asyncio
import httpx
from bs4 import BeautifulSoup
from typing import List

from .base_scraper import BaseScraper, ScraperResult, ArticlePreview
from .date_utils import parse_japanese_era_date, is_date_in_range, format_date_for_display
from app.config import settings


class SoumuScraper(BaseScraper):
    """Soumu scraper using Firecrawl API with keyword filtering"""

    def __init__(self):
        super().__init__()
        self.api_key = settings.FIRECRAWL_API_KEY
        self.firecrawl_url = 'https://api.firecrawl.dev/v1'
        self.soumu_url = getattr(
            settings,
            'SOUMU_URL',
            'https://www.soumu.go.jp/menu_news/s-news'
        )
        # Use keywords from config.py
        self.default_keywords = settings.SOUMU_DEFAULT_KEYWORDS

    def get_source_name(self) -> str:
        return 'soumu'

    def _contains_keyword(self, text: str, keywords: List[str]) -> tuple[bool, List[str]]:
        """
        Check if text contains any keywords.

        Args:
            text: Text to check
            keywords: List of keywords

        Returns:
            Tuple of (has_keyword, matched_keywords)
        """
        if not text:
            return False, []

        matched_keywords = []
        text_lower = text.lower()

        for keyword in keywords:
            if keyword.lower() in text_lower:
                matched_keywords.append(keyword)

        return len(matched_keywords) > 0, matched_keywords

    async def scrape(
        self,
        date_range: str = 'this-week',
        max_articles: int = 50,
        **kwargs
    ) -> ScraperResult:
        """
        Scrape Soumu using Firecrawl API with keyword filtering.

        Args:
            date_range: Date filter (today, this-week, last-week, or YYYY-MM)
            max_articles: Maximum articles to return
            **kwargs: Additional parameters (unused)

        Returns:
            ScraperResult with Soumu articles
        """
        keywords = self.default_keywords

        self.log_info(
            f"Starting scrape (date_range={date_range}, max={max_articles}, "
            f"keywords={len(keywords)})"
        )
        articles = []
        warnings = []

        if not self.api_key:
            error_msg = "FIRECRAWL_API_KEY not configured"
            self.log_error(error_msg)
            return ScraperResult(
                articles=[],
                total_count=0,
                source='soumu',
                success=False,
                error=error_msg
            )

        try:
            async with httpx.AsyncClient(timeout=180.0) as client:
                self.log_info(f"Scraping via Firecrawl (may take 60-90s)...")

                # Progress tracking
                start_time = asyncio.get_event_loop().time()

                async def scrape_with_progress():
                    task = asyncio.create_task(
                        client.post(
                            f'{self.firecrawl_url}/scrape',
                            headers={
                                'Authorization': f'Bearer {self.api_key}',
                                'Content-Type': 'application/json'
                            },
                            json={
                                'url': self.soumu_url,
                                'formats': ['html'],
                                'onlyMainContent': False,
                                'waitFor': 5000,
                                'timeout': 90000,
                                'mobile': False,
                            }
                        )
                    )

                    # Progress updates
                    while not task.done():
                        await asyncio.sleep(10)
                        if not task.done():
                            elapsed = int(asyncio.get_event_loop().time() - start_time)
                            self.log_info(f"Firecrawl processing... ({elapsed}s elapsed)")

                    return await task

                response = await scrape_with_progress()

                elapsed_total = int(asyncio.get_event_loop().time() - start_time)
                self.log_info(f"Received response from Firecrawl (took {elapsed_total}s)")

                if response.status_code != 200:
                    error_msg = f"Firecrawl returned status {response.status_code}"
                    self.log_error(error_msg)
                    return ScraperResult(
                        articles=[],
                        total_count=0,
                        source='soumu',
                        success=False,
                        error=error_msg
                    )

                data = response.json()

                if not data.get('success'):
                    error_msg = f"Firecrawl error: {data.get('error', 'Unknown error')}"
                    self.log_error(error_msg)
                    return ScraperResult(
                        articles=[],
                        total_count=0,
                        source='soumu',
                        success=False,
                        error=error_msg
                    )

                html_content = data.get('data', {}).get('html', '')

                if not html_content:
                    error_msg = "No HTML content received from Firecrawl"
                    self.log_error(error_msg)
                    return ScraperResult(
                        articles=[],
                        total_count=0,
                        source='soumu',
                        success=False,
                        error=error_msg
                    )

                self.log_info("Parsing HTML content...")
                soup = BeautifulSoup(html_content, 'html.parser')

                # Find news table
                table = soup.select_one('table.tableList')
                if not table:
                    error_msg = "Could not find news table (table.tableList)"
                    self.log_error(error_msg)
                    return ScraperResult(
                        articles=[],
                        total_count=0,
                        source='soumu',
                        success=False,
                        error=error_msg
                    )

                rows = table.select('tbody tr')
                self.log_info(f"Found {len(rows)} table rows")

                seen_urls = set()
                all_articles_count = 0

                for row in rows:
                    try:
                        cells = row.select('td')
                        if len(cells) != 3:
                            continue

                        all_articles_count += 1

                        # Extract date
                        date_cell = cells[0]
                        date_str = date_cell.get_text(strip=True)

                        # Extract title and URL
                        title_cell = cells[1]
                        link = title_cell.select_one('a')

                        if not link:
                            continue

                        href = link.get('href')
                        if not href:
                            continue

                        # Convert relative URL to absolute
                        if href.startswith('/'):
                            url = f'https://www.soumu.go.jp{href}'
                        elif href.startswith('http'):
                            url = href
                        else:
                            continue

                        if url in seen_urls:
                            continue
                        seen_urls.add(url)

                        title = link.get_text(strip=True)
                        if not title or len(title) < 5:
                            continue

                        # Keyword filtering
                        has_keyword, matched = self._contains_keyword(title, keywords)
                        if not has_keyword:
                            continue

                        # Parse Japanese date
                        parsed_date = parse_japanese_era_date(date_str)

                        # Apply date filter (skip if 'all' or no date_range)
                        if date_range and date_range != 'all' and parsed_date:
                            if not is_date_in_range(parsed_date, date_range):
                                continue

                        # Extract category
                        category_cell = cells[2]
                        category = category_cell.get_text(strip=True)

                        article = ArticlePreview(
                            title=title,
                            url=url,
                            published_date=format_date_for_display(parsed_date),
                            source='Soumu',
                            snippet=f"Category: {category}" if category else None,
                            matched_keywords=matched
                        )

                        articles.append(article)

                        if len(articles) >= max_articles:
                            break

                    except Exception as e:
                        self.log_warning(f"Failed to parse table row: {str(e)}")
                        continue

                match_rate = (len(articles) / all_articles_count * 100) if all_articles_count > 0 else 0
                self.log_info(
                    f"Successfully scraped {len(articles)} articles "
                    f"(match rate: {match_rate:.1f}%)"
                )

                return ScraperResult(
                    articles=articles,
                    total_count=len(articles),
                    source='soumu',
                    success=True,
                    warnings=warnings
                )

        except Exception as e:
            self.log_error(f"Scraping failed: {str(e)}")
            return ScraperResult(
                articles=[],
                total_count=0,
                source='soumu',
                success=False,
                error=str(e),
                warnings=warnings
            )
