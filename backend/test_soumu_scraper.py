"""
Soumu (Japan Ministry of Internal Affairs and Communications) Scraper Test

This test file uses Firecrawl API to scrape Soumu news with keyword filtering.
Keywords are related to spectrum, wireless, and mobile communications.

Target URL: https://www.soumu.go.jp/menu_news/s-news
Keywords: From mail.md - Japanese spectrum/wireless related terms

Requirements:
- FIRECRAWL_API_KEY environment variable must be set
- httpx library for API calls
"""

import asyncio
import httpx
import json
import os
import sys
import io
from datetime import datetime
from typing import List, Dict, Optional
from bs4 import BeautifulSoup
from dotenv import load_dotenv

# Fix Windows encoding issues
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# Load environment variables from .env file
load_dotenv()


class SoumuFirecrawlScraper:
    """Soumu scraper using Firecrawl API with keyword filtering"""

    def __init__(self):
        self.api_key = os.getenv('FIRECRAWL_API_KEY')
        self.firecrawl_url = 'https://api.firecrawl.dev/v1'
        self.soumu_url = 'https://www.soumu.go.jp/menu_news/s-news'

        # Keywords from mail.md
        self.keywords = [
            "周波数", "kHz", "MHz", "GHz", "5世代", "6世代", "4世代", "3G", "4G",
            "LTE", "5G", "6G", "伝播", "広帯域", "移動通信", "帯域", "モバイル",
            "無線", "免許", "割当", "割当計画", "免許状", "周波数再編", "実証実験",
            "技術試験", "衛星通信", "非静止衛星", "ゲートウェイ局", "衛星地球局",
            "技術基準", "告示改正", "省令改正", "ガイドライン", "WRC", "ITU-R",
            "ローカル5G", "プライベート5G", "FWA", "ミリ波", "テラヘルツ", "AFC",
            "コグニティブ無線", "ダイナミック周波数共有"
        ]

        self.results = {
            'api_test': False,
            'scraping_test': False,
            'articles': [],
            'filtered_articles': []
        }

    def print_header(self, title: str):
        """Print formatted section header"""
        print('\n' + '=' * 80)
        print(f' {title}')
        print('=' * 80 + '\n')

    def print_step(self, step: str):
        print(f'[STEP] {step}')

    def print_success(self, message: str):
        print(f'[SUCCESS] {message}')

    def print_error(self, message: str):
        print(f'[ERROR] {message}')

    def print_info(self, message: str):
        print(f'[INFO] {message}')

    def print_warning(self, message: str):
        print(f'[WARNING] {message}')

    def contains_keyword(self, text: str) -> tuple[bool, List[str]]:
        """
        Check if text contains any of the keywords
        Returns: (has_keyword, list of matched keywords)
        """
        if not text:
            return False, []

        matched_keywords = []
        text_lower = text.lower()

        for keyword in self.keywords:
            if keyword.lower() in text_lower:
                matched_keywords.append(keyword)

        return len(matched_keywords) > 0, matched_keywords

    async def test_firecrawl_api(self) -> bool:
        """Test Firecrawl API connectivity"""
        self.print_header('TEST 1: Firecrawl API Connection')

        if not self.api_key:
            self.print_error('FIRECRAWL_API_KEY environment variable not set')
            self.print_info('Please set FIRECRAWL_API_KEY in your .env file')
            self.print_info('Get your API key from: https://firecrawl.dev')
            return False

        self.print_step('Testing API key...')
        self.print_info(f'API Key: {self.api_key[:10]}...')

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                # Test with a simple scrape request
                response = await client.post(
                    f'{self.firecrawl_url}/scrape',
                    headers={
                        'Authorization': f'Bearer {self.api_key}',
                        'Content-Type': 'application/json'
                    },
                    json={
                        'url': 'https://example.com',
                        'formats': ['markdown']
                    }
                )

                if response.status_code == 200:
                    self.print_success('Firecrawl API is working!')
                    self.results['api_test'] = True
                    return True
                elif response.status_code == 401:
                    self.print_error('Invalid API key')
                    return False
                else:
                    self.print_error(f'API returned status {response.status_code}')
                    return False

        except Exception as e:
            self.print_error(f'API test failed: {str(e)}')
            return False

    async def scrape_soumu_with_firecrawl(self, max_articles: int = 50) -> List[Dict]:
        """
        Scrape Soumu using Firecrawl API

        Returns list of articles with metadata:
        - title: Article title
        - url: Article URL
        - published_date: Publication date
        - category: News category
        - snippet: Description
        - matched_keywords: List of matched keywords
        """
        self.print_header('TEST 2: Scraping Soumu with Firecrawl')

        articles = []

        try:
            # Longer timeout for Japanese government sites
            async with httpx.AsyncClient(timeout=180.0) as client:
                self.print_step(f'Scraping: {self.soumu_url}')
                self.print_info('This may take 60-90 seconds...')
                self.print_info('[1/3] Sending request to Firecrawl API...')

                # Start timer for total elapsed time
                total_start_time = asyncio.get_event_loop().time()

                # Create async task for API call with progress updates
                async def scrape_with_progress():
                    # Start timer
                    start_time = asyncio.get_event_loop().time()

                    # Create scraping task
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
                                'onlyMainContent': False,  # Get full page
                                'waitFor': 5000,  # Wait 5 seconds for JS to load
                                'timeout': 90000,  # 90 seconds timeout
                                'mobile': False,  # Desktop mode
                                'skipTlsVerification': False
                            }
                        )
                    )

                    # Show progress while waiting
                    while not task.done():
                        await asyncio.sleep(10)
                        if not task.done():
                            elapsed = int(asyncio.get_event_loop().time() - start_time)
                            self.print_info(f'[2/3] Firecrawl is processing... ({elapsed}s elapsed)')

                    return await task

                # Scrape with Firecrawl
                response = await scrape_with_progress()

                elapsed_total = int(asyncio.get_event_loop().time() - total_start_time)
                self.print_info(f'[3/3] Received response from Firecrawl (took {elapsed_total}s)')

                if response.status_code != 200:
                    self.print_error(f'Firecrawl returned status {response.status_code}')
                    self.print_info(f'Response: {response.text[:200]}')
                    return articles

                data = response.json()

                if not data.get('success'):
                    self.print_error('Firecrawl scraping failed')
                    self.print_info(f'Error: {data.get("error", "Unknown error")}')
                    return articles

                self.print_success('Firecrawl scraping completed!')

                # Get HTML content
                html_content = data.get('data', {}).get('html', '')

                if not html_content:
                    self.print_error('No HTML content received')
                    return articles

                # Save HTML for debugging
                with open('backend/soumu_firecrawl_output.html', 'w', encoding='utf-8') as f:
                    f.write(html_content)
                self.print_info('HTML saved: backend/soumu_firecrawl_output.html')

                # Parse HTML content with BeautifulSoup
                self.print_step('Parsing HTML content...')
                soup = BeautifulSoup(html_content, 'html.parser')

                # Find the news table
                table = soup.select_one('table.tableList')
                if not table:
                    self.print_error('Could not find news table (table.tableList)')
                    return articles

                # Find all rows in tbody (skip header row)
                rows = table.select('tbody tr')
                self.print_info(f'Found {len(rows)} table rows')

                seen_urls = set()

                for row in rows:
                    if len(articles) >= max_articles:
                        break

                    try:
                        # Get all td elements in this row
                        cells = row.select('td')

                        # Skip header row or rows without 3 cells
                        if len(cells) != 3:
                            continue

                        # Extract date from first cell (td.nw)
                        date_cell = cells[0]
                        published_date = date_cell.get_text(strip=True)

                        # Extract title and URL from second cell
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

                        # Skip duplicates
                        if url in seen_urls:
                            continue
                        seen_urls.add(url)

                        title = link.get_text(strip=True)
                        if not title or len(title) < 5:
                            continue

                        # Extract category from third cell
                        category_cell = cells[2]
                        category = category_cell.get_text(strip=True)

                        article = {
                            'title': title,
                            'url': url,
                            'published_date': published_date,
                            'category': category,
                            'snippet': None,  # Not available in table
                            'matched_keywords': []
                        }

                        articles.append(article)

                    except Exception as e:
                        self.print_warning(f'Failed to parse table row: {str(e)}')
                        continue

                self.print_success(f'Extracted {len(articles)} articles')
                self.results['scraping_test'] = True
                self.results['articles'] = articles
                return articles

        except Exception as e:
            self.print_error(f'Scraping failed: {str(e)}')
            import traceback
            traceback.print_exc()
            return articles

    def filter_articles_by_keywords(self, articles: List[Dict]) -> List[Dict]:
        """Filter articles that contain any of the keywords"""
        self.print_header('TEST 3: Filtering Articles by Keywords')

        self.print_step(f'Filtering {len(articles)} articles with {len(self.keywords)} keywords...')
        self.print_info(f'Keywords: {", ".join(self.keywords[:10])}...')

        filtered = []

        for article in articles:
            # Check title for keywords
            has_keyword, matched = self.contains_keyword(article['title'])

            if has_keyword:
                article['matched_keywords'] = matched
                filtered.append(article)

        self.print_success(f'Found {len(filtered)} articles matching keywords')
        self.print_info(f'Match rate: {len(filtered)}/{len(articles)} ({len(filtered)/len(articles)*100:.1f}%)')

        self.results['filtered_articles'] = filtered
        return filtered

    def print_results_summary(self):
        """Print comprehensive test results"""
        self.print_header('TEST RESULTS SUMMARY')

        print('Test Results:')
        print(f'  API Connection:        {"PASS" if self.results["api_test"] else "FAIL"}')
        print(f'  Article Scraping:      {"PASS" if self.results["scraping_test"] else "FAIL"}')
        print(f'  Total Articles:        {len(self.results["articles"])}')
        print(f'  Filtered Articles:     {len(self.results["filtered_articles"])}')

        filtered_articles = self.results['filtered_articles']
        if filtered_articles:
            articles_with_date = sum(1 for a in filtered_articles if a.get('published_date'))

            print('\nData Quality (Filtered):')
            print(f'  Articles with dates:   {articles_with_date}/{len(filtered_articles)} ({articles_with_date/len(filtered_articles)*100:.1f}%)')

            # Count keyword frequencies
            keyword_counts = {}
            for article in filtered_articles:
                for keyword in article.get('matched_keywords', []):
                    keyword_counts[keyword] = keyword_counts.get(keyword, 0) + 1

            print('\nTop Matched Keywords:')
            sorted_keywords = sorted(keyword_counts.items(), key=lambda x: x[1], reverse=True)
            for keyword, count in sorted_keywords[:10]:
                print(f'  {keyword}: {count}')

            print('\nSample Filtered Articles (first 5):')
            print('-' * 80)
            for i, article in enumerate(filtered_articles[:5], 1):
                print(f'\n{i}. {article["title"][:80]}')
                print(f'   URL: {article["url"]}')
                print(f'   Date: {article["published_date"] or "Not available"}')
                print(f'   Keywords: {", ".join(article["matched_keywords"][:5])}')

        all_passed = (
            self.results['api_test'] and
            self.results['scraping_test'] and
            len(self.results['filtered_articles']) > 0
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
    print('*' + '  SOUMU SCRAPER - FIRECRAWL API (KEYWORD FILTERING)'.center(78) + '*')
    print('*' + ' ' * 78 + '*')
    print('*' * 80)

    scraper = SoumuFirecrawlScraper()

    # Test API first
    api_ok = await scraper.test_firecrawl_api()

    if not api_ok:
        print('\n[ERROR] Firecrawl API test failed.')
        print('Please check your API key and try again.')
        scraper.print_results_summary()
        return False

    # Scrape Soumu
    articles = await scraper.scrape_soumu_with_firecrawl(max_articles=50)

    if not articles:
        print('\n[ERROR] No articles scraped.')
        scraper.print_results_summary()
        return False

    # Filter articles by keywords
    filtered_articles = scraper.filter_articles_by_keywords(articles)

    # Print results
    success = scraper.print_results_summary()

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
        import traceback
        traceback.print_exc()
        exit(1)
