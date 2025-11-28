"""
Ofcom (UK) auto-scraper using Firecrawl API.
Scrapes Spectrum consultations and statements from Ofcom website.
"""

import asyncio
import httpx
from bs4 import BeautifulSoup
from typing import List
from urllib.parse import urlencode

from .base_scraper import BaseScraper, ScraperResult, ArticlePreview
from .date_utils import (
    parse_date_flexible,
    is_date_in_range,
    format_date_for_display,
    get_date_range_boundaries
)
from app.config import settings


class OfcomScraper(BaseScraper):
    """Ofcom scraper using Firecrawl API (bypasses Cloudflare)"""

    # Ofcom base URL and default parameters
    OFCOM_BASE_URL = 'https://www.ofcom.org.uk/consultations-and-statements'
    OFCOM_TOPIC_SPECTRUM = '67891'  # Spectrum topic ID
    OFCOM_MAX_RESULTS = 108  # Maximum results per request

    def __init__(self):
        super().__init__()
        self.api_key = settings.FIRECRAWL_API_KEY
        self.firecrawl_url = 'https://api.firecrawl.dev/v1'

    def get_source_name(self) -> str:
        return 'ofcom'

    def _build_url(self, date_range: str) -> str:
        """
        Build Ofcom URL with date filter parameters.

        Args:
            date_range: Date filter (today, this-week, last-week, YYYY-MM, or 'all')

        Returns:
            Complete URL with query parameters
        """
        params = {
            'query': '',
            'SelectedTopic': self.OFCOM_TOPIC_SPECTRUM,
            'SelectedSubTopics': '',
            'ContentStatus': '',
            'IncludePDF': 'true',
            'SortBy': 'Newest',
            'NumberOfResults': str(self.OFCOM_MAX_RESULTS)
        }

        # Add date filter if not 'all'
        if date_range and date_range != 'all':
            try:
                start_date, end_date = get_date_range_boundaries(date_range)
                params['UpdatedAfter'] = start_date.strftime('%Y-%m-%d')
                params['UpdatedBefore'] = end_date.strftime('%Y-%m-%d')
            except Exception as e:
                self.log_warning(f"Failed to parse date_range '{date_range}': {e}")
                params['UpdatedAfter'] = ''
                params['UpdatedBefore'] = ''
        else:
            params['UpdatedAfter'] = ''
            params['UpdatedBefore'] = ''

        return f"{self.OFCOM_BASE_URL}?{urlencode(params)}"

    async def scrape(
        self,
        date_range: str = 'this-week',
        max_articles: int = 108,
        **kwargs
    ) -> ScraperResult:
        """
        Scrape Ofcom using Firecrawl API with server-side date filtering.

        Args:
            date_range: Date filter (today, this-week, last-week, YYYY-MM, or 'all')
            max_articles: Maximum articles to return

        Returns:
            ScraperResult with Ofcom articles
        """
        self.log_info(f"Starting scrape (date_range={date_range}, max={max_articles})")
        articles = []
        warnings = []

        if not self.api_key:
            error_msg = "FIRECRAWL_API_KEY not configured"
            self.log_error(error_msg)
            return ScraperResult(
                articles=[],
                total_count=0,
                source='ofcom',
                success=False,
                error=error_msg
            )

        try:
            # Build URL with date filter parameters
            target_url = self._build_url(date_range)
            self.log_info(f"Target URL: {target_url}")

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
                                'url': target_url,
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
                    try:
                        error_body = response.text[:500]
                        self.log_error(f"{error_msg}. Response: {error_body}")
                    except:
                        self.log_error(error_msg)
                    return ScraperResult(
                        articles=[],
                        total_count=0,
                        source='ofcom',
                        success=False,
                        error=f"{error_msg} (Check Firecrawl API key and credits)"
                    )

                data = response.json()

                if not data.get('success'):
                    error_msg = f"Firecrawl error: {data.get('error', 'Unknown error')}"
                    self.log_error(error_msg)
                    return ScraperResult(
                        articles=[],
                        total_count=0,
                        source='ofcom',
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
                        source='ofcom',
                        success=False,
                        error=error_msg
                    )

                self.log_info("Parsing HTML content...")
                self.log_info(f"HTML content length: {len(html_content)} characters")
                soup = BeautifulSoup(html_content, 'html.parser')

                # Find all article blocks
                article_blocks = soup.select('div.search-results-block')
                self.log_info(f"Found {len(article_blocks)} article blocks")

                if len(article_blocks) == 0:
                    # Try alternative selectors
                    self.log_warning("No articles found with 'div.search-results-block' selector")
                    self.log_info("Checking HTML structure...")

                    # Log sample HTML for debugging
                    sample_html = html_content[:1000] if len(html_content) > 1000 else html_content
                    self.log_info(f"HTML sample: {sample_html}")

                    warnings.append("No articles found - HTML structure may have changed")

                seen_urls = set()
                filtered_by_date = 0
                skipped_duplicates = 0
                parse_errors = 0

                for block in article_blocks:
                    if len(articles) >= max_articles:
                        break

                    try:
                        # Extract URL and title
                        link = block.select_one('a')
                        if not link or not link.get('href'):
                            continue

                        url = link.get('href')
                        if url in seen_urls:
                            skipped_duplicates += 1
                            continue
                        seen_urls.add(url)

                        title_elem = block.select_one('h3.info-card-header')
                        if not title_elem:
                            continue
                        title = title_elem.get_text(strip=True)

                        # Extract dates
                        published_date = None
                        last_updated = None

                        date_div = block.select_one('div.serach-date')
                        if date_div:
                            date_paragraphs = date_div.select('p')
                            for p in date_paragraphs:
                                text = p.get_text(strip=True)
                                if text.startswith('Published:'):
                                    published_date = text.replace('Published:', '').strip()
                                if text.startswith('Last updated:'):
                                    last_updated = text.replace('Last updated:', '').strip()

                        # Use last_updated if available, otherwise published_date
                        final_date_str = last_updated if last_updated else published_date
                        parsed_date = parse_date_flexible(final_date_str) if final_date_str else None

                        # Apply date filter (skip if 'all' or no date_range)
                        if date_range and date_range != 'all' and parsed_date:
                            if not is_date_in_range(parsed_date, date_range):
                                filtered_by_date += 1
                                continue

                        # Extract snippet
                        snippet = None
                        info_card = block.select_one('div.info-card')
                        if info_card:
                            all_paragraphs = info_card.select('p')
                            desc_paragraphs = [
                                p for p in all_paragraphs
                                if not p.find_parent('div', class_='serach-date')
                            ]
                            if desc_paragraphs:
                                snippet_text = desc_paragraphs[-1].get_text(strip=True)
                                if snippet_text:
                                    snippet = snippet_text[:300]

                        # Determine document type
                        doc_type = None
                        if title.startswith('Consultation:'):
                            doc_type = 'Consultation'
                            title = title.replace('Consultation:', '').strip()
                        elif title.startswith('Statement:'):
                            doc_type = 'Statement'
                            title = title.replace('Statement:', '').strip()
                        elif title.startswith('Call for Input:'):
                            doc_type = 'Call for Input'
                            title = title.replace('Call for Input:', '').strip()

                        article = ArticlePreview(
                            title=title,
                            url=url,
                            published_date=format_date_for_display(parsed_date),
                            source='Ofcom',
                            snippet=snippet,
                            document_type=doc_type
                        )

                        articles.append(article)

                    except Exception as e:
                        parse_errors += 1
                        self.log_warning(f"Failed to parse article block: {str(e)}")
                        continue

                # Summary logging
                self.log_info(
                    f"Scraping complete: {len(articles)} articles collected, "
                    f"{filtered_by_date} filtered by date, "
                    f"{skipped_duplicates} duplicates, "
                    f"{parse_errors} parse errors"
                )

                if len(articles) == 0 and len(article_blocks) > 0:
                    warnings.append(
                        f"No articles passed filters (checked {len(article_blocks)} blocks, "
                        f"{filtered_by_date} filtered by date)"
                    )

                return ScraperResult(
                    articles=articles,
                    total_count=len(articles),
                    source='ofcom',
                    success=True,
                    warnings=warnings
                )

        except httpx.TimeoutException as e:
            error_msg = f"Firecrawl API timeout after 180s: {str(e)}"
            self.log_error(error_msg)
            return ScraperResult(
                articles=[],
                total_count=0,
                source='ofcom',
                success=False,
                error=error_msg,
                warnings=warnings + ["Firecrawl API timeout - Ofcom site may be slow"]
            )
        except httpx.HTTPError as e:
            error_msg = f"HTTP error while calling Firecrawl: {str(e)}"
            self.log_error(error_msg)
            return ScraperResult(
                articles=[],
                total_count=0,
                source='ofcom',
                success=False,
                error=error_msg,
                warnings=warnings + ["Network error - check internet connection"]
            )
        except Exception as e:
            self.log_error(f"Unexpected error during scraping: {str(e)}", exc_info=True)
            return ScraperResult(
                articles=[],
                total_count=0,
                source='ofcom',
                success=False,
                error=f"Unexpected error: {str(e)}",
                warnings=warnings
            )
