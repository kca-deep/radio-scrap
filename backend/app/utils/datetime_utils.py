"""
Date and time utilities.
"""
from datetime import datetime, timezone
from typing import Optional


def get_current_utc() -> datetime:
    """Get current UTC datetime."""
    return datetime.now(timezone.utc)


def parse_date_string(date_str: str, format: str = "%Y-%m-%d") -> Optional[datetime]:
    """
    Parse date string to datetime object.

    Args:
        date_str: Date string to parse
        format: Date format (default: YYYY-MM-DD)

    Returns:
        Parsed datetime or None if parsing fails
    """
    try:
        return datetime.strptime(date_str, format)
    except (ValueError, TypeError):
        return None
