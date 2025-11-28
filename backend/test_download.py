"""Test attachment download with browser headers - standalone version."""
import asyncio
import httpx
from pathlib import Path
from urllib.parse import urlparse

# Browser-like headers for attachment downloads
BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "application/pdf,application/octet-stream,*/*;q=0.9",
    "Accept-Language": "en-US,en;q=0.9,ko;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
}

TEST_URL = "https://www.ofcom.org.uk/siteassets/resources/documents/consultations/category-1-10-weeks/269383-call-for-input-making-more-spectrum-in-the-1.4-ghz-band-available-for-mobile-services/responses-feb-25/nokia.pdf?v=403737"

async def test_download():
    print(f"Testing download: {TEST_URL}")
    print("-" * 60)

    # Build headers with Referer
    headers = BROWSER_HEADERS.copy()
    parsed_url = urlparse(TEST_URL)
    referer = f"{parsed_url.scheme}://{parsed_url.netloc}/"
    headers["Referer"] = referer

    print(f"Using Referer: {referer}")
    print(f"Using User-Agent: {headers['User-Agent'][:50]}...")
    print("-" * 60)

    save_dir = Path("./test_downloads")
    save_dir.mkdir(parents=True, exist_ok=True)

    filename = Path(parsed_url.path).name
    file_path = save_dir / filename

    try:
        async with httpx.AsyncClient(
            timeout=60.0,
            headers=headers,
            follow_redirects=True
        ) as client:
            async with client.stream("GET", TEST_URL) as response:
                print(f"Response status: {response.status_code}")
                print(f"Response headers: {dict(response.headers)}")

                response.raise_for_status()

                total_size = 0
                with open(file_path, "wb") as f:
                    async for chunk in response.aiter_bytes(chunk_size=8192):
                        f.write(chunk)
                        total_size += len(chunk)

        print("-" * 60)
        print("SUCCESS!")
        print(f"  Filename: {filename}")
        print(f"  Size: {total_size} bytes")
        print(f"  Path: {file_path.absolute()}")

    except httpx.HTTPStatusError as e:
        print(f"FAILED: HTTP {e.response.status_code}")
        print(f"Response headers: {dict(e.response.headers)}")
    except Exception as e:
        print(f"FAILED: {type(e).__name__}: {e}")

if __name__ == "__main__":
    asyncio.run(test_download())
