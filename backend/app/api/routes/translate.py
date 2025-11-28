"""
Extraction and Translation API routes.
Handles content extraction (cleaning) and translation with OpenAI.

Pipeline:
  1. Scrape (Firecrawl) -> content_raw saved (status: scraped)
  2. Extract (OpenAI) -> content saved (status: extracted)
  3. Translate (OpenAI) -> content_ko, title_ko saved (status: translated)
"""
import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field

from app.database import get_db
from app.models import TranslateRequest, SuccessResponse
from app.services.db_service import (
    get_article_by_id,
    update_article_extraction,
    update_article_translation,
    get_articles_for_extraction,
    get_articles_for_translation
)
from app.services import translator_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/translate", tags=["Extraction & Translation"])


# =============================================================================
# Request/Response Models
# =============================================================================

class ExtractRequest(BaseModel):
    """Request body for batch extraction."""
    article_ids: List[str] = Field(..., min_length=1, description="List of article UUIDs to extract")


class ProcessResult:
    """Result of an extraction or translation operation."""
    def __init__(self, article_id: str, success: bool, error: str = None):
        self.article_id = article_id
        self.success = success
        self.error = error


# =============================================================================
# Extraction Endpoints (Step 2)
# =============================================================================

async def extract_single_article(
    article_id: str,
    db: AsyncSession
) -> ProcessResult:
    """
    Extract (clean) content for a single article.

    Args:
        article_id: Article ID to extract
        db: Database session

    Returns:
        ProcessResult with success status
    """
    try:
        # Get article
        article = await get_article_by_id(article_id, db)
        if not article:
            return ProcessResult(article_id, False, "Article not found")

        if not article.content_raw:
            return ProcessResult(article_id, False, "Article has no raw content (content_raw)")

        # Extract content using source-specific prompt
        cleaned_content = await translator_service.extract_content(
            content_raw=article.content_raw,
            source=article.source or "default"
        )

        # Save extraction to database
        await update_article_extraction(
            article_id=article_id,
            content=cleaned_content,
            session=db
        )

        logger.info(f"Successfully extracted article {article_id}")
        return ProcessResult(article_id, True)

    except Exception as e:
        logger.error(f"Failed to extract article {article_id}: {e}")
        return ProcessResult(article_id, False, str(e))


@router.post("/extract/{article_id}")
async def extract_article(
    article_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Extract (clean) content for a single article.

    Args:
        article_id: Article UUID to extract

    Returns:
        Extraction result with content preview
    """
    result = await extract_single_article(article_id, db)

    if not result.success:
        raise HTTPException(status_code=400, detail=result.error)

    # Get updated article
    article = await get_article_by_id(article_id, db)

    return {
        "success": True,
        "article_id": article_id,
        "status": article.status,
        "content_preview": article.content[:500] if article.content else None
    }


@router.post("/extract/batch", response_model=SuccessResponse)
async def extract_batch(
    request: ExtractRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Extract content for multiple articles.

    Args:
        request: ExtractRequest with article_ids list

    Returns:
        Summary of extraction results
    """
    results = []
    success_count = 0
    error_count = 0

    for article_id in request.article_ids:
        result = await extract_single_article(article_id, db)
        results.append({
            "article_id": article_id,
            "success": result.success,
            "error": result.error
        })
        if result.success:
            success_count += 1
        else:
            error_count += 1

    return SuccessResponse(
        success=error_count == 0,
        message=f"Extracted {success_count}/{len(request.article_ids)} articles",
        data={
            "total": len(request.article_ids),
            "success_count": success_count,
            "error_count": error_count,
            "results": results
        }
    )


@router.get("/extract/pending")
async def get_pending_extractions(
    limit: int = 10,
    db: AsyncSession = Depends(get_db)
):
    """
    Get articles pending extraction.

    Args:
        limit: Maximum number of articles to return (default: 10)

    Returns:
        List of articles with status='scraped' that need extraction
    """
    articles = await get_articles_for_extraction(db, limit)

    return {
        "count": len(articles),
        "articles": [
            {
                "id": article.id,
                "title": article.title,
                "source": article.source,
                "url": str(article.url),
                "status": article.status,
                "scraped_at": article.scraped_at.isoformat() if article.scraped_at else None
            }
            for article in articles
        ]
    }


# =============================================================================
# Translation Endpoints (Step 3)
# =============================================================================

async def translate_single_article(
    article_id: str,
    db: AsyncSession
) -> ProcessResult:
    """
    Translate a single article.

    Args:
        article_id: Article ID to translate
        db: Database session

    Returns:
        ProcessResult with success status
    """
    try:
        # Get article
        article = await get_article_by_id(article_id, db)
        if not article:
            return ProcessResult(article_id, False, "Article not found")

        if not article.content:
            return ProcessResult(article_id, False, "Article has no content. Run extraction first.")

        # Translate content
        result = await translator_service.translate_content(
            title=article.title or "",
            content=article.content
        )

        title_ko = result.get("title_ko", "")
        content_ko = result.get("content_ko", "")

        # Save translation to database
        await update_article_translation(
            article_id=article_id,
            title_ko=title_ko,
            content_ko=content_ko,
            session=db
        )

        logger.info(f"Successfully translated article {article_id}")
        return ProcessResult(article_id, True)

    except Exception as e:
        logger.error(f"Failed to translate article {article_id}: {e}")
        return ProcessResult(article_id, False, str(e))


@router.post("/{article_id}")
async def translate_article(
    article_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Translate a single article.

    Args:
        article_id: Article UUID to translate

    Returns:
        Translation result with title_ko and content_ko preview
    """
    result = await translate_single_article(article_id, db)

    if not result.success:
        raise HTTPException(status_code=400, detail=result.error)

    # Get updated article
    article = await get_article_by_id(article_id, db)

    return {
        "success": True,
        "article_id": article_id,
        "status": article.status,
        "title_ko": article.title_ko,
        "content_ko_preview": article.content_ko[:500] if article.content_ko else None
    }


@router.post("/batch", response_model=SuccessResponse)
async def translate_batch(
    request: TranslateRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Translate multiple articles.

    Args:
        request: TranslateRequest with article_ids list

    Returns:
        Summary of translation results
    """
    results = []
    success_count = 0
    error_count = 0

    for article_id in request.article_ids:
        result = await translate_single_article(article_id, db)
        results.append({
            "article_id": article_id,
            "success": result.success,
            "error": result.error
        })
        if result.success:
            success_count += 1
        else:
            error_count += 1

    return SuccessResponse(
        success=error_count == 0,
        message=f"Translated {success_count}/{len(request.article_ids)} articles",
        data={
            "total": len(request.article_ids),
            "success_count": success_count,
            "error_count": error_count,
            "results": results
        }
    )


@router.get("/pending")
async def get_pending_translations(
    limit: int = 10,
    db: AsyncSession = Depends(get_db)
):
    """
    Get articles pending translation.

    Args:
        limit: Maximum number of articles to return (default: 10)

    Returns:
        List of articles with status='extracted' that need translation
    """
    articles = await get_articles_for_translation(db, limit)

    return {
        "count": len(articles),
        "articles": [
            {
                "id": article.id,
                "title": article.title,
                "source": article.source,
                "url": str(article.url),
                "status": article.status,
                "scraped_at": article.scraped_at.isoformat() if article.scraped_at else None
            }
            for article in articles
        ]
    }


# =============================================================================
# Combined Endpoint (Extract + Translate)
# =============================================================================

@router.post("/process/{article_id}")
async def process_article(
    article_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Process article through both extraction and translation.

    This is a convenience endpoint that runs both steps sequentially.

    Args:
        article_id: Article UUID to process

    Returns:
        Final result with title_ko and content_ko preview
    """
    # Step 1: Extract
    extract_result = await extract_single_article(article_id, db)
    if not extract_result.success:
        raise HTTPException(
            status_code=400,
            detail=f"Extraction failed: {extract_result.error}"
        )

    # Step 2: Translate
    translate_result = await translate_single_article(article_id, db)
    if not translate_result.success:
        raise HTTPException(
            status_code=400,
            detail=f"Translation failed: {translate_result.error}"
        )

    # Get updated article
    article = await get_article_by_id(article_id, db)

    return {
        "success": True,
        "article_id": article_id,
        "status": article.status,
        "title_ko": article.title_ko,
        "content_ko_preview": article.content_ko[:500] if article.content_ko else None
    }


@router.post("/process/batch", response_model=SuccessResponse)
async def process_batch(
    request: TranslateRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Process multiple articles through extraction and translation.

    Args:
        request: TranslateRequest with article_ids list

    Returns:
        Summary of processing results
    """
    results = []
    success_count = 0
    error_count = 0

    for article_id in request.article_ids:
        try:
            # Extract
            extract_result = await extract_single_article(article_id, db)
            if not extract_result.success:
                results.append({
                    "article_id": article_id,
                    "success": False,
                    "error": f"Extraction failed: {extract_result.error}"
                })
                error_count += 1
                continue

            # Translate
            translate_result = await translate_single_article(article_id, db)
            if not translate_result.success:
                results.append({
                    "article_id": article_id,
                    "success": False,
                    "error": f"Translation failed: {translate_result.error}"
                })
                error_count += 1
                continue

            results.append({
                "article_id": article_id,
                "success": True,
                "error": None
            })
            success_count += 1

        except Exception as e:
            results.append({
                "article_id": article_id,
                "success": False,
                "error": str(e)
            })
            error_count += 1

    return SuccessResponse(
        success=error_count == 0,
        message=f"Processed {success_count}/{len(request.article_ids)} articles",
        data={
            "total": len(request.article_ids),
            "success_count": success_count,
            "error_count": error_count,
            "results": results
        }
    )


# =============================================================================
# Legacy Endpoints (backward compatibility)
# =============================================================================

@router.post("/start")
async def start_translation(
    request: TranslateRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Start processing for multiple articles (alias for /process/batch).
    This endpoint runs both extraction and translation.
    """
    return await process_batch(request, db)


@router.get("/status/{job_id}")
async def get_translation_status(
    job_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get translation job progress.
    Note: Current implementation is synchronous, so this returns completed status.
    """
    return {
        "job_id": job_id,
        "status": "completed",
        "message": "Processing is done synchronously. Check article status directly."
    }
