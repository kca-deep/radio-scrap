"""
Multi-Domain Scraper Test Script
Tests crawling for FCC, Soumu, Ofcom, and MSIT
"""
import sys
import re
import requests
from datetime import datetime
from urllib.parse import urljoin, urlparse, parse_qs

try:
    from bs4 import BeautifulSoup
except ImportError:
    print("Installing beautifulsoup4...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "beautifulsoup4", "lxml"])
    from bs4 import BeautifulSoup


# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def clean_date(date_str):
    """
    Clean and parse date string to datetime object

    Examples:
        "September 30, 2025FNPRM..." -> datetime(2025, 9, 30)
        "2025-09-11" -> datetime(2025, 9, 11)
        "2025.09.11" -> datetime(2025, 9, 11)
    """
    if not date_str:
        return None

    # Remove trailing garbage text
    date_str = date_str.strip()

    # Pattern: "September 30, 2025FNPRM..."
    match = re.match(r'([A-Za-z]+ \d{1,2}, \d{4})', date_str)
    if match:
        try:
            return datetime.strptime(match.group(1), '%B %d, %Y')
        except ValueError:
            pass

    # Pattern: "2025-09-11"
    match = re.match(r'(\d{4}-\d{2}-\d{2})', date_str)
    if match:
        try:
            return datetime.strptime(match.group(1), '%Y-%m-%d')
        except ValueError:
            pass

    # Pattern: "2025.09.11"
    match = re.match(r'(\d{4}\.\d{2}\.\d{2})', date_str)
    if match:
        try:
            return datetime.strptime(match.group(1), '%Y.%m.%d')
        except ValueError:
            pass

    # Pattern: "11 September 2025"
    match = re.match(r'(\d{1,2} [A-Za-z]+ \d{4})', date_str)
    if match:
        try:
            return datetime.strptime(match.group(1), '%d %B %Y')
        except ValueError:
            pass

    return None


def extract_document_type(text):
    """
    Extract document type from text

    Examples:
        "September 30, 2025FNPRMFCC..." -> "FNPRM"
        "News ReleaseChairman..." -> "News Release"
    """
    if not text:
        return None

    types = [
        'FNPRM',
        'Notice of Proposed Rulemaking',
        'News Release',
        'Order',
        'Order on Reconsideration',
        'Public Notice',
        'Notice of Inquiry',
        'Declaratory Ruling',
        'Report and Order',
        'Consultation',
        'Statement',
        'Call for Input'
    ]

    for doc_type in types:
        if doc_type in text:
            return doc_type

    return None


def make_request(url, headers=None, timeout=15):
    """Make HTTP request with error handling"""
    if headers is None:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        }

    try:
        response = requests.get(url, headers=headers, timeout=timeout)
        response.raise_for_status()
        return response
    except requests.RequestException as e:
        print(f"Error fetching {url}: {e}")
        return None


# ============================================================================
# FCC SCRAPER (US)
# ============================================================================

def scrape_fcc(limit=10):
    """
    Scrape FCC headlines
    URL: https://www.fcc.gov/news-events/headlines
    """
    print("\n" + "="*80)
    print("FCC (United States) - Spectrum Headlines")
    print("="*80)

    url = "https://www.fcc.gov/news-events/headlines?year_released=all&tid%5B541%5D=541&items_per_page=50"

    response = make_request(url, timeout=30)
    if not response:
        return []

    soup = BeautifulSoup(response.content, 'html.parser')
    articles = []

    article_containers = soup.find_all('div', class_='views-row')
    print(f"Found {len(article_containers)} containers")

    for i, container in enumerate(article_containers[:limit], 1):
        # Extract title and URL - try multiple approaches
        title_elem = container.find('h3') or container.find('h2') or container.find('div', class_='title')

        if not title_elem:
            # Try finding any link in the container
            link = container.find('a')
        else:
            link = title_elem.find('a')

        if not link:
            continue

        title = link.get_text(strip=True)
        if not title:
            continue

        href = link.get('href', '')
        article_url = urljoin('https://www.fcc.gov', href)

        # Extract date - try multiple selectors
        date_str = None
        date_elem = container.find('time')
        if date_elem:
            date_str = date_elem.get('datetime') or date_elem.get_text(strip=True)
        else:
            # Try finding date in div with class containing 'date'
            date_div = container.find('div', class_=lambda x: x and 'date' in str(x).lower())
            if date_div:
                date_str = date_div.get_text(strip=True)

        date_obj = clean_date(date_str) if date_str else None

        # Extract type - try to find in text
        doc_type = None
        full_text = container.get_text()
        doc_type = extract_document_type(full_text)

        articles.append({
            'title': title,
            'url': article_url,
            'date': date_obj,
            'date_str': date_obj.strftime('%Y-%m-%d') if date_obj else (date_str or 'N/A'),
            'type': doc_type or 'Document',
            'source': 'FCC',
            'country_code': 'US'
        })

    return articles


# ============================================================================
# SOUMU SCRAPER (Japan)
# ============================================================================

def scrape_soumu(limit=10):
    """
    Scrape Soumu (Japan Ministry of Internal Affairs) news
    URL: https://www.soumu.go.jp/menu_news/s-news/index.html
    """
    print("\n" + "="*80)
    print("Soumu (Japan) - Ministry News")
    print("="*80)

    url = "https://www.soumu.go.jp/menu_news/s-news/index.html"

    response = make_request(url)
    if not response:
        return []

    response.encoding = 'utf-8'
    soup = BeautifulSoup(response.content, 'html.parser')
    articles = []

    # Find news list (usually in a table or list)
    # Soumu uses <ul class="topics"> or <div class="list">
    news_items = soup.find_all('li', class_='topics') or soup.find_all('div', class_='list')

    if not news_items:
        # Try finding links in news section
        news_section = soup.find('div', id='news') or soup.find('div', class_='news')
        if news_section:
            news_items = news_section.find_all('li') or news_section.find_all('a')

    print(f"Found {len(news_items)} articles")

    for i, item in enumerate(news_items[:limit], 1):
        link = item.find('a')
        if not link:
            continue

        title = link.get_text(strip=True)
        href = link.get('href', '')
        article_url = urljoin('https://www.soumu.go.jp', href)

        # Extract date (usually in format: 2025.09.11 or 令和7年9月11日)
        date_elem = item.find('time') or item.find('span', class_='date')
        date_str = None
        if date_elem:
            date_str = date_elem.get_text(strip=True)
        else:
            # Try to find date in text
            text = item.get_text()
            date_match = re.search(r'(\d{4}\.\d{1,2}\.\d{1,2})', text)
            if date_match:
                date_str = date_match.group(1)

        date_obj = clean_date(date_str) if date_str else None

        articles.append({
            'title': title,
            'url': article_url,
            'date': date_obj,
            'date_str': date_obj.strftime('%Y-%m-%d') if date_obj else date_str,
            'type': 'Press Release',
            'source': 'Soumu',
            'country_code': 'JP'
        })

    return articles


# ============================================================================
# OFCOM SCRAPER (UK)
# ============================================================================

def scrape_ofcom(limit=10):
    """
    Scrape Ofcom (UK) spectrum news
    URL: https://www.ofcom.org.uk/spectrum
    """
    print("\n" + "="*80)
    print("Ofcom (United Kingdom) - Spectrum News")
    print("="*80)

    # Ofcom has multiple sections, try spectrum main page
    url = "https://www.ofcom.org.uk/spectrum"

    response = make_request(url)
    if not response:
        return []

    soup = BeautifulSoup(response.content, 'html.parser')
    articles = []

    # Find article links (Ofcom uses various structures)
    # Try: article tags, news items, or links in main content
    article_containers = soup.find_all('article') or soup.find_all('div', class_='news-item')

    if not article_containers:
        # Try finding links in spectrum section
        main_content = soup.find('main') or soup.find('div', class_='content')
        if main_content:
            article_containers = main_content.find_all('a', href=re.compile(r'/spectrum/'))

    print(f"Found {len(article_containers)} articles")

    seen_urls = set()

    for container in article_containers:
        if len(articles) >= limit:
            break

        # Extract link
        if container.name == 'a':
            link = container
        else:
            link = container.find('a')

        if not link:
            continue

        title = link.get_text(strip=True)
        href = link.get('href', '')
        article_url = urljoin('https://www.ofcom.org.uk', href)

        # Skip duplicates
        if article_url in seen_urls:
            continue
        seen_urls.add(article_url)

        # Extract date
        date_elem = container.find('time') if container.name != 'a' else None
        date_str = None
        if date_elem:
            date_str = date_elem.get('datetime') or date_elem.get_text(strip=True)

        date_obj = clean_date(date_str) if date_str else None

        # Extract type
        doc_type = None
        if 'consultation' in title.lower():
            doc_type = 'Consultation'
        elif 'statement' in title.lower():
            doc_type = 'Statement'
        elif 'call for input' in title.lower():
            doc_type = 'Call for Input'

        articles.append({
            'title': title,
            'url': article_url,
            'date': date_obj,
            'date_str': date_obj.strftime('%Y-%m-%d') if date_obj else date_str,
            'type': doc_type,
            'source': 'Ofcom',
            'country_code': 'UK'
        })

    return articles


# ============================================================================
# MSIT SCRAPER (Korea)
# ============================================================================

def scrape_msit(limit=10):
    """
    Scrape MSIT (Korea Ministry of Science and ICT) news
    URL: https://www.msit.go.kr/bbs/list.do
    """
    print("\n" + "="*80)
    print("MSIT (Korea) - Press Releases")
    print("="*80)

    # Board list page
    url = "https://www.msit.go.kr/bbs/list.do?sCode=user&mId=113&mPid=238&bbsSeqNo=94"

    response = make_request(url)
    if not response:
        return []

    response.encoding = 'utf-8'
    soup = BeautifulSoup(response.content, 'html.parser')
    articles = []

    # Find board table rows
    board_rows = soup.find_all('tr')

    print(f"Found {len(board_rows)} rows")

    for row in board_rows:
        if len(articles) >= limit:
            break

        # Find title link
        title_cell = row.find('td', class_='left') or row.find('div', class_='subject')
        if not title_cell:
            continue

        link = title_cell.find('a')
        if not link:
            continue

        title = link.get_text(strip=True)
        onclick = link.get('onclick', '')

        # Parse nttSeqNo from onclick
        ntt_match = re.search(r'nttSeqNo=(\d+)', onclick)
        if not ntt_match:
            href = link.get('href', '')
            ntt_match = re.search(r'nttSeqNo=(\d+)', href)

        if not ntt_match:
            continue

        ntt_seq_no = ntt_match.group(1)
        article_url = f"https://www.msit.go.kr/bbs/view.do?sCode=user&mId=113&mPid=238&bbsSeqNo=94&nttSeqNo={ntt_seq_no}"

        # Extract date
        date_cell = row.find('td', class_='date') or row.find('span', class_='date')
        date_str = None
        if date_cell:
            date_str = date_cell.get_text(strip=True)

        date_obj = clean_date(date_str) if date_str else None

        articles.append({
            'title': title,
            'url': article_url,
            'date': date_obj,
            'date_str': date_obj.strftime('%Y-%m-%d') if date_obj else date_str,
            'type': 'Press Release',
            'source': 'MSIT',
            'country_code': 'KR'
        })

    return articles


# ============================================================================
# MAIN TEST FUNCTION
# ============================================================================

def print_articles(articles, source_name):
    """Pretty print articles"""
    print(f"\n{source_name} Results: {len(articles)} articles")
    print("-"*80)

    for i, article in enumerate(articles, 1):
        print(f"\n{i}. {article['title'][:80]}")
        print(f"   URL: {article['url']}")
        print(f"   Date: {article['date_str']}")
        if article['type']:
            print(f"   Type: {article['type']}")
        print(f"   Source: {article['source']} ({article['country_code']})")


def save_results(all_results):
    """Save all results to file"""
    filename = 'multi_domain_scraper_results.txt'

    with open(filename, 'w', encoding='utf-8') as f:
        f.write("Multi-Domain Scraper Test Results\n")
        f.write("="*80 + "\n\n")
        f.write(f"Test Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")

        for source, articles in all_results.items():
            f.write(f"\n{'='*80}\n")
            f.write(f"{source}: {len(articles)} articles\n")
            f.write(f"{'='*80}\n\n")

            for i, article in enumerate(articles, 1):
                f.write(f"Article {i}\n")
                f.write("-"*80 + "\n")
                f.write(f"Title: {article['title']}\n")
                f.write(f"URL: {article['url']}\n")
                f.write(f"Date: {article['date_str']}\n")
                f.write(f"Type: {article['type']}\n")
                f.write(f"Source: {article['source']} ({article['country_code']})\n\n")

        total = sum(len(articles) for articles in all_results.values())
        f.write(f"\n{'='*80}\n")
        f.write(f"TOTAL: {total} articles across {len(all_results)} sources\n")
        f.write(f"{'='*80}\n")

    print(f"\nResults saved to {filename}")


def main():
    """Main test function"""
    print("\n" + "="*80)
    print("MULTI-DOMAIN SCRAPER TEST")
    print("Testing: FCC (US), Soumu (JP), Ofcom (UK), MSIT (KR)")
    print("="*80)

    all_results = {}

    # Test each scraper
    try:
        fcc_articles = scrape_fcc(limit=10)
        all_results['FCC'] = fcc_articles
        print_articles(fcc_articles, 'FCC')
    except Exception as e:
        print(f"\nFCC scraper error: {e}")
        all_results['FCC'] = []

    try:
        soumu_articles = scrape_soumu(limit=10)
        all_results['Soumu'] = soumu_articles
        print_articles(soumu_articles, 'Soumu')
    except Exception as e:
        print(f"\nSoumu scraper error: {e}")
        all_results['Soumu'] = []

    try:
        ofcom_articles = scrape_ofcom(limit=10)
        all_results['Ofcom'] = ofcom_articles
        print_articles(ofcom_articles, 'Ofcom')
    except Exception as e:
        print(f"\nOfcom scraper error: {e}")
        all_results['Ofcom'] = []

    try:
        msit_articles = scrape_msit(limit=10)
        all_results['MSIT'] = msit_articles
        print_articles(msit_articles, 'MSIT')
    except Exception as e:
        print(f"\nMSIT scraper error: {e}")
        all_results['MSIT'] = []

    # Summary
    print("\n\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)

    for source, articles in all_results.items():
        status = "OK" if articles else "FAILED"
        print(f"{source:15} {len(articles):3} articles  [{status}]")

    total = sum(len(articles) for articles in all_results.values())
    print("-"*80)
    print(f"{'TOTAL':15} {total:3} articles")

    # Save results
    save_results(all_results)

    print("\n" + "="*80)
    print("TEST COMPLETE")
    print("="*80 + "\n")


if __name__ == "__main__":
    main()
