"""
Translator service for content extraction and translation.
Uses OpenAI API for 2-stage processing: extraction (cleaning) and translation.

Stage 1 (Extract): Raw markdown -> Cleaned markdown text
Stage 2 (Translate): Cleaned content -> Korean translation
"""
import asyncio
import json
import logging
from functools import lru_cache
from pathlib import Path
from typing import Optional

import httpx
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type
)

from app.config import settings

logger = logging.getLogger(__name__)

# OpenAI API configuration
OPENAI_API_URL = "https://api.openai.com/v1/chat/completions"
OPENAI_TIMEOUT = 120.0  # seconds (longer for translation tasks)

# Rate limiting semaphore (max 2 concurrent requests)
_translate_semaphore = asyncio.Semaphore(2)

# Prompt file mapping by source
PROMPT_MAPPING = {
    "FCC": "PROMPT_EXTRACT_FCC",
    "Soumu": "PROMPT_EXTRACT_SOUMU",
    "Ofcom": "PROMPT_EXTRACT_OFCOM",
}


@lru_cache(maxsize=10)
def _load_prompt_file(file_path: str) -> str:
    """
    Load prompt content from file with caching.

    Args:
        file_path: Path to prompt file (relative to backend directory)

    Returns:
        Prompt content as string

    Raises:
        FileNotFoundError: If prompt file does not exist
    """
    # Resolve path relative to backend directory
    backend_dir = Path(__file__).parent.parent.parent
    full_path = backend_dir / file_path

    if not full_path.exists():
        raise FileNotFoundError(f"Prompt file not found: {full_path}")

    with open(full_path, "r", encoding="utf-8") as f:
        content = f.read()

    logger.debug(f"Loaded prompt from {full_path} ({len(content)} chars)")
    return content


def get_extract_prompt(source: str) -> str:
    """
    Get extraction prompt based on article source.

    Args:
        source: Article source (FCC, Soumu, Ofcom, etc.)

    Returns:
        Extraction prompt content
    """
    # Get prompt setting name from mapping
    setting_name = PROMPT_MAPPING.get(source, "PROMPT_EXTRACT_DEFAULT")

    # Get file path from settings
    file_path = getattr(settings, setting_name, settings.PROMPT_EXTRACT_DEFAULT)

    return _load_prompt_file(file_path)


def get_translate_prompt() -> str:
    """
    Get translation prompt.

    Returns:
        Translation prompt content
    """
    return _load_prompt_file(settings.PROMPT_TRANSLATE)


@retry(
    retry=retry_if_exception_type((httpx.TimeoutException, httpx.HTTPStatusError)),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=4, max=60)
)
async def _call_openai_api(
    system_prompt: str,
    user_content: str,
    response_format: Optional[dict] = None
) -> str:
    """
    Call OpenAI API with given prompts.

    Args:
        system_prompt: System prompt
        user_content: User message content
        response_format: Optional response format (e.g., {"type": "json_object"})

    Returns:
        Assistant response content

    Raises:
        httpx.HTTPStatusError: If API returns error status
        httpx.TimeoutException: If request times out
        ValueError: If API response is invalid
    """
    async with _translate_semaphore:
        logger.debug(f"Calling OpenAI API (model: {settings.OPENAI_MODEL})")

        async with httpx.AsyncClient(timeout=OPENAI_TIMEOUT) as client:
            headers = {
                "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
                "Content-Type": "application/json"
            }

            payload = {
                "model": settings.OPENAI_MODEL,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content}
                ],
                "temperature": 0.3,  # Lower temperature for more consistent output
            }

            if response_format:
                payload["response_format"] = response_format

            try:
                response = await client.post(
                    OPENAI_API_URL,
                    json=payload,
                    headers=headers
                )

                response.raise_for_status()
                data = response.json()

                # Extract response content
                choices = data.get("choices", [])
                if not choices:
                    raise ValueError("OpenAI API returned no choices")

                content = choices[0].get("message", {}).get("content", "")

                if not content:
                    raise ValueError("OpenAI API returned empty content")

                logger.debug(f"OpenAI API response received ({len(content)} chars)")
                return content

            except httpx.HTTPStatusError as e:
                if e.response.status_code == 401:
                    logger.error("OpenAI API authentication failed. Check API key.")
                elif e.response.status_code == 429:
                    logger.warning("OpenAI API rate limit exceeded. Retrying...")
                elif e.response.status_code == 400:
                    error_detail = e.response.json().get("error", {}).get("message", "")
                    logger.error(f"OpenAI API bad request: {error_detail}")
                logger.error(f"HTTP error calling OpenAI API: {e}")
                raise

            except httpx.TimeoutException as e:
                logger.error(f"Timeout calling OpenAI API: {e}")
                raise

            except Exception as e:
                logger.error(f"Unexpected error calling OpenAI API: {e}")
                raise


async def extract_content(content_raw: str, source: str) -> str:
    """
    Extract and clean content using source-specific prompt.

    Args:
        content_raw: Raw markdown content from Firecrawl
        source: Article source (FCC, Soumu, Ofcom, etc.)

    Returns:
        Cleaned markdown text (not JSON)

    Raises:
        ValueError: If extraction fails

    Examples:
        >>> cleaned = await extract_content(raw_markdown, "FCC")
        >>> print(cleaned[:100])
        '**Document Type:** Public Notice...'
    """
    logger.info(f"Extracting content for source: {source}")

    system_prompt = get_extract_prompt(source)

    try:
        # No JSON format - expect plain text response
        response = await _call_openai_api(
            system_prompt=system_prompt,
            user_content=content_raw
        )

        # Response is plain markdown text
        cleaned_content = response.strip()

        if not cleaned_content:
            raise ValueError("Extraction returned empty content")

        logger.info(f"Content extracted successfully ({len(cleaned_content)} chars)")
        return cleaned_content

    except Exception as e:
        logger.error(f"Content extraction failed: {e}")
        raise


async def translate_content(title: str, content: str) -> dict:
    """
    Translate title and content to Korean.

    Args:
        title: Original title
        content: Cleaned content (from extract_content)

    Returns:
        Dictionary with title_ko and content_ko

    Raises:
        ValueError: If translation fails or returns invalid JSON

    Examples:
        >>> result = await translate_content("FCC Notice", "Document content...")
        >>> result['title_ko']
        'FCC 공지'
    """
    logger.info("Translating content to Korean")

    system_prompt = get_translate_prompt()

    # Format input: title on first line, then content
    user_content = f"{title}\n\n{content}"

    try:
        response = await _call_openai_api(
            system_prompt=system_prompt,
            user_content=user_content,
            response_format={"type": "json_object"}
        )

        # Parse JSON response
        try:
            translated = json.loads(response)

            # Validate required fields
            if "title_ko" not in translated or "content_ko" not in translated:
                raise ValueError("Translation response missing required fields (title_ko, content_ko)")

            logger.info(f"Content translated successfully (title_ko: {translated.get('title_ko', 'N/A')[:50]})")
            return translated

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse translation response as JSON: {e}")
            raise ValueError(f"Invalid JSON in translation response: {e}")

    except Exception as e:
        logger.error(f"Content translation failed: {e}")
        raise


def clear_prompt_cache():
    """Clear the prompt file cache. Useful for development/testing."""
    _load_prompt_file.cache_clear()
    logger.info("Prompt cache cleared")
