"""
Article management API routes.
Handles article CRUD operations.
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Article, ArticleList, ArticleUpdate

router = APIRouter(prefix="/articles", tags=["Articles"])


@router.get("", response_model=List[ArticleList])
async def list_articles(
    country_code: str | None = Query(None, description="Filter by country code"),
    status: str | None = Query(None, description="Filter by status"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Max records to return"),
    db: AsyncSession = Depends(get_db)
):
    """
    List articles with optional filters and pagination.
    """
    # TODO: Implement article listing with filters
    raise HTTPException(status_code=501, detail="Not implemented yet")


@router.get("/{article_id}", response_model=Article)
async def get_article(
    article_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get single article by ID with attachments.
    """
    # TODO: Implement article retrieval
    raise HTTPException(status_code=501, detail="Not implemented yet")


@router.patch("/{article_id}", response_model=Article)
async def update_article(
    article_id: str,
    article_update: ArticleUpdate,
    db: AsyncSession = Depends(get_db)
):
    """
    Update article fields.
    """
    # TODO: Implement article update
    raise HTTPException(status_code=501, detail="Not implemented yet")
