"""
Article management API routes.
Handles article CRUD operations.
"""
from typing import List
import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.db.models import ArticleModel
from app.models import Article, ArticleList, ArticleUpdate

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/articles", tags=["Articles"])


@router.get("", response_model=List[ArticleList])
async def list_articles(
    country_code: str | None = Query(None, description="Filter by country code"),
    status: str | None = Query(None, description="Filter by status"),
    source: str | None = Query(None, description="Filter by source"),
    search: str | None = Query(None, description="Search in title and source"),
    scraped_from: str | None = Query(None, description="Scraped date from (YYYY-MM-DD)"),
    scraped_to: str | None = Query(None, description="Scraped date to (YYYY-MM-DD)"),
    published_from: str | None = Query(None, description="Published date from (YYYY-MM-DD)"),
    published_to: str | None = Query(None, description="Published date to (YYYY-MM-DD)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Max records to return"),
    db: AsyncSession = Depends(get_db)
):
    """
    List articles with optional filters and pagination.

    Filters:
    - country_code: Filter by country (KR, US, UK, JP)
    - status: Filter by status (scraped, translated)
    - source: Filter by source organization
    - search: Search in title (both original and Korean) and source
    - scraped_from/scraped_to: Filter by scraped date range
    - published_from/published_to: Filter by published date range

    Returns list of articles with attachment count.
    """
    try:
        # Build query with filters
        query = select(ArticleModel).options(selectinload(ArticleModel.attachments))

        if country_code:
            # Support multiple country codes (comma-separated)
            codes = [c.strip() for c in country_code.split(',') if c.strip()]
            if len(codes) == 1:
                query = query.where(ArticleModel.country_code == codes[0])
            elif len(codes) > 1:
                query = query.where(ArticleModel.country_code.in_(codes))
        if status:
            query = query.where(ArticleModel.status == status)
        if source:
            query = query.where(ArticleModel.source.ilike(f"%{source}%"))
        if search:
            # Search in title, title_ko, and source
            search_filter = (
                ArticleModel.title.ilike(f"%{search}%") |
                ArticleModel.title_ko.ilike(f"%{search}%") |
                ArticleModel.source.ilike(f"%{search}%")
            )
            query = query.where(search_filter)

        # Date range filters for scraped_at
        if scraped_from:
            query = query.where(ArticleModel.scraped_at >= scraped_from)
        if scraped_to:
            # Add one day to include the entire end date
            from datetime import datetime, timedelta
            end_date = datetime.fromisoformat(scraped_to) + timedelta(days=1)
            query = query.where(ArticleModel.scraped_at < end_date.isoformat())

        # Date range filters for published_date
        if published_from:
            query = query.where(ArticleModel.published_date >= published_from)
        if published_to:
            from datetime import datetime, timedelta
            end_date = datetime.fromisoformat(published_to) + timedelta(days=1)
            query = query.where(ArticleModel.published_date < end_date.isoformat())

        # Apply ordering and pagination
        query = query.order_by(ArticleModel.scraped_at.desc()).offset(skip).limit(limit)

        # Execute query
        result = await db.execute(query)
        articles = result.scalars().all()

        # Convert to response model
        return [
            ArticleList(
                id=article.id,
                url=article.url,
                title=article.title,
                title_ko=article.title_ko,
                content=article.content,
                content_ko=article.content_ko,
                source=article.source,
                country_code=article.country_code,
                published_date=article.published_date,
                status=article.status,
                scraped_at=article.scraped_at,
                translated_at=article.translated_at,
                attachments_count=len(article.attachments)
            )
            for article in articles
        ]

    except Exception as e:
        logger.error(f"Failed to list articles: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to retrieve articles: {str(e)}")


@router.get("/{article_id}", response_model=Article)
async def get_article(
    article_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get single article by ID with attachments.

    Returns full article details including all attachments.
    """
    try:
        # Query with attachments eagerly loaded
        query = select(ArticleModel).options(
            selectinload(ArticleModel.attachments)
        ).where(ArticleModel.id == article_id)

        result = await db.execute(query)
        article = result.scalar_one_or_none()

        if not article:
            raise HTTPException(
                status_code=404,
                detail=f"Article not found: {article_id}"
            )

        return article

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get article {article_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to retrieve article: {str(e)}")


@router.patch("/{article_id}", response_model=Article)
async def update_article(
    article_id: str,
    article_update: ArticleUpdate,
    db: AsyncSession = Depends(get_db)
):
    """
    Update article fields.

    Allowed updates:
    - title / title_ko
    - content / content_ko
    - status
    """
    try:
        # Get existing article
        query = select(ArticleModel).options(
            selectinload(ArticleModel.attachments)
        ).where(ArticleModel.id == article_id)

        result = await db.execute(query)
        article = result.scalar_one_or_none()

        if not article:
            raise HTTPException(
                status_code=404,
                detail=f"Article not found: {article_id}"
            )

        # Update fields
        update_data = article_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(article, field, value)

        await db.commit()
        await db.refresh(article)

        logger.info(f"Updated article {article_id}: {list(update_data.keys())}")

        return article

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update article {article_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to update article: {str(e)}")


@router.delete("/{article_id}")
async def delete_article(
    article_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Delete an article by ID.

    Also deletes associated attachments.
    """
    try:
        # Get existing article
        query = select(ArticleModel).where(ArticleModel.id == article_id)

        result = await db.execute(query)
        article = result.scalar_one_or_none()

        if not article:
            raise HTTPException(
                status_code=404,
                detail=f"Article not found: {article_id}"
            )

        # Delete article (cascade will delete attachments)
        await db.delete(article)
        await db.commit()

        logger.info(f"Deleted article {article_id}")

        return {"message": f"Article {article_id} deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete article {article_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to delete article: {str(e)}")
