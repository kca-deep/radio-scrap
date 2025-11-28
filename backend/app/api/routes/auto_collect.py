"""
Auto-collect API routes.
Handles automatic article collection from government websites.
"""

import logging
from typing import Dict, List
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.database import get_db
from app.models.requests import AutoCollectRequest, AutoCollectStartRequest
from app.models.responses import SuccessResponse
from app.services.auto_scrapers import scrape_all_sources
from app.config import settings
from app.services.auto_scrapers.base_scraper import ArticlePreview
from app.services.db_service import create_scrape_job, check_urls_exist
from app.services.job_store import store_job_urls
from app.services import scraper
from app.utils.excel_parser import URLItem
from pydantic import HttpUrl


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/scrape/auto-collect", tags=["Auto-Collect"])


class AutoCollectConfigResponse(BaseModel):
    """Response model for config endpoint"""
    soumu_default_keywords: List[str]


class AutoCollectPreviewResponse(BaseModel):
    """Response model for preview endpoint"""
    data: Dict[str, List[ArticlePreview]]
    warnings: List[str] = []
    total_count: int


class AutoCollectStartResponse(BaseModel):
    """Response model for start endpoint"""
    job_id: str
    total_urls: int


@router.get("/config", response_model=AutoCollectConfigResponse)
async def get_auto_collect_config():
    """
    Get auto-collect configuration including default keywords.

    Returns:
        AutoCollectConfigResponse with default settings
    """
    return AutoCollectConfigResponse(
        soumu_default_keywords=settings.SOUMU_DEFAULT_KEYWORDS
    )


@router.post("/preview", response_model=AutoCollectPreviewResponse)
async def preview_auto_collect(
    request: AutoCollectRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Preview articles from auto-collect sources.

    This endpoint scrapes articles from selected sources and returns
    a preview without saving to database. Marks duplicates that already exist in DB.

    Args:
        request: AutoCollectRequest with sources, date_range, keywords
        db: Database session

    Returns:
        AutoCollectPreviewResponse with articles grouped by source

    Raises:
        HTTPException: If all scrapers fail
    """
    logger.info(
        f"Auto-collect preview: sources={request.sources}, "
        f"date_range={request.date_range}"
    )

    try:
        # Scrape all sources in parallel
        results = await scrape_all_sources(
            sources=request.sources,
            date_range=request.date_range,
            max_articles=50,
        )

        # Collect all URLs to check for duplicates
        all_urls = []
        for source_name, result in results.items():
            if result.success:
                all_urls.extend([article.url for article in result.articles])

        # Check which URLs already exist in database
        existing_urls = await check_urls_exist(all_urls, db)
        duplicate_count = len(existing_urls)

        # Build response with duplicate marking
        data = {}
        warnings = []
        total_count = 0
        new_count = 0

        for source_name, result in results.items():
            if result.success:
                # Mark duplicates
                articles_with_dup = []
                for article in result.articles:
                    article.is_duplicate = article.url in existing_urls
                    articles_with_dup.append(article)
                    if not article.is_duplicate:
                        new_count += 1

                data[source_name] = articles_with_dup
                total_count += result.total_count
                if result.warnings:
                    warnings.extend(result.warnings)
            else:
                # Scraper failed, add empty list and warning
                data[source_name] = []
                warnings.append(f"{source_name.upper()} scraping failed: {result.error}")

        # Check if all scrapers failed
        if total_count == 0 and len(warnings) == len(request.sources):
            raise HTTPException(
                status_code=500,
                detail="All scrapers failed. " + "; ".join(warnings)
            )

        # Add duplicate info to warnings
        if duplicate_count > 0:
            warnings.insert(0, f"{duplicate_count}건의 중복 기사가 제외됩니다.")

        logger.info(f"Preview completed: {total_count} articles ({new_count} new, {duplicate_count} duplicates)")

        return AutoCollectPreviewResponse(
            data=data,
            warnings=warnings,
            total_count=total_count
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Preview failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Auto-collect preview failed: {str(e)}"
        )


@router.post("/start", response_model=AutoCollectStartResponse)
async def start_auto_collect(
    request: AutoCollectStartRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """
    Start auto-collect scraping job with selected articles.

    This endpoint receives pre-selected articles from preview
    and processes them in background.

    Args:
        request: AutoCollectStartRequest with selected_articles list
        background_tasks: FastAPI background tasks
        db: Database session

    Returns:
        AutoCollectStartResponse with job_id and total_urls

    Raises:
        HTTPException: If no articles provided
    """
    logger.info(f"Starting auto-collect with {len(request.selected_articles)} selected articles")

    try:
        # Convert selected articles to URLItem
        url_items: List[URLItem] = []

        for article in request.selected_articles:
            try:
                # Parse published_date
                published_date = None
                if article.published_date:
                    try:
                        published_date = datetime.fromisoformat(article.published_date)
                    except:
                        pass

                url_item = URLItem(
                    title=article.title,
                    date=published_date,
                    link=HttpUrl(article.url),
                    source=article.source
                )
                url_items.append(url_item)
            except Exception as e:
                logger.warning(f"Failed to convert article to URLItem: {str(e)}")
                continue

        if not url_items:
            raise HTTPException(
                status_code=400,
                detail="No valid articles provided."
            )

        # Create scrape job
        job_id = await create_scrape_job(len(url_items), db)

        # Store URL items in memory (same as Excel upload)
        store_job_urls(job_id, url_items)

        logger.info(f"Created auto-collect job {job_id} with {len(url_items)} URLs")

        # Add scraping task to background
        async def scrape_with_new_session():
            """Wrapper to create a new database session for background task."""
            from app.database import AsyncSessionLocal
            async with AsyncSessionLocal() as session:
                try:
                    await scraper.process_url_list(job_id, url_items, session)
                    await session.commit()
                except Exception as e:
                    logger.error(f"Auto-collect job {job_id} failed: {e}", exc_info=True)
                    await session.rollback()
                    raise

        background_tasks.add_task(scrape_with_new_session)

        return AutoCollectStartResponse(
            job_id=job_id,
            total_urls=len(url_items)
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Start auto-collect failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to start auto-collect: {str(e)}"
        )
