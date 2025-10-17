"""
Translation API routes.
Handles article translation with OpenAI GPT-4.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import TranslateRequest, ScrapeJobStatus, SuccessResponse

router = APIRouter(prefix="/translate", tags=["Translation"])


@router.post("/start")
async def start_translation(
    request: TranslateRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Start background translation job.
    """
    # TODO: Implement background translation with OpenAI
    raise HTTPException(status_code=501, detail="Not implemented yet")


@router.get("/status/{job_id}", response_model=ScrapeJobStatus)
async def get_translation_status(
    job_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get translation job progress.
    """
    # TODO: Implement translation status retrieval
    raise HTTPException(status_code=501, detail="Not implemented yet")
