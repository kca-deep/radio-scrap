"""
Attachment API routes.
Handles file downloads.
"""
import logging
from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.db_service import get_attachment_by_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/attachments", tags=["Attachments"])


@router.get("/{attachment_id}/download")
async def download_attachment(
    attachment_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Download attachment file by ID.

    Args:
        attachment_id: Attachment ID from database
        db: Database session

    Returns:
        FileResponse with the attachment file

    Raises:
        HTTPException 404: If attachment not found in database
        HTTPException 404: If file not found on disk
    """
    # Get attachment from database
    attachment = await get_attachment_by_id(attachment_id, db)

    if not attachment:
        logger.warning(f"Attachment not found: {attachment_id}")
        raise HTTPException(
            status_code=404,
            detail="Attachment not found"
        )

    # Check if file exists
    file_path = Path(attachment.file_path)

    if not file_path.exists():
        logger.error(f"Attachment file missing: {file_path}")
        raise HTTPException(
            status_code=404,
            detail="Attachment file not found on disk"
        )

    # Determine media type from extension
    extension = file_path.suffix.lower()
    media_type_map = {
        ".pdf": "application/pdf",
        ".doc": "application/msword",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".xls": "application/vnd.ms-excel",
        ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".ppt": "application/vnd.ms-powerpoint",
        ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ".zip": "application/zip",
        ".rar": "application/x-rar-compressed",
        ".7z": "application/x-7z-compressed",
        ".txt": "text/plain",
        ".csv": "text/csv",
        ".json": "application/json",
        ".xml": "application/xml",
    }

    media_type = media_type_map.get(extension, "application/octet-stream")

    # Encode filename for Content-Disposition header (RFC 5987)
    # This handles non-ASCII characters (Korean, Japanese, etc.)
    encoded_filename = quote(attachment.filename)

    logger.info(f"Serving attachment: {attachment.filename} (ID: {attachment_id})")

    return FileResponse(
        path=str(file_path),
        media_type=media_type,
        filename=attachment.filename,
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"
        }
    )
