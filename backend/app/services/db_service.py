"""
Database service for scraping operations.
Handles CRUD operations for articles, attachments, and scrape jobs.
"""
import logging
from datetime import datetime
from typing import Optional

from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.db.models import ArticleModel, AttachmentModel, ScrapeJobModel
from app.models.article import Article, ArticleCreate
from app.models.attachment import Attachment
from app.models.scrape_job import ScrapeJob
from app.models.common import StatusEnum
from app.utils.id_generator import generate_id

logger = logging.getLogger(__name__)


async def check_url_exists(url: str, session: AsyncSession) -> Optional[str]:
    """
    Check if an article with the given URL already exists.

    Args:
        url: URL to check
        session: Database session

    Returns:
        Article ID if exists, None otherwise
    """
    stmt = select(ArticleModel.id).where(ArticleModel.url == url)
    result = await session.execute(stmt)
    article_id = result.scalar_one_or_none()
    return article_id


async def check_urls_exist(urls: list[str], session: AsyncSession) -> set[str]:
    """
    Check which URLs already exist in the database.

    Args:
        urls: List of URLs to check
        session: Database session

    Returns:
        Set of URLs that already exist in database
    """
    if not urls:
        return set()

    stmt = select(ArticleModel.url).where(ArticleModel.url.in_(urls))
    result = await session.execute(stmt)
    existing_urls = {row[0] for row in result.fetchall()}
    return existing_urls


async def save_article(article: ArticleCreate, session: AsyncSession) -> str:
    """
    Save a new article to the database.

    Args:
        article: ArticleCreate object with article data
        session: Database session

    Returns:
        Article ID (UUID string)

    Examples:
        >>> async with get_db() as session:
        ...     article_id = await save_article(article_data, session)
        ...     print(article_id)
        'art-abc123...'
    """
    article_id = generate_id("art")

    article_model = ArticleModel(
        id=article_id,
        url=str(article.url),
        title=article.title,
        content=None,  # Will be set by scraper
        source=article.source,
        country_code=article.country_code,
        published_date=article.published_date,
        status=StatusEnum.SCRAPED,
        scraped_at=datetime.utcnow()
    )

    session.add(article_model)
    await session.commit()

    logger.info(f"Saved article {article_id}: {article.title}")

    return article_id


async def update_article_content(
    article_id: str,
    content_raw: str,
    session: AsyncSession,
    content_html: str | None = None
) -> None:
    """
    Update article raw content after scraping (Step 1).

    Args:
        article_id: Article ID
        content_raw: Raw markdown content from Firecrawl
        session: Database session
        content_html: Raw HTML content from Firecrawl (optional)
    """
    values = {"content_raw": content_raw}
    if content_html is not None:
        values["content_html"] = content_html

    stmt = (
        update(ArticleModel)
        .where(ArticleModel.id == article_id)
        .values(**values)
    )

    await session.execute(stmt)
    await session.commit()

    logger.debug(f"Updated content_raw for article {article_id}")


async def update_article_extraction(
    article_id: str,
    content: str,
    session: AsyncSession
) -> None:
    """
    Update article with extracted/cleaned content (Step 2).

    Args:
        article_id: Article ID
        content: Cleaned/extracted content
        session: Database session
    """
    values = {
        "content": content,
        "status": StatusEnum.EXTRACTED
    }

    stmt = (
        update(ArticleModel)
        .where(ArticleModel.id == article_id)
        .values(**values)
    )

    await session.execute(stmt)
    await session.commit()

    logger.info(f"Updated extraction for article {article_id}")

async def save_attachments(
    article_id: str,
    attachments: list[dict],
    session: AsyncSession
) -> list[int]:
    """
    Save attachments for an article.

    Args:
        article_id: Article ID
        attachments: List of attachment dictionaries with keys:
            - filename: str
            - file_path: str
            - file_url: str
        session: Database session

    Returns:
        List of attachment IDs

    Examples:
        >>> attachments = [
        ...     {
        ...         "filename": "report.pdf",
        ...         "file_path": "/storage/attachments/report.pdf",
        ...         "file_url": "https://example.com/report.pdf"
        ...     }
        ... ]
        >>> ids = await save_attachments("art-123", attachments, session)
    """
    if not attachments:
        return []

    attachment_models = []

    for att_data in attachments:
        attachment_model = AttachmentModel(
            article_id=article_id,
            filename=att_data["filename"],
            file_path=att_data["file_path"],
            file_url=att_data.get("file_url"),
            downloaded_at=datetime.utcnow()
        )
        attachment_models.append(attachment_model)

    session.add_all(attachment_models)
    await session.commit()

    attachment_ids = [att.id for att in attachment_models]

    logger.info(f"Saved {len(attachment_ids)} attachments for article {article_id}")

    return attachment_ids


async def create_scrape_job(total_urls: int, session: AsyncSession) -> str:
    """
    Create a new scrape job.

    Args:
        total_urls: Total number of URLs to scrape
        session: Database session

    Returns:
        Job ID (UUID string)

    Examples:
        >>> async with get_db() as session:
        ...     job_id = await create_scrape_job(10, session)
        ...     print(job_id)
        'scr-xyz789...'
    """
    job_id = generate_id("scr")

    job_model = ScrapeJobModel(
        job_id=job_id,
        status="pending",
        total_urls=total_urls,
        processed_urls=0,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )

    session.add(job_model)
    await session.commit()

    logger.info(f"Created scrape job {job_id} with {total_urls} URLs")

    return job_id


async def update_scrape_job_progress(
    job_id: str,
    processed: int,
    total: int,
    session: AsyncSession
) -> None:
    """
    Update scrape job progress.

    Args:
        job_id: Job ID
        processed: Number of processed URLs
        total: Total number of URLs
        session: Database session
    """
    stmt = (
        update(ScrapeJobModel)
        .where(ScrapeJobModel.job_id == job_id)
        .values(
            processed_urls=processed,
            total_urls=total,
            updated_at=datetime.utcnow()
        )
    )

    await session.execute(stmt)
    await session.commit()

    logger.debug(f"Updated job {job_id} progress: {processed}/{total}")


async def update_scrape_job_status(
    job_id: str,
    status: str,
    session: AsyncSession
) -> None:
    """
    Update scrape job status.

    Args:
        job_id: Job ID
        status: New status ('processing', 'completed', 'failed')
        session: Database session
    """
    stmt = (
        update(ScrapeJobModel)
        .where(ScrapeJobModel.job_id == job_id)
        .values(
            status=status,
            updated_at=datetime.utcnow()
        )
    )

    await session.execute(stmt)
    await session.commit()

    logger.info(f"Updated job {job_id} status to: {status}")


async def get_scrape_job(job_id: str, session: AsyncSession) -> Optional[ScrapeJob]:
    """
    Get scrape job by ID.

    Args:
        job_id: Job ID
        session: Database session

    Returns:
        ScrapeJob object or None if not found
    """
    stmt = select(ScrapeJobModel).where(ScrapeJobModel.job_id == job_id)
    result = await session.execute(stmt)
    job_model = result.scalar_one_or_none()

    if not job_model:
        return None

    return ScrapeJob(
        job_id=job_model.job_id,
        status=job_model.status,
        total_urls=job_model.total_urls,
        processed_urls=job_model.processed_urls,
        created_at=job_model.created_at,
        updated_at=job_model.updated_at
    )


async def get_article_by_id(article_id: str, session: AsyncSession) -> Optional[Article]:
    """
    Get article with attachments by ID.

    Args:
        article_id: Article ID
        session: Database session

    Returns:
        Article object with attachments or None if not found
    """
    stmt = select(ArticleModel).where(ArticleModel.id == article_id)
    result = await session.execute(stmt)
    article_model = result.scalar_one_or_none()

    if not article_model:
        return None

    # Get attachments
    att_stmt = select(AttachmentModel).where(AttachmentModel.article_id == article_id)
    att_result = await session.execute(att_stmt)
    attachment_models = att_result.scalars().all()

    attachments = [
        Attachment(
            id=att.id,
            article_id=att.article_id,
            filename=att.filename,
            file_path=att.file_path,
            file_url=att.file_url,
            downloaded_at=att.downloaded_at
        )
        for att in attachment_models
    ]

    return Article(
        id=article_model.id,
        url=article_model.url,
        title=article_model.title,
        title_ko=article_model.title_ko,
        content_raw=article_model.content_raw,
        content=article_model.content,
        content_ko=article_model.content_ko,
        source=article_model.source,
        country_code=article_model.country_code,
        published_date=article_model.published_date,
        status=article_model.status,
        scraped_at=article_model.scraped_at,
        translated_at=article_model.translated_at,
        attachments=attachments
    )


async def update_article_translation(
    article_id: str,
    title_ko: str,
    content_ko: str,
    session: AsyncSession
) -> None:
    """
    Update article with translation results (Step 3).

    Args:
        article_id: Article ID
        title_ko: Translated Korean title
        content_ko: Translated Korean content
        session: Database session
    """
    values = {
        "title_ko": title_ko,
        "content_ko": content_ko,
        "status": StatusEnum.TRANSLATED,
        "translated_at": datetime.utcnow()
    }

    stmt = (
        update(ArticleModel)
        .where(ArticleModel.id == article_id)
        .values(**values)
    )

    await session.execute(stmt)
    await session.commit()

    logger.info(f"Updated translation for article {article_id}")


async def get_articles_for_extraction(
    session: AsyncSession,
    limit: int = 10
) -> list[Article]:
    """
    Get articles that need extraction (status=scraped, has content_raw).

    Args:
        session: Database session
        limit: Maximum number of articles to return

    Returns:
        List of Article objects
    """
    stmt = (
        select(ArticleModel)
        .where(ArticleModel.status == StatusEnum.SCRAPED)
        .where(ArticleModel.content_raw.isnot(None))
        .order_by(ArticleModel.scraped_at.desc())
        .limit(limit)
    )

    result = await session.execute(stmt)
    article_models = result.scalars().all()

    articles = []
    for article_model in article_models:
        articles.append(Article(
            id=article_model.id,
            url=article_model.url,
            title=article_model.title,
            title_ko=article_model.title_ko,
            content=article_model.content,
            content_ko=article_model.content_ko,
            content_raw=article_model.content_raw,
            source=article_model.source,
            country_code=article_model.country_code,
            published_date=article_model.published_date,
            status=article_model.status,
            scraped_at=article_model.scraped_at,
            translated_at=article_model.translated_at,
            attachments=[]
        ))

    return articles


async def get_articles_for_translation(
    session: AsyncSession,
    limit: int = 10
) -> list[Article]:
    """
    Get articles that need translation (status=extracted, has content).

    Args:
        session: Database session
        limit: Maximum number of articles to return

    Returns:
        List of Article objects
    """
    stmt = (
        select(ArticleModel)
        .where(ArticleModel.status == StatusEnum.EXTRACTED)
        .where(ArticleModel.content.isnot(None))
        .order_by(ArticleModel.scraped_at.desc())
        .limit(limit)
    )

    result = await session.execute(stmt)
    article_models = result.scalars().all()

    articles = []
    for article_model in article_models:
        articles.append(Article(
            id=article_model.id,
            url=article_model.url,
            title=article_model.title,
            title_ko=article_model.title_ko,
            content_raw=article_model.content_raw,
            content=article_model.content,
            content_ko=article_model.content_ko,
            source=article_model.source,
            country_code=article_model.country_code,
            published_date=article_model.published_date,
            status=article_model.status,
            scraped_at=article_model.scraped_at,
            translated_at=article_model.translated_at,
            attachments=[]
        ))

    return articles


async def get_attachment_by_id(
    attachment_id: int,
    session: AsyncSession
) -> Optional[Attachment]:
    """
    Get a single attachment by ID.

    Args:
        attachment_id: Attachment ID
        session: Database session

    Returns:
        Attachment object if found, None otherwise

    Examples:
        >>> async with get_db() as session:
        ...     attachment = await get_attachment_by_id(1, session)
        ...     if attachment:
        ...         print(attachment.filename)
    """
    stmt = select(AttachmentModel).where(AttachmentModel.id == attachment_id)
    result = await session.execute(stmt)
    attachment_model = result.scalar_one_or_none()

    if not attachment_model:
        return None

    return Attachment(
        id=attachment_model.id,
        article_id=attachment_model.article_id,
        filename=attachment_model.filename,
        file_path=attachment_model.file_path,
        file_url=attachment_model.file_url,
        downloaded_at=attachment_model.downloaded_at
    )
