"""
Scraper service for processing URL lists.
Orchestrates Firecrawl scraping, content extraction, translation, and database storage.

Full pipeline (auto-executed):
  1. Scrape URL with Firecrawl -> content_raw
  2. Extract/clean content with OpenAI -> content
  3. Translate to Korean with OpenAI -> title_ko, content_ko
"""
import asyncio
import logging
from datetime import datetime
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.article import ArticleCreate
from app.services import firecrawl_service, country_mapper, translator_service
from app.services.db_service import (
    save_article,
    update_article_content,
    update_article_extraction,
    update_article_translation,
    save_attachments,
    update_scrape_job_progress,
    update_scrape_job_status,
    check_url_exists
)
from app.services.sse_service import send_sse_event
from app.utils.excel_parser import URLItem

logger = logging.getLogger(__name__)


async def process_url_list(
    job_id: str,
    urls: list[URLItem],
    session: AsyncSession
):
    """
    Process a list of URLs through the full pipeline.

    Pipeline steps (all auto-executed):
    1. Scrape URL with Firecrawl -> content_raw
    2. Map country code from source
    3. Create and save article
    4. Extract and download attachments
    5. Extract/clean content with OpenAI -> content
    6. Translate to Korean with OpenAI -> title_ko, content_ko
    7. Update progress and send SSE events

    Args:
        job_id: ScrapeJob ID for tracking
        urls: List of URLItem objects to process
        session: Database session

    Examples:
        >>> async with get_db() as session:
        ...     await process_url_list('scr-123', url_items, session)
    """
    total = len(urls)
    logger.info(f"Starting scrape job {job_id} with {total} URLs")

    # Update job status to processing
    await update_scrape_job_status(job_id, "processing", session)
    await send_sse_event(job_id, {
        'status': 'processing',
        'total': total,
        'processed': 0,
        'scraped_count': 0,
        'extracted_count': 0,
        'translated_count': 0
    })

    success_count = 0
    error_count = 0
    skipped_count = 0

    # Step-wise counters
    scraped_count = 0
    extracted_count = 0
    translated_count = 0

    for idx, url_item in enumerate(urls, 1):
        try:
            logger.info(f"[{idx}/{total}] Processing: {url_item.link}")

            # Step 0: Check if URL already exists in database
            existing_article_id = await check_url_exists(str(url_item.link), session)
            if existing_article_id:
                logger.info(f"[{idx}/{total}] Skipped (duplicate): {url_item.link}")
                skipped_count += 1

                await update_scrape_job_progress(job_id, idx, total, session)
                await send_sse_event(job_id, {
                    'processed': idx,
                    'total': total,
                    'current_url': str(url_item.link),
                    'article_id': existing_article_id,
                    'status': 'skipped',
                    'skip_reason': 'duplicate'
                })
                continue

            # Step 1: Scrape URL with Firecrawl
            try:
                scrape_result = await firecrawl_service.scrape_url(str(url_item.link))
            except Exception as e:
                logger.error(f"Failed to scrape {url_item.link}: {e}")
                error_count += 1

                await send_sse_event(job_id, {
                    'processed': idx,
                    'total': total,
                    'error': str(e),
                    'url': str(url_item.link),
                    'status': 'error'
                })
                continue

            # Step 2: Map country code
            country_code = country_mapper.map_country_code(url_item.source)

            # Step 3: Create article
            article_create = ArticleCreate(
                url=url_item.link,
                title=url_item.title,
                source=url_item.source,
                country_code=country_code.value if country_code else None,
                published_date=url_item.date
            )

            article_id = await save_article(article_create, session)

            # Update article with raw content (content_raw + content_html)
            await update_article_content(
                article_id,
                scrape_result.get('markdown', ''),
                session,
                content_html=scrape_result.get('html', '')
            )

            # Scrape completed
            scraped_count += 1
            await send_sse_event(job_id, {
                'processed': idx,
                'total': total,
                'current_url': str(url_item.link),
                'article_id': article_id,
                'step': 'scraped',
                'status': 'processing',
                'scraped_count': scraped_count,
                'extracted_count': extracted_count,
                'translated_count': translated_count
            })

            # Step 4: Extract and download attachments
            attachments_downloaded = []
            html_content = scrape_result.get('html', '')

            if html_content:
                try:
                    attachment_links = await firecrawl_service.extract_attachment_links(
                        html_content,
                        str(url_item.link)
                    )

                    if attachment_links:
                        logger.info(f"Found {len(attachment_links)} attachments for {url_item.link}")

                        # Download attachments with concurrency limit
                        # Pass article metadata for hierarchical folder structure
                        download_tasks = [
                            firecrawl_service.download_attachment(
                                url=link['url'],
                                base_dir=settings.ATTACHMENT_DIR,
                                article_id=article_id,
                                country_code=country_code.value if country_code else None,
                                source=url_item.source,
                                published_date=url_item.date
                            )
                            for link in attachment_links
                        ]

                        # Download all attachments
                        download_results = await asyncio.gather(
                            *download_tasks,
                            return_exceptions=True
                        )

                        # Filter successful downloads
                        for result in download_results:
                            if isinstance(result, dict):
                                attachments_downloaded.append(result)
                            else:
                                logger.warning(f"Attachment download failed: {result}")

                        # Save attachments to database
                        if attachments_downloaded:
                            await save_attachments(article_id, attachments_downloaded, session)

                except Exception as e:
                    logger.warning(f"Failed to process attachments for {url_item.link}: {e}")
                    # Continue even if attachment processing fails

            # Step 5: Extract/clean content with OpenAI
            content_raw = scrape_result.get('markdown', '')
            extracted_content = None

            if content_raw:
                await send_sse_event(job_id, {
                    'processed': idx,
                    'total': total,
                    'current_url': str(url_item.link),
                    'article_id': article_id,
                    'step': 'extracting',
                    'status': 'processing',
                    'scraped_count': scraped_count,
                    'extracted_count': extracted_count,
                    'translated_count': translated_count
                })

                try:
                    extracted_content = await translator_service.extract_content(
                        content_raw=content_raw,
                        source=url_item.source or "default"
                    )

                    # Save extraction to database
                    await update_article_extraction(
                        article_id=article_id,
                        content=extracted_content,
                        session=session
                    )

                    # Extract completed
                    extracted_count += 1
                    await send_sse_event(job_id, {
                        'processed': idx,
                        'total': total,
                        'current_url': str(url_item.link),
                        'article_id': article_id,
                        'step': 'extracted',
                        'status': 'processing',
                        'scraped_count': scraped_count,
                        'extracted_count': extracted_count,
                        'translated_count': translated_count
                    })

                    logger.info(f"[{idx}/{total}] Extracted content for {url_item.link}")

                except Exception as e:
                    logger.error(f"[{idx}/{total}] Failed to extract content for {url_item.link}: {e}")
                    # Continue to next article even if extraction fails

            # Step 6: Translate to Korean with OpenAI
            if extracted_content:
                await send_sse_event(job_id, {
                    'processed': idx,
                    'total': total,
                    'current_url': str(url_item.link),
                    'article_id': article_id,
                    'step': 'translating',
                    'status': 'processing',
                    'scraped_count': scraped_count,
                    'extracted_count': extracted_count,
                    'translated_count': translated_count
                })

                try:
                    translation_result = await translator_service.translate_content(
                        title=url_item.title or "",
                        content=extracted_content
                    )

                    title_ko = translation_result.get("title_ko", "")
                    content_ko = translation_result.get("content_ko", "")

                    # Save translation to database
                    await update_article_translation(
                        article_id=article_id,
                        title_ko=title_ko,
                        content_ko=content_ko,
                        session=session
                    )

                    # Translate completed
                    translated_count += 1

                    logger.info(f"[{idx}/{total}] Translated content for {url_item.link}")

                except Exception as e:
                    logger.error(f"[{idx}/{total}] Failed to translate content for {url_item.link}: {e}")
                    # Continue to next article even if translation fails

            # Step 7: Update progress
            success_count += 1

            await update_scrape_job_progress(job_id, idx, total, session)
            await send_sse_event(job_id, {
                'processed': idx,
                'total': total,
                'current_url': str(url_item.link),
                'article_id': article_id,
                'attachments_count': len(attachments_downloaded),
                'status': 'success',
                'scraped_count': scraped_count,
                'extracted_count': extracted_count,
                'translated_count': translated_count
            })

            logger.info(f"[{idx}/{total}] Successfully processed {url_item.link} (article: {article_id})")

        except Exception as e:
            error_count += 1
            logger.error(f"Unexpected error processing {url_item.link}: {e}", exc_info=True)

            await send_sse_event(job_id, {
                'processed': idx,
                'total': total,
                'error': f"Unexpected error: {str(e)}",
                'url': str(url_item.link),
                'status': 'error'
            })

    # Job completed
    final_status = "completed" if error_count == 0 else "failed"
    await update_scrape_job_status(job_id, final_status, session)

    logger.info(
        f"Scrape job {job_id} finished: "
        f"{success_count} succeeded, {skipped_count} skipped, {error_count} failed"
    )

    await send_sse_event(job_id, {
        'status': final_status,
        'total': total,
        'processed': total,
        'success_count': success_count,
        'skipped_count': skipped_count,
        'error_count': error_count,
        'scraped_count': scraped_count,
        'extracted_count': extracted_count,
        'translated_count': translated_count,
        'completed_at': datetime.utcnow().isoformat()
    })


async def process_single_url(
    url: str,
    title: str,
    source: str,
    published_date: Optional[datetime],
    session: AsyncSession
) -> Optional[str]:
    """
    Process a single URL through the full pipeline (utility function for testing).

    Pipeline: Scrape -> Extract -> Translate

    Args:
        url: URL to scrape
        title: Article title
        source: Source organization
        published_date: Publication date
        session: Database session

    Returns:
        Article ID if successful, None otherwise
    """
    try:
        # Step 1: Scrape URL
        scrape_result = await firecrawl_service.scrape_url(url)

        # Step 2: Map country code
        country_code = country_mapper.map_country_code(source)

        # Step 3: Create article
        from pydantic import HttpUrl
        article_create = ArticleCreate(
            url=HttpUrl(url),
            title=title,
            source=source,
            country_code=country_code.value if country_code else None,
            published_date=published_date
        )

        article_id = await save_article(article_create, session)

        # Update content (content_raw + content_html)
        content_raw = scrape_result.get('markdown', '')
        await update_article_content(
            article_id,
            content_raw,
            session,
            content_html=scrape_result.get('html', '')
        )

        # Step 4: Process attachments
        html_content = scrape_result.get('html', '')
        if html_content:
            attachment_links = await firecrawl_service.extract_attachment_links(
                html_content,
                url
            )

            if attachment_links:
                # Pass article metadata for hierarchical folder structure
                download_tasks = [
                    firecrawl_service.download_attachment(
                        url=link['url'],
                        base_dir=settings.ATTACHMENT_DIR,
                        article_id=article_id,
                        country_code=country_code.value if country_code else None,
                        source=source,
                        published_date=published_date
                    )
                    for link in attachment_links
                ]

                download_results = await asyncio.gather(
                    *download_tasks,
                    return_exceptions=True
                )

                attachments = [r for r in download_results if isinstance(r, dict)]

                if attachments:
                    await save_attachments(article_id, attachments, session)

        # Step 5: Extract/clean content with OpenAI
        extracted_content = None
        if content_raw:
            try:
                extracted_content = await translator_service.extract_content(
                    content_raw=content_raw,
                    source=source or "default"
                )

                await update_article_extraction(
                    article_id=article_id,
                    content=extracted_content,
                    session=session
                )

                logger.info(f"Extracted content for {url}")

            except Exception as e:
                logger.error(f"Failed to extract content for {url}: {e}")

        # Step 6: Translate to Korean with OpenAI
        if extracted_content:
            try:
                translation_result = await translator_service.translate_content(
                    title=title or "",
                    content=extracted_content
                )

                title_ko = translation_result.get("title_ko", "")
                content_ko = translation_result.get("content_ko", "")

                await update_article_translation(
                    article_id=article_id,
                    title_ko=title_ko,
                    content_ko=content_ko,
                    session=session
                )

                logger.info(f"Translated content for {url}")

            except Exception as e:
                logger.error(f"Failed to translate content for {url}: {e}")

        logger.info(f"Successfully processed single URL: {url} (article: {article_id})")
        return article_id

    except Exception as e:
        logger.error(f"Failed to process single URL {url}: {e}", exc_info=True)
        return None
