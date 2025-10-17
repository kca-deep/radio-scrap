"""
Scraper service for processing URL lists.
Orchestrates Firecrawl scraping, attachment downloads, and database storage.
"""
import asyncio
import logging
from datetime import datetime
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.article import ArticleCreate
from app.services import firecrawl_service, country_mapper
from app.services.db_service import (
    save_article,
    update_article_content,
    save_attachments,
    update_scrape_job_progress,
    update_scrape_job_status
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
    Process a list of URLs through the scraping pipeline.

    Pipeline steps:
    1. Scrape URL with Firecrawl
    2. Map country code from source
    3. Create and save article
    4. Extract and download attachments
    5. Update progress and send SSE events

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
        'processed': 0
    })

    success_count = 0
    error_count = 0

    for idx, url_item in enumerate(urls, 1):
        try:
            logger.info(f"[{idx}/{total}] Processing: {url_item.link}")

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

            # Update article content
            await update_article_content(
                article_id,
                scrape_result.get('markdown', ''),
                session
            )

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
                        download_tasks = [
                            firecrawl_service.download_attachment(
                                link['url'],
                                settings.ATTACHMENT_DIR
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

            # Step 5: Update progress
            success_count += 1

            await update_scrape_job_progress(job_id, idx, total, session)
            await send_sse_event(job_id, {
                'processed': idx,
                'total': total,
                'current_url': str(url_item.link),
                'article_id': article_id,
                'attachments_count': len(attachments_downloaded),
                'status': 'success'
            })

            logger.info(f"[{idx}/{total}] Successfully scraped {url_item.link} (article: {article_id})")

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
        f"{success_count} succeeded, {error_count} failed"
    )

    await send_sse_event(job_id, {
        'status': final_status,
        'total': total,
        'processed': total,
        'success_count': success_count,
        'error_count': error_count,
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
    Process a single URL (utility function for testing).

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
        # Scrape URL
        scrape_result = await firecrawl_service.scrape_url(url)

        # Map country code
        country_code = country_mapper.map_country_code(source)

        # Create article
        from pydantic import HttpUrl
        article_create = ArticleCreate(
            url=HttpUrl(url),
            title=title,
            source=source,
            country_code=country_code.value if country_code else None,
            published_date=published_date
        )

        article_id = await save_article(article_create, session)

        # Update content
        await update_article_content(
            article_id,
            scrape_result.get('markdown', ''),
            session
        )

        # Process attachments
        html_content = scrape_result.get('html', '')
        if html_content:
            attachment_links = await firecrawl_service.extract_attachment_links(
                html_content,
                url
            )

            if attachment_links:
                download_tasks = [
                    firecrawl_service.download_attachment(
                        link['url'],
                        settings.ATTACHMENT_DIR
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

        logger.info(f"Successfully processed single URL: {url} (article: {article_id})")
        return article_id

    except Exception as e:
        logger.error(f"Failed to process single URL {url}: {e}", exc_info=True)
        return None
