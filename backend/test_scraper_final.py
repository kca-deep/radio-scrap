"""
Final Multi-Domain Scraper Test
Simplified version with working scrapers
"""
import sys
import re
import requests
from datetime import datetime
from urllib.parse import urljoin

try:
    from bs4 import BeautifulSoup
except ImportError:
    print("Installing beautifulsoup4...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "beautifulsoup4"])
    from bs4 import BeautifulSoup


def clean_date(date_str):
    """Parse various date formats"""
    if not date_str:
        return None

    date_str = date_str.strip()

    # "September 30, 2025"
    match = re.match(r'([A-Za-z]+ \d{1,2}, \d{4})', date_str)
    if match:
        try:
            return datetime.strptime(match.group(1), '%B %d, %Y')
        except:
            pass

    # "2025-09-11" or "2025.09.11"
    match = re.match(r'(\d{4}[-\.]\d{1,2}[-\.]\d{1,2})', date_str)
    if match:
        try:
            date_clean = match.group(1).replace('.', '-')
            return datetime.strptime(date_clean, '%Y-%m-%d')
        except:
            pass

    return None


def extract_document_type(text):
    """Extract document type from text"""
    types = ['FNPRM', 'Notice of Proposed Rulemaking', 'News Release',
             'Order', 'Public Notice', 'Notice of Inquiry', 'Consultation',
             'Statement', 'Report and Order']

    for doc_type in types:
        if doc_type in text:
            return doc_type
    return None


# ============================================================================
# SCRAPERS
# ============================================================================

def scrape_fcc(limit=10):
    """Scrape FCC headlines"""
    print("\n" + "="*80)
    print("FCC (US) - Testing")
    print("="*80)

    url = "https://www.fcc.gov/news-events/headlines?year_released=all&tid%5B541%5D=541&items_per_page=50"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }

    try:
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()
    except Exception as e:
        print(f"Error: {e}")
        return []

    soup = BeautifulSoup(response.content, 'html.parser')
    containers = soup.find_all('div', class_='views-row')
    print(f"Found {len(containers)} containers")

    articles = []
    for container in containers[:limit]:
        title_elem = container.find('h3') or container.find('h2')
        if not title_elem:
            continue

        link = title_elem.find('a')
        if not link:
            continue

        title = link.get_text(strip=True)
        href = link.get('href', '')
        article_url = urljoin('https://www.fcc.gov', href)

        # Date
        date_elem = container.find('time')
        date_str = date_elem.get_text(strip=True) if date_elem else None
        date_obj = clean_date(date_str)

        # Type
        full_text = container.get_text()
        doc_type = extract_document_type(full_text)

        articles.append({
            'title': title,
            'url': article_url,
            'date': date_obj.strftime('%Y-%m-%d') if date_obj else 'N/A',
            'type': doc_type or 'Document',
            'source': 'FCC',
            'country': 'US'
        })

    return articles


def main():
    """Run test"""
    print("\n" + "="*80)
    print("MULTI-DOMAIN SCRAPER - FINAL TEST")
    print("="*80)

    # Test FCC
    fcc_articles = scrape_fcc(limit=15)

    print("\n\nRESULTS:")
    print("="*80)
    print(f"FCC: {len(fcc_articles)} articles\n")

    for i, article in enumerate(fcc_articles[:10], 1):
        print(f"{i}. [{article['date']}] {article['title'][:70]}")
        print(f"   {article['url']}")
        print(f"   Type: {article['type']}\n")

    # Save to file
    with open('final_scraper_results.txt', 'w', encoding='utf-8') as f:
        f.write("Final Scraper Test Results\n")
        f.write("="*80 + "\n\n")
        f.write(f"Test Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"Total Articles: {len(fcc_articles)}\n\n")

        for i, article in enumerate(fcc_articles, 1):
            f.write(f"\nArticle {i}\n")
            f.write("-"*80 + "\n")
            f.write(f"Title: {article['title']}\n")
            f.write(f"URL: {article['url']}\n")
            f.write(f"Date: {article['date']}\n")
            f.write(f"Type: {article['type']}\n")
            f.write(f"Source: {article['source']} ({article['country']})\n")

    print("\nResults saved to final_scraper_results.txt")
    print("\n" + "="*80)
    print("TEST COMPLETE")
    print("="*80 + "\n")


if __name__ == "__main__":
    main()
