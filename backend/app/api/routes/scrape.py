"""
Scraping API routes.
Handles Excel upload and scraping job management.
"""
import asyncio
import json
import logging
from pathlib import Path
from tempfile import NamedTemporaryFile

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import ScrapeJobStatus, StartScrapeRequest, SuccessResponse
from app.services.db_service import create_scrape_job, get_scrape_job
from app.services.sse_service import get_sse_events
from app.services import scraper
from app.services.job_store import store_job_urls, get_job_urls
from app.utils.excel_parser import parse_url_excel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/scrape", tags=["Scraping"])


@router.post("/upload")
async def upload_excel(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    """
    Upload Excel file with URL list.
    Parses the file and creates a scrape job.

    Expected Excel columns:
    - title: Article title
    - date: Publication date
    - link: Article URL
    - source: Source organization

    Returns:
        {
            "job_id": "scr-xxx",
            "total_urls": 10
        }
    """
    # Validate file type
    if not file.filename or not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Please upload an Excel file (.xlsx or .xls)"
        )

    try:
        # Save uploaded file to temporary location
        with NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name

        logger.info(f"Uploaded Excel file: {file.filename} ({len(content)} bytes)")

        # Parse Excel file
        try:
            url_items = parse_url_excel(tmp_path)
        finally:
            # Clean up temp file
            Path(tmp_path).unlink(missing_ok=True)

        if not url_items:
            raise HTTPException(
                status_code=400,
                detail="No valid URLs found in Excel file"
            )

        # Create scrape job
        job_id = await create_scrape_job(len(url_items), db)

        # Store URL items in memory
        store_job_urls(job_id, url_items)

        logger.info(f"Created scrape job {job_id} with {len(url_items)} URLs")

        return {
            "job_id": job_id,
            "total_urls": len(url_items)
        }

    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Excel parsing error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to upload Excel: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to process Excel file: {str(e)}")


@router.post("/start")
async def start_scrape(
    request: StartScrapeRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """
    Start background scraping job.

    Request body:
        {
            "job_id": "scr-xxx"
        }

    Returns:
        {
            "success": true,
            "message": "Scraping started",
            "data": {"job_id": "scr-xxx"}
        }
    """
    # Verify job exists
    job = await get_scrape_job(request.job_id, db)

    if not job:
        raise HTTPException(
            status_code=404,
            detail=f"Scrape job not found: {request.job_id}"
        )

    if job.status != "pending":
        raise HTTPException(
            status_code=400,
            detail=f"Job already {job.status}. Cannot start."
        )

    # Get URL items from job store
    url_items = get_job_urls(request.job_id)

    if not url_items:
        raise HTTPException(
            status_code=404,
            detail=f"URL items not found for job {request.job_id}. Please re-upload the Excel file."
        )

    logger.info(f"Starting scrape job {request.job_id} with {len(url_items)} URLs")

    # Add scraping task to background
    background_tasks.add_task(scraper.process_url_list, request.job_id, url_items, db)

    return SuccessResponse(
        message="Scraping started",
        data={"job_id": request.job_id}
    )


@router.get("/status/{job_id}", response_model=ScrapeJobStatus)
async def get_scrape_status(
    job_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get scraping job progress (REST endpoint).

    Returns:
        {
            "job_id": "scr-xxx",
            "status": "processing",
            "progress": 50.0,
            "processed_urls": 5,
            "total_urls": 10,
            "message": "Processing..."
        }
    """
    job = await get_scrape_job(job_id, db)

    if not job:
        raise HTTPException(
            status_code=404,
            detail=f"Scrape job not found: {job_id}"
        )

    progress = (job.processed_urls / job.total_urls * 100) if job.total_urls > 0 else 0.0

    return ScrapeJobStatus(
        job_id=job.job_id,
        status=job.status,
        progress=progress,
        processed_urls=job.processed_urls,
        total_urls=job.total_urls,
        message=f"Processed {job.processed_urls}/{job.total_urls} URLs"
    )


@router.get("/stream/{job_id}")
async def stream_scrape_progress(job_id: str):
    """
    Stream scraping progress via Server-Sent Events (SSE).

    Usage:
        const eventSource = new EventSource('/api/scrape/stream/{job_id}');
        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log(data.processed, data.total);
        };

    Event format:
        data: {"processed": 5, "total": 10, "current_url": "...", "status": "success"}
    """
    async def event_generator():
        """Generate SSE events."""
        try:
            while True:
                # Get new events from queue
                events = await get_sse_events(job_id)

                if events:
                    for event in events:
                        # Format as SSE
                        yield f"data: {json.dumps(event)}\n\n"

                        # Check if job is completed
                        if event.get('status') in ('completed', 'failed'):
                            logger.info(f"SSE stream completed for job {job_id}")
                            return

                # Wait before checking for new events
                await asyncio.sleep(1)

        except Exception as e:
            logger.error(f"SSE stream error for job {job_id}: {e}")
            error_event = {
                'status': 'error',
                'error': str(e)
            }
            yield f"data: {json.dumps(error_event)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
