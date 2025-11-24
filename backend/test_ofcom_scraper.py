"""
Ofcom Scraper Test with Firecrawl API

This test file uses Firecrawl API to scrape Ofcom consultations and statements.
Firecrawl bypasses Cloudflare and other bot detection automatically.

Target URL: https://www.ofcom.org.uk/consultations-and-statements
Filters: Topic=Spectrum (67891), Sort=Newest

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


class OfcomFirecrawlScraper:
    """Ofcom scraper using Firecrawl API"""

    def __init__(self):
        self.api_key = os.getenv('FIRECRAWL_API_KEY')
        self.firecrawl_url = 'https://api.firecrawl.dev/v1'
        self.ofcom_url = (
            'https://www.ofcom.org.uk/consultations-and-statements'
            '?query=&SelectedTopic=67891&SelectedSubTopics=&ContentStatus='
            '&UpdatedAfter=&UpdatedBefore=&IncludePDF=true&SortBy=Newest&NumberOfResults=27'
        )
        self.results = {
            'api_test': False,
            'scraping_test': False,
            'articles': []
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

    async def scrape_ofcom_with_firecrawl(self, max_articles: int = 25) -> List[Dict]:
        """
        Scrape Ofcom using Firecrawl API

        Returns list of articles with metadata:
        - title: Document title
        - url: Document URL
        - published_date: Publication date
        - document_type: Type of document
        - status: Open/Closed status
        - snippet: Description
        """
        self.print_header('TEST 2: Scraping Ofcom with Firecrawl')

        articles = []

        try:
            # Longer timeout for Cloudflare-protected sites
            async with httpx.AsyncClient(timeout=180.0) as client:
                self.print_step(f'Scraping: {self.ofcom_url}')
                self.print_info('This may take 60-90 seconds due to Cloudflare protection...')
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
                                'url': self.ofcom_url,
                                'formats': ['html'],
                                'onlyMainContent': False,  # Get full page
                                'waitFor': 5000,  # Wait 5 seconds for JS to load
                                'timeout': 90000,  # 90 seconds timeout (for Cloudflare)
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
                # Note: Ofcom has Cloudflare, so we need longer timeout
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
                with open('backend/ofcom_firecrawl_output.html', 'w', encoding='utf-8') as f:
                    f.write(html_content)
                self.print_info('HTML saved: backend/ofcom_firecrawl_output.html')

                # Parse HTML content with BeautifulSoup
                self.print_step('Parsing HTML content...')
                soup = BeautifulSoup(html_content, 'html.parser')

                # Find all article blocks
                article_blocks = soup.select('div.search-results-block')
                self.print_info(f'Found {len(article_blocks)} article blocks')

                seen_urls = set()

                for block in article_blocks:
                    if len(articles) >= max_articles:
                        break

                    try:
                        # Extract URL from the link
                        link = block.select_one('a')
                        if not link or not link.get('href'):
                            continue

                        url = link.get('href')

                        # Skip duplicates
                        if url in seen_urls:
                            continue
                        seen_urls.add(url)

                        # Extract title from h3.info-card-header
                        title_elem = block.select_one('h3.info-card-header')
                        if not title_elem:
                            continue
                        title = title_elem.get_text(strip=True)

                        # Extract dates from div.serach-date
                        published_date = None
                        last_updated = None
                        pdf_info = None

                        date_div = block.select_one('div.serach-date')
                        if date_div:
                            # Get all paragraphs in the date section
                            date_paragraphs = date_div.select('p')

                            for p in date_paragraphs:
                                text = p.get_text(strip=True)

                                # Check for PDF info
                                if 'PDF file' in text:
                                    pdf_info = text

                                # Check for Published date (format: "Published: 25 March 2025")
                                if text.startswith('Published:'):
                                    published_date = text.replace('Published:', '').strip()

                                # Check for Last updated date (format: "Last updated: 17 November 2025")
                                if text.startswith('Last updated:'):
                                    last_updated = text.replace('Last updated:', '').strip()

                        # Extract snippet from the description paragraph
                        snippet = None
                        # The snippet is usually the last <p> inside info-card
                        info_card = block.select_one('div.info-card')
                        if info_card:
                            # Get all paragraphs, exclude those in serach-date
                            all_paragraphs = info_card.select('p')
                            desc_paragraphs = [p for p in all_paragraphs if not p.find_parent('div', class_='serach-date')]

                            if desc_paragraphs:
                                snippet_text = desc_paragraphs[-1].get_text(strip=True)
                                if snippet_text:
                                    snippet = snippet_text[:300]

                        # Determine document type from title
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
                        elif '.pdf' in title.lower() or pdf_info:
                            doc_type = 'PDF Document'

                        # Use last_updated if available, otherwise published_date
                        final_date = last_updated if last_updated else published_date

                        article = {
                            'title': title,
                            'url': url,
                            'published_date': final_date,
                            'document_type': doc_type,
                            'status': None,  # Not available in current HTML structure
                            'snippet': snippet
                        }

                        articles.append(article)
                        self.print_info(f'[{len(articles)}] {title[:60]}...')

                    except Exception as e:
                        self.print_warning(f'Failed to parse article block: {str(e)}')
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

    def print_results_summary(self):
        """Print comprehensive test results"""
        self.print_header('TEST RESULTS SUMMARY')

        print('Test Results:')
        print(f'  API Connection:        {"PASS" if self.results["api_test"] else "FAIL"}')
        print(f'  Article Scraping:      {"PASS" if self.results["scraping_test"] else "FAIL"}')
        print(f'  Total Articles:        {len(self.results["articles"])}')

        articles = self.results['articles']
        if articles:
            articles_with_date = sum(1 for a in articles if a.get('published_date'))
            articles_with_type = sum(1 for a in articles if a.get('document_type'))
            articles_with_status = sum(1 for a in articles if a.get('status'))
            articles_with_snippet = sum(1 for a in articles if a.get('snippet'))

            print('\nData Quality:')
            print(f'  Articles with dates:   {articles_with_date}/{len(articles)} ({articles_with_date/len(articles)*100:.1f}%)')
            print(f'  Articles with type:    {articles_with_type}/{len(articles)} ({articles_with_type/len(articles)*100:.1f}%)')
            print(f'  Articles with status:  {articles_with_status}/{len(articles)} ({articles_with_status/len(articles)*100:.1f}%)')
            print(f'  Articles with snippet: {articles_with_snippet}/{len(articles)} ({articles_with_snippet/len(articles)*100:.1f}%)')

            print('\nSample Articles (first 5):')
            print('-' * 80)
            for i, article in enumerate(articles[:5], 1):
                print(f'\n{i}. {article["title"]}')
                print(f'   URL: {article["url"]}')
                print(f'   Date: {article["published_date"] or "Not available"}')
                print(f'   Type: {article["document_type"] or "Not available"}')
                print(f'   Status: {article["status"] or "Not available"}')
                if article.get('snippet'):
                    print(f'   Snippet: {article["snippet"][:100]}...')

        all_passed = (
            self.results['api_test'] and
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
    print('*' + '  OFCOM SCRAPER - FIRECRAWL API'.center(78) + '*')
    print('*' + ' ' * 78 + '*')
    print('*' * 80)

    scraper = OfcomFirecrawlScraper()

    # Test API first
    api_ok = await scraper.test_firecrawl_api()

    if not api_ok:
        print('\n[ERROR] Firecrawl API test failed.')
        print('Please check your API key and try again.')
        scraper.print_results_summary()
        return False

    # Scrape Ofcom
    articles = await scraper.scrape_ofcom_with_firecrawl(max_articles=25)

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
