"""
FCC Headlines Scraper Test Script
Tests crawling FCC news headlines without Firecrawl
"""
import sys
import requests
from datetime import datetime
from urllib.parse import urljoin

# Try to import BeautifulSoup, install if missing
try:
    from bs4 import BeautifulSoup
except ImportError:
    print("Installing beautifulsoup4...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "beautifulsoup4", "lxml"])
    from bs4 import BeautifulSoup


def scrape_fcc_headlines(url, limit=10):
    """
    Scrape FCC headlines page and extract article metadata

    Args:
        url: FCC headlines page URL
        limit: Maximum number of articles to extract

    Returns:
        List of article dictionaries with title, url, date, type
    """
    print(f"Fetching: {url}")
    print("="*80)

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }

    try:
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()
        print(f"Status: {response.status_code}")
        print(f"Content length: {len(response.content)} bytes")
        print("="*80)

    except requests.RequestException as e:
        print(f"Error fetching URL: {e}")
        return []

    soup = BeautifulSoup(response.content, 'html.parser')
    articles = []

    # Find article containers (Drupal views-row pattern)
    article_containers = soup.find_all('div', class_='views-row')

    if not article_containers:
        # Try alternative selectors
        article_containers = soup.find_all('article')

    if not article_containers:
        # Try finding by item class
        article_containers = soup.find_all('div', class_=lambda x: x and 'item' in x)

    print(f"\nFound {len(article_containers)} article containers\n")

    for i, container in enumerate(article_containers[:limit], 1):
        article = extract_article_data(container, i)
        if article:
            articles.append(article)
            print_article(article, i)

    return articles


def extract_article_data(container, index):
    """
    Extract article metadata from container element

    Args:
        container: BeautifulSoup element containing article
        index: Article index number

    Returns:
        Dictionary with article data or None
    """
    article = {
        'title': None,
        'url': None,
        'date': None,
        'type': None,
        'description': None
    }

    # Extract title and URL
    # Try h3 > a, h2 > a, or just a with title class
    title_elem = container.find('h3') or container.find('h2') or container.find('div', class_='title')

    if title_elem:
        link = title_elem.find('a')
        if link:
            article['title'] = link.get_text(strip=True)
            href = link.get('href', '')
            article['url'] = urljoin('https://www.fcc.gov', href)

    # If no title found in h3/h2, try finding any link
    if not article['title']:
        link = container.find('a')
        if link:
            article['title'] = link.get_text(strip=True)
            href = link.get('href', '')
            article['url'] = urljoin('https://www.fcc.gov', href)

    # Extract date
    time_elem = container.find('time')
    if time_elem:
        article['date'] = time_elem.get('datetime') or time_elem.get_text(strip=True)
    else:
        # Try finding date in various formats
        date_elem = container.find(class_=lambda x: x and 'date' in x.lower())
        if date_elem:
            article['date'] = date_elem.get_text(strip=True)

    # Extract type/category
    type_elem = container.find('div', class_=lambda x: x and 'type' in x.lower())
    if type_elem:
        article['type'] = type_elem.get_text(strip=True)

    # Extract description/summary if available
    desc_elem = container.find('div', class_=lambda x: x and ('summary' in str(x).lower() or 'description' in str(x).lower()))
    if desc_elem:
        article['description'] = desc_elem.get_text(strip=True)[:200]

    # Only return if we have at least title and URL
    if article['title'] and article['url']:
        return article

    return None


def print_article(article, index):
    """Pretty print article information"""
    print(f"--- Article {index} ---")
    print(f"Title: {article['title']}")
    print(f"URL: {article['url']}")
    if article['date']:
        print(f"Date: {article['date']}")
    if article['type']:
        print(f"Type: {article['type']}")
    if article['description']:
        print(f"Description: {article['description']}")
    print()


def test_pagination(base_url, max_pages=3):
    """
    Test pagination by fetching multiple pages

    Args:
        base_url: Base URL without page parameter
        max_pages: Number of pages to test

    Returns:
        Total number of articles found
    """
    print("\n" + "="*80)
    print("TESTING PAGINATION")
    print("="*80 + "\n")

    all_articles = []

    for page in range(max_pages):
        if '?' in base_url:
            url = f"{base_url}&page={page}"
        else:
            url = f"{base_url}?page={page}"

        print(f"\nPage {page + 1}:")
        print("-"*80)
        articles = scrape_fcc_headlines(url, limit=5)
        all_articles.extend(articles)

        if not articles:
            print(f"No articles found on page {page + 1}, stopping pagination")
            break

    return all_articles


def main():
    """Main test function"""
    print("\n" + "="*80)
    print("FCC HEADLINES SCRAPER TEST")
    print("="*80 + "\n")

    # Test URL with spectrum category filter
    test_url = "https://www.fcc.gov/news-events/headlines?year_released=all&tid%5B541%5D=541&items_per_page=25"

    print(f"Test URL: {test_url}\n")

    # Test 1: Scrape first page
    print("\nTEST 1: First page scraping")
    print("="*80)
    articles = scrape_fcc_headlines(test_url, limit=10)

    print("\n" + "="*80)
    print(f"SUMMARY: Found {len(articles)} articles")
    print("="*80)

    if articles:
        print("\nFirst 3 articles summary:")
        for i, article in enumerate(articles[:3], 1):
            print(f"{i}. {article['title'][:80]}...")
            print(f"   {article['url']}")

    # Test 2: Pagination
    if articles:
        print("\n\nTEST 2: Pagination test")
        all_articles = test_pagination(test_url, max_pages=2)
        print("\n" + "="*80)
        print(f"PAGINATION SUMMARY: Found {len(all_articles)} total articles across pages")
        print("="*80)

    # Test 3: URL variations
    print("\n\nTEST 3: Different URL parameters")
    print("="*80)

    # Test with more items per page
    test_url_50 = test_url.replace("items_per_page=25", "items_per_page=50")
    print(f"\nTesting with 50 items per page:")
    articles_50 = scrape_fcc_headlines(test_url_50, limit=5)
    print(f"Found {len(articles_50)} articles")

    # Save results to file
    print("\n\nSaving results to fcc_scraper_test_results.txt...")
    with open('fcc_scraper_test_results.txt', 'w', encoding='utf-8') as f:
        f.write("FCC Headlines Scraper Test Results\n")
        f.write("="*80 + "\n\n")
        f.write(f"Test Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"Total Articles Found: {len(articles)}\n\n")

        for i, article in enumerate(articles, 1):
            f.write(f"Article {i}\n")
            f.write("-"*80 + "\n")
            f.write(f"Title: {article['title']}\n")
            f.write(f"URL: {article['url']}\n")
            f.write(f"Date: {article['date']}\n")
            f.write(f"Type: {article['type']}\n")
            if article['description']:
                f.write(f"Description: {article['description']}\n")
            f.write("\n")

    print("Results saved!")
    print("\n" + "="*80)
    print("TEST COMPLETE")
    print("="*80)


if __name__ == "__main__":
    main()
