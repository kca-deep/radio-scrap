"""
Attachment API routes.
Handles file downloads.
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db

router = APIRouter(prefix="/attachments", tags=["Attachments"])


@router.get("/{attachment_id}/download")
async def download_attachment(
    attachment_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Download attachment file.
    """
    # TODO: Implement file download
    raise HTTPException(status_code=501, detail="Not implemented yet")
