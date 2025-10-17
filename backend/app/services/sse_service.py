"""
Server-Sent Events (SSE) service for real-time progress tracking.
In-memory event queue for scraping and translation jobs.
"""
import asyncio
import logging
from collections import defaultdict, deque
from typing import Any

logger = logging.getLogger(__name__)

# In-memory event queues
# job_id -> deque of events (max 100 events per job)
_event_queues: dict[str, deque[dict[str, Any]]] = defaultdict(lambda: deque(maxlen=100))

# Job completion flags
_completed_jobs: set[str] = set()


async def send_sse_event(job_id: str, event: dict[str, Any]) -> None:
    """
    Add an event to the SSE queue for a specific job.

    Args:
        job_id: Job identifier (scrape_job_id or translate_job_id)
        event: Event data dictionary (will be JSON serialized)

    Examples:
        >>> await send_sse_event("job-123", {
        ...     "processed": 5,
        ...     "total": 10,
        ...     "current_url": "https://example.com"
        ... })
        >>>
        >>> await send_sse_event("job-123", {
        ...     "status": "completed",
        ...     "total_processed": 10
        ... })
    """
    _event_queues[job_id].append(event)
    logger.debug(f"SSE event added for job {job_id}: {event}")

    # Mark job as completed if status is 'completed' or 'failed'
    if event.get('status') in ('completed', 'failed'):
        _completed_jobs.add(job_id)
        logger.info(f"Job {job_id} marked as {event.get('status')}")


async def get_sse_events(job_id: str) -> list[dict[str, Any]]:
    """
    Retrieve and consume all pending events for a job.

    Args:
        job_id: Job identifier

    Returns:
        List of event dictionaries (oldest first)
        Empty list if no events are available

    Note:
        This method consumes (clears) the events after retrieval.
        If you need to preserve events, use peek_sse_events() instead.
    """
    if job_id not in _event_queues:
        return []

    events = list(_event_queues[job_id])
    _event_queues[job_id].clear()

    logger.debug(f"Retrieved {len(events)} SSE events for job {job_id}")
    return events


async def peek_sse_events(job_id: str) -> list[dict[str, Any]]:
    """
    Retrieve events without consuming them.

    Args:
        job_id: Job identifier

    Returns:
        List of event dictionaries (does not clear the queue)
    """
    if job_id not in _event_queues:
        return []

    return list(_event_queues[job_id])


def is_job_completed(job_id: str) -> bool:
    """
    Check if a job has been marked as completed.

    Args:
        job_id: Job identifier

    Returns:
        True if job is completed or failed, False otherwise
    """
    return job_id in _completed_jobs


def clear_job_events(job_id: str) -> None:
    """
    Clear all events and completion flag for a job.

    Args:
        job_id: Job identifier

    Note:
        This should be called after the SSE connection is closed
        or when you want to reset a job's event history.
    """
    if job_id in _event_queues:
        del _event_queues[job_id]
        logger.debug(f"Cleared event queue for job {job_id}")

    if job_id in _completed_jobs:
        _completed_jobs.remove(job_id)
        logger.debug(f"Removed completion flag for job {job_id}")


async def stream_sse_events(job_id: str, poll_interval: float = 1.0):
    """
    Async generator that yields SSE events for a job.

    This is designed to be used with FastAPI's StreamingResponse.

    Args:
        job_id: Job identifier
        poll_interval: Seconds to wait between checks (default: 1.0)

    Yields:
        SSE-formatted strings: "data: {json}\n\n"

    Example usage with FastAPI:
        >>> from fastapi.responses import StreamingResponse
        >>> @app.get("/status/{job_id}")
        >>> async def get_status(job_id: str):
        >>>     return StreamingResponse(
        >>>         stream_sse_events(job_id),
        >>>         media_type="text/event-stream"
        >>>     )
    """
    import json

    logger.info(f"Starting SSE stream for job {job_id}")

    try:
        while True:
            # Check if job is completed
            if is_job_completed(job_id):
                # Send any remaining events
                events = await get_sse_events(job_id)
                for event in events:
                    yield f"data: {json.dumps(event)}\n\n"

                logger.info(f"SSE stream ended for completed job {job_id}")
                break

            # Get pending events
            events = await get_sse_events(job_id)

            if events:
                for event in events:
                    yield f"data: {json.dumps(event)}\n\n"

            # Wait before next poll
            await asyncio.sleep(poll_interval)

    except asyncio.CancelledError:
        logger.info(f"SSE stream cancelled for job {job_id}")
        raise

    except Exception as e:
        logger.error(f"Error in SSE stream for job {job_id}: {e}")
        # Send error event
        error_event = {"status": "error", "message": str(e)}
        yield f"data: {json.dumps(error_event)}\n\n"

    finally:
        # Optional: Clear events after stream ends
        # Uncomment if you want to automatically clean up
        # clear_job_events(job_id)
        pass


def get_active_jobs() -> list[str]:
    """
    Get list of all active job IDs with pending events.

    Returns:
        List of job identifiers
    """
    return list(_event_queues.keys())


def get_queue_stats() -> dict[str, int]:
    """
    Get statistics about the event queues.

    Returns:
        Dictionary with queue statistics
    """
    return {
        "total_jobs": len(_event_queues),
        "completed_jobs": len(_completed_jobs),
        "total_events": sum(len(q) for q in _event_queues.values())
    }
