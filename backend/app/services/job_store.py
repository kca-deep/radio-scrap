"""
In-memory job storage for URL items.
Temporary solution until URL items are stored in database.
"""
from collections import defaultdict
from typing import Optional

from app.utils.excel_parser import URLItem

# In-memory storage: job_id -> list[URLItem]
_job_url_items: dict[str, list[URLItem]] = defaultdict(list)


def store_job_urls(job_id: str, url_items: list[URLItem]) -> None:
    """
    Store URL items for a job.

    Args:
        job_id: Job ID
        url_items: List of URLItem objects
    """
    _job_url_items[job_id] = url_items


def get_job_urls(job_id: str) -> Optional[list[URLItem]]:
    """
    Retrieve URL items for a job.

    Args:
        job_id: Job ID

    Returns:
        List of URLItem objects or None if not found
    """
    return _job_url_items.get(job_id)


def clear_job_urls(job_id: str) -> None:
    """
    Clear URL items for a job (cleanup after processing).

    Args:
        job_id: Job ID
    """
    if job_id in _job_url_items:
        del _job_url_items[job_id]


def get_all_job_ids() -> list[str]:
    """
    Get all stored job IDs.

    Returns:
        List of job IDs
    """
    return list(_job_url_items.keys())
