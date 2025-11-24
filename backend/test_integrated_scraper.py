"""
Integrated FCC Scraper Test Suite

This comprehensive test suite validates:
1. Network connectivity to FCC website
2. Playwright browser automation setup
3. FCC headlines scraping with proper date extraction
4. Data validation and quality checks
"""

import asyncio
import httpx
import time
from datetime import datetime, timedelta
from playwright.async_api import async_playwright
from typing import List, Dict, Optional


class FCCScraperTest:
    """Integrated test suite for FCC scraper"""

    def __init__(self):
        self.results = {
            'network_test': False,
            'playwright_test': False,
            'scraping_test': False,
            'articles': []
        }

    def print_header(self, title: str):
        """Print formatted section header"""
        print('\n' + '=' * 80)
        print(f' {title}')
        print('=' * 80 + '\n')

    def print_step(self, step: str):
        """Print test step"""
        print(f'[STEP] {step}')

    def print_success(self, message: str):
        """Print success message"""
        print(f'[SUCCESS] {message}')

    def print_error(self, message: str):
        """Print error message"""
        print(f'[ERROR] {message}')

    def print_info(self, message: str):
        """Print info message"""
        print(f'[INFO] {message}')

    async def test_network_connectivity(self) -> bool:
        """Test network access to FCC website"""
        self.print_header('TEST 1: Network Connectivity')

        url = 'https://www.fcc.gov/news-events/headlines'

        try:
            self.print_step('Testing HTTP access to FCC website...')
            start_time = time.time()

            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                response = await client.get(url, headers={
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9'
                })

            elapsed = time.time() - start_time

            self.print_success(f'Connected successfully!')
            self.print_info(f'Status Code: {response.status_code}')
            self.print_info(f'Response Time: {elapsed:.2f}s')
            self.print_info(f'Content Length: {len(response.content):,} bytes')

            self.results['network_test'] = True
            return True

        except httpx.TimeoutException:
            self.print_error('Connection timeout after 30 seconds')
            self.print_info('Possible causes:')
            self.print_info('  - Network connectivity issues')
            self.print_info('  - Firewall blocking the connection')
            return False

        except Exception as e:
            self.print_error(f'Connection failed: {type(e).__name__}: {str(e)}')
            return False

    async def test_playwright_setup(self) -> bool:
        """Test Playwright browser automation"""
        self.print_header('TEST 2: Playwright Setup')

        try:
            self.print_step('Testing Playwright with example.com...')

            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                page = await browser.new_page()

                await page.goto('https://example.com', timeout=10000)
                title = await page.title()

                await browser.close()

                self.print_success('Playwright is working correctly!')
                self.print_info(f'Test page title: {title}')

                self.results['playwright_test'] = True
                return True

        except Exception as e:
            self.print_error(f'Playwright test failed: {str(e)}')
            return False

    async def scrape_fcc_headlines(self, max_articles: int = 25) -> List[Dict]:
        """
        Scrape FCC headlines with improved date extraction

        Args:
            max_articles: Maximum number of articles to fetch

        Returns:
            List of article dictionaries
        """
        self.print_header('TEST 3: FCC Headlines Scraping')

        articles = []

        try:
            async with async_playwright() as p:
                self.print_step('Launching browser...')
                browser = await p.chromium.launch(
                    headless=False,
                    args=[
                        '--disable-http2',
                        '--ignore-certificate-errors'
                    ]
                )

                self.print_step('Creating browser page...')
                page = await browser.new_page(
                    user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    viewport={'width': 1920, 'height': 1080}
                )

                await page.set_extra_http_headers({
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br'
                })

                fcc_url = 'https://www.fcc.gov/news-events/headlines'
                self.print_step(f'Navigating to: {fcc_url}')

                await page.goto(fcc_url, wait_until='domcontentloaded', timeout=60000)
                await page.wait_for_load_state('networkidle', timeout=15000)

                self.print_success('Page loaded successfully!')

                # Extract articles with improved selectors
                self.print_step('Analyzing page structure...')

                # Get only parent article containers (exclude nested attachments)
                article_containers = await page.query_selector_all(
                    'article.edoc--component'
                )

                self.print_info(f'Found {len(article_containers)} potential article elements')

                seen_urls = set()  # Track URLs to avoid duplicates

                for container in article_containers:
                    if len(articles) >= max_articles:
                        break

                    try:
                        # Extract title and URL
                        title_elem = await container.query_selector(
                            'h2 a, h3 a, .field-name-title a, a[href*="/document/"]'
                        )

                        if not title_elem:
                            continue

                        title = await title_elem.inner_text()
                        url = await title_elem.get_attribute('href')

                        if not title or not url:
                            continue

                        # Make URL absolute
                        if url.startswith('/'):
                            url = f'https://www.fcc.gov{url}'

                        # Skip duplicates
                        if url in seen_urls:
                            continue
                        seen_urls.add(url)

                        # Extract date with correct selector for FCC website
                        published_date = None
                        date_selectors = [
                            '.edoc__release-dt',  # Primary FCC date selector
                            'time',
                            '.date-display-single',
                            '.field-name-post-date',
                            'time[datetime]',
                            '.date',
                            'span.date'
                        ]

                        for selector in date_selectors:
                            date_elem = await container.query_selector(selector)
                            if date_elem:
                                # Try to get datetime attribute first
                                datetime_attr = await date_elem.get_attribute('datetime')
                                if datetime_attr:
                                    published_date = datetime_attr
                                    break

                                # Otherwise get text content
                                date_text = await date_elem.inner_text()
                                if date_text and date_text.strip():
                                    published_date = date_text.strip()
                                    break

                        # No need to check parent anymore since we only select parent articles

                        # Extract document type and snippet
                        snippet = None

                        # Try to get document type (e.g., "Notice of Proposed Rulemaking")
                        doctype_elem = await container.query_selector('.edoc__doctype .field__item')
                        doctype = None
                        if doctype_elem:
                            doctype = await doctype_elem.inner_text()
                            doctype = doctype.strip() if doctype else None

                        # Try standard snippet selectors
                        snippet_selectors = [
                            '.field-name-body p',
                            '.field-name-field-description',
                            'p',
                            '.summary',
                            '.description'
                        ]

                        for selector in snippet_selectors:
                            snippet_elem = await container.query_selector(selector)
                            if snippet_elem:
                                snippet_text = await snippet_elem.inner_text()
                                if snippet_text and len(snippet_text) > 20:
                                    snippet = snippet_text.strip()[:300]
                                    break

                        # If no snippet but we have doctype, use that
                        if not snippet and doctype:
                            snippet = f'Document Type: {doctype}'

                        article = {
                            'title': title.strip(),
                            'url': url,
                            'published_date': published_date,
                            'snippet': snippet
                        }

                        articles.append(article)
                        self.print_info(f'[{len(articles)}] {article["title"][:60]}...')

                    except Exception as e:
                        continue

                # If still no articles, try alternative approach
                if len(articles) == 0:
                    self.print_step('Trying alternative extraction method...')

                    all_links = await page.query_selector_all('a[href*="/document/"]')

                    for link in all_links[:max_articles]:
                        try:
                            title = await link.inner_text()
                            url = await link.get_attribute('href')

                            if url and url.startswith('/'):
                                url = f'https://www.fcc.gov{url}'

                            if title and url and url not in seen_urls:
                                articles.append({
                                    'title': title.strip(),
                                    'url': url,
                                    'published_date': None,
                                    'snippet': None
                                })
                                seen_urls.add(url)
                        except:
                            continue

                await browser.close()

                self.print_success(f'Scraped {len(articles)} unique articles')
                self.results['scraping_test'] = True
                self.results['articles'] = articles
                return articles

        except Exception as e:
            self.print_error(f'Scraping failed: {str(e)}')
            return articles

    def print_results_summary(self):
        """Print comprehensive test results"""
        self.print_header('TEST RESULTS SUMMARY')

        # Test status
        print('Test Results:')
        print(f'  Network Connectivity:  {"PASS" if self.results["network_test"] else "FAIL"}')
        print(f'  Playwright Setup:      {"PASS" if self.results["playwright_test"] else "FAIL"}')
        print(f'  FCC Scraping:          {"PASS" if self.results["scraping_test"] else "FAIL"}')
        print(f'  Total Articles:        {len(self.results["articles"])}')

        # Article statistics
        articles = self.results['articles']
        if articles:
            articles_with_date = sum(1 for a in articles if a.get('published_date'))
            articles_with_snippet = sum(1 for a in articles if a.get('snippet'))

            print('\nData Quality:')
            print(f'  Articles with dates:   {articles_with_date}/{len(articles)} ({articles_with_date/len(articles)*100:.1f}%)')
            print(f'  Articles with snippet: {articles_with_snippet}/{len(articles)} ({articles_with_snippet/len(articles)*100:.1f}%)')

            # Display sample articles
            print('\nSample Articles (first 5):')
            print('-' * 80)
            for i, article in enumerate(articles[:5], 1):
                print(f'\n{i}. {article["title"]}')
                print(f'   URL: {article["url"]}')
                print(f'   Date: {article["published_date"] or "Not available"}')
                if article.get('snippet'):
                    print(f'   Snippet: {article["snippet"][:100]}...')

        # Overall status
        all_passed = (
            self.results['network_test'] and
            self.results['playwright_test'] and
            self.results['scraping_test']
        )

        print('\n' + '=' * 80)
        if all_passed:
            print('OVERALL STATUS: ALL TESTS PASSED')
        else:
            print('OVERALL STATUS: SOME TESTS FAILED')
        print('=' * 80 + '\n')

        return all_passed


async def main():
    """Main test execution"""
    print('\n')
    print('*' * 80)
    print('*' + ' ' * 78 + '*')
    print('*' + '  FCC SCRAPER - INTEGRATED TEST SUITE'.center(78) + '*')
    print('*' + ' ' * 78 + '*')
    print('*' * 80)

    tester = FCCScraperTest()

    # Run tests in sequence
    network_ok = await tester.test_network_connectivity()

    if not network_ok:
        print('\n[WARNING] Network test failed. Continuing with remaining tests...\n')

    playwright_ok = await tester.test_playwright_setup()

    if not playwright_ok:
        print('\n[ERROR] Playwright test failed. Cannot proceed with scraping.\n')
        tester.print_results_summary()
        return False

    # Run scraping test
    articles = await tester.scrape_fcc_headlines(max_articles=25)

    # Print final results
    success = tester.print_results_summary()

    return success


if __name__ == '__main__':
    try:
        success = asyncio.run(main())
        exit(0 if success else 1)
    except KeyboardInterrupt:
        print('\n\nTest interrupted by user.')
        exit(1)
    except Exception as e:
        print(f'\n\nUnexpected error: {type(e).__name__}: {str(e)}')
        exit(1)
