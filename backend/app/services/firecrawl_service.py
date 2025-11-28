"""
Firecrawl API service for web scraping.
Handles URL scraping, attachment extraction, and file downloads.
"""
import asyncio
import logging
import re
from datetime import datetime
from pathlib import Path
from typing import Optional
from urllib.parse import urljoin, urlparse
from unicodedata import normalize

import httpx
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type
)

from app.config import settings

logger = logging.getLogger(__name__)

# Firecrawl API configuration
FIRECRAWL_API_URL = "https://api.firecrawl.dev/v1"
FIRECRAWL_TIMEOUT = 60.0  # seconds
FIRECRAWL_TIMEOUT_CLOUDFLARE = 180.0  # seconds (for Cloudflare-protected sites)

# Cloudflare-protected domains that need special handling
CLOUDFLARE_PROTECTED_DOMAINS = [
    "ofcom.org.uk",
]

# Attachment file extensions
ATTACHMENT_EXTENSIONS = {
    '.pdf', '.doc', '.docx', '.xls', '.xlsx',
    '.ppt', '.pptx', '.zip', '.rar', '.7z',
    '.txt', '.csv', '.json', '.xml'
}

# Rate limiting semaphore (max 3 concurrent requests)
_scrape_semaphore = asyncio.Semaphore(3)


def sanitize_filename(filename: str) -> str:
    """
    Sanitize filename by removing/replacing invalid characters.

    Args:
        filename: Original filename

    Returns:
        Sanitized filename safe for filesystem

    Examples:
        >>> sanitize_filename("report:2024.pdf")
        'report_2024.pdf'
        >>> sanitize_filename("file<>name.txt")
        'file__name.txt'
    """
    # Normalize unicode characters
    filename = normalize('NFKD', filename).encode('ascii', 'ignore').decode('ascii')

    # Replace invalid characters with underscore
    filename = re.sub(r'[<>:"/\\|?*]', '_', filename)

    # Remove leading/trailing dots and spaces
    filename = filename.strip('. ')

    # Limit length
    if len(filename) > 200:
        name, ext = Path(filename).stem, Path(filename).suffix
        filename = name[:200 - len(ext)] + ext

    return filename if filename else 'unnamed_file'


def sanitize_folder_name(name: str) -> str:
    """
    Sanitize folder name for filesystem compatibility.
    Preserves Unicode characters (Korean, Japanese, etc.) but removes
    filesystem-invalid characters.

    Args:
        name: Original folder name

    Returns:
        Sanitized folder name safe for filesystem

    Examples:
        >>> sanitize_folder_name("FCC/News")
        'FCC_News'
        >>> sanitize_folder_name("SOUMU")
        'SOUMU'
    """
    if not name:
        return "UNKNOWN"

    # Replace filesystem-invalid characters with underscore
    # Windows invalid chars: < > : " / \ | ? *
    sanitized = re.sub(r'[<>:"/\\|?*]', '_', name)

    # Replace multiple underscores with single
    sanitized = re.sub(r'_+', '_', sanitized)

    # Remove leading/trailing underscores and spaces
    sanitized = sanitized.strip('_ ')

    # Limit length to 50 chars for folder names
    if len(sanitized) > 50:
        sanitized = sanitized[:50].rstrip('_ ')

    return sanitized if sanitized else "UNKNOWN"


def build_attachment_path(
    base_dir: str | Path,
    article_id: str,
    country_code: Optional[str] = None,
    source: Optional[str] = None,
    published_date: Optional[datetime] = None
) -> Path:
    """
    Build hierarchical attachment storage path.

    Structure: {base_dir}/{country_code}/{source}/{YYYY-MM}/{article_id}/

    Args:
        base_dir: Base attachment directory
        article_id: Article UUID
        country_code: Country code (US, UK, JP, KR)
        source: Source organization name
        published_date: Article publication date

    Returns:
        Path object for the attachment directory

    Examples:
        >>> build_attachment_path(
        ...     "./storage/attachments",
        ...     "abc-123",
        ...     "US",
        ...     "FCC",
        ...     datetime(2024, 1, 15)
        ... )
        PosixPath('storage/attachments/US/FCC/2024-01/abc-123')
    """
    base = Path(base_dir)

    # Handle None values
    country = sanitize_folder_name(country_code) if country_code else "UNKNOWN"
    src = sanitize_folder_name(source) if source else "UNKNOWN"

    # Format date as YYYY-MM
    if published_date:
        if isinstance(published_date, datetime):
            date_folder = published_date.strftime("%Y-%m")
        else:
            # Handle date object
            date_folder = published_date.strftime("%Y-%m")
    else:
        date_folder = "NO_DATE"

    # Build path: base/country/source/YYYY-MM/article_id
    attachment_path = base / country / src / date_folder / article_id

    return attachment_path


def _is_cloudflare_protected(url: str) -> bool:
    """Check if URL belongs to a Cloudflare-protected domain."""
    parsed = urlparse(url)
    domain = parsed.netloc.lower()
    return any(cf_domain in domain for cf_domain in CLOUDFLARE_PROTECTED_DOMAINS)


@retry(
    retry=retry_if_exception_type((httpx.TimeoutException, httpx.HTTPStatusError)),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=4, max=60)
)
async def scrape_url(url: str) -> dict:
    """
    Scrape a URL using Firecrawl API.

    Args:
        url: Target URL to scrape

    Returns:
        Dictionary with:
        - markdown: str (scraped content in markdown)
        - metadata: dict (title, description, etc.)
        - html: str (raw HTML, optional)
        - links: list[str] (extracted links, optional)

    Raises:
        httpx.HTTPStatusError: If API returns error status
        httpx.TimeoutException: If request times out
        ValueError: If API response is invalid

    Examples:
        >>> result = await scrape_url("https://example.com")
        >>> result['markdown']
        '# Example Domain\\n\\nThis domain is for use in illustrative...'
    """
    async with _scrape_semaphore:
        # Check if URL needs Cloudflare-specific handling
        is_cloudflare = _is_cloudflare_protected(url)
        timeout = FIRECRAWL_TIMEOUT_CLOUDFLARE if is_cloudflare else FIRECRAWL_TIMEOUT

        if is_cloudflare:
            logger.info(f"Scraping URL (Cloudflare mode): {url}")
        else:
            logger.info(f"Scraping URL: {url}")

        transport = httpx.AsyncHTTPTransport(retries=1)
        async with httpx.AsyncClient(
            transport=transport,
            timeout=timeout
        ) as client:
            headers = {
                "Authorization": f"Bearer {settings.FIRECRAWL_API_KEY}",
                "Content-Type": "application/json"
            }

            # Use different payload for Cloudflare-protected sites
            if is_cloudflare:
                payload = {
                    "url": url,
                    "formats": ["markdown", "html"],
                    "onlyMainContent": False,
                    "waitFor": 5000,
                    "timeout": 90000,
                    "mobile": False,
                }
            else:
                payload = {
                    "url": url,
                    "formats": ["markdown", "html"],
                    "onlyMainContent": True
                }

            try:
                response = await client.post(
                    f"{FIRECRAWL_API_URL}/scrape",
                    json=payload,
                    headers=headers
                )

                response.raise_for_status()
                data = response.json()

                # Validate response structure
                if not data.get("success"):
                    error_msg = data.get("error", "Unknown error")
                    raise ValueError(f"Firecrawl API error: {error_msg}")

                result = data.get("data", {})

                logger.info(f"Successfully scraped {url} ({len(result.get('markdown', ''))} chars)")

                return {
                    "markdown": result.get("markdown", ""),
                    "metadata": result.get("metadata", {}),
                    "html": result.get("html", ""),
                    "links": result.get("links", [])
                }

            except httpx.HTTPStatusError as e:
                if e.response.status_code == 401:
                    logger.error("Firecrawl API authentication failed. Check API key.")
                elif e.response.status_code == 429:
                    logger.warning("Firecrawl API rate limit exceeded. Retrying...")
                logger.error(f"HTTP error scraping {url}: {e}")
                raise

            except httpx.TimeoutException as e:
                logger.error(f"Timeout scraping {url}: {e}")
                raise

            except Exception as e:
                logger.error(f"Unexpected error scraping {url}: {e}")
                raise


async def extract_attachment_links(html: str, base_url: str) -> list[dict]:
    """
    Extract attachment links from HTML content.

    Args:
        html: HTML content
        base_url: Base URL for resolving relative links

    Returns:
        List of dictionaries with:
        - url: str (absolute URL)
        - filename: str (extracted from URL)
        - extension: str (file extension)

    Examples:
        >>> links = await extract_attachment_links(
        ...     '<a href="report.pdf">Download</a>',
        ...     'https://example.com'
        ... )
        >>> links[0]['url']
        'https://example.com/report.pdf'
    """
    if not html:
        return []

    # Regex to find href attributes
    href_pattern = re.compile(r'href=["\'](.*?)["\']', re.IGNORECASE)
    matches = href_pattern.findall(html)

    attachments = []

    for link in matches:
        # Skip anchors, mailto, tel, etc.
        if link.startswith(('#', 'mailto:', 'tel:', 'javascript:')):
            continue

        # Convert to absolute URL
        absolute_url = urljoin(base_url, link)

        # Parse URL
        parsed = urlparse(absolute_url)
        path = parsed.path

        # Check if URL points to a file
        ext = Path(path).suffix.lower()

        if ext in ATTACHMENT_EXTENSIONS:
            filename = Path(path).name or f"attachment{ext}"

            attachments.append({
                "url": absolute_url,
                "filename": sanitize_filename(filename),
                "extension": ext
            })

    logger.info(f"Extracted {len(attachments)} attachment links from HTML")

    # Remove duplicates based on URL
    seen_urls = set()
    unique_attachments = []
    for att in attachments:
        if att['url'] not in seen_urls:
            seen_urls.add(att['url'])
            unique_attachments.append(att)

    return unique_attachments


async def download_attachment(
    url: str,
    base_dir: str | Path,
    article_id: str,
    country_code: Optional[str] = None,
    source: Optional[str] = None,
    published_date: Optional[datetime] = None
) -> dict:
    """
    Download attachment file from URL with hierarchical folder structure.

    Storage structure: {base_dir}/{country_code}/{source}/{YYYY-MM}/{article_id}/

    Args:
        url: Attachment URL
        base_dir: Base attachment directory
        article_id: Article UUID for folder organization
        country_code: Country code (US, UK, JP, KR) - optional
        source: Source organization name - optional
        published_date: Article publication date - optional

    Returns:
        Dictionary with:
        - filename: str (saved filename)
        - file_path: str (absolute path)
        - file_url: str (original URL)
        - size: int (file size in bytes)

    Raises:
        httpx.HTTPStatusError: If download fails
        OSError: If file cannot be saved

    Examples:
        >>> result = await download_attachment(
        ...     "https://example.com/report.pdf",
        ...     "./storage/attachments",
        ...     "abc-123-uuid",
        ...     country_code="US",
        ...     source="FCC",
        ...     published_date=datetime(2024, 1, 15)
        ... )
        >>> result['filename']
        'report.pdf'
        >>> # Saved to: ./storage/attachments/US/FCC/2024-01/abc-123-uuid/report.pdf
    """
    # Build hierarchical save directory
    save_dir = build_attachment_path(
        base_dir=base_dir,
        article_id=article_id,
        country_code=country_code,
        source=source,
        published_date=published_date
    )
    save_dir.mkdir(parents=True, exist_ok=True)

    # Extract filename from URL
    parsed = urlparse(url)
    filename = Path(parsed.path).name

    if not filename:
        # Generate filename from URL hash
        import hashlib
        url_hash = hashlib.md5(url.encode()).hexdigest()[:8]
        filename = f"attachment_{url_hash}"

    filename = sanitize_filename(filename)

    # Handle duplicate filenames within the same article folder
    file_path = save_dir / filename
    counter = 1
    while file_path.exists():
        stem = Path(filename).stem
        ext = Path(filename).suffix
        filename = f"{stem}_{counter}{ext}"
        file_path = save_dir / filename
        counter += 1

    logger.info(f"Downloading attachment: {url} -> {file_path}")

    try:
        async with httpx.AsyncClient(timeout=FIRECRAWL_TIMEOUT) as client:
            async with client.stream("GET", url) as response:
                response.raise_for_status()

                total_size = 0

                with open(file_path, "wb") as f:
                    async for chunk in response.aiter_bytes(chunk_size=8192):
                        f.write(chunk)
                        total_size += len(chunk)

        logger.info(f"Downloaded {filename} ({total_size} bytes)")

        return {
            "filename": filename,
            "file_path": str(file_path.absolute()),
            "file_url": url,
            "size": total_size
        }

    except httpx.HTTPStatusError as e:
        logger.error(f"Failed to download {url}: HTTP {e.response.status_code}")
        raise

    except OSError as e:
        logger.error(f"Failed to save file {file_path}: {e}")
        raise

    except Exception as e:
        logger.error(f"Unexpected error downloading {url}: {e}")
        raise
