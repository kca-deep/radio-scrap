"""
Date utility functions for auto-scrapers.
Handles date parsing and filtering for different sources.
"""

import re
from datetime import datetime, timedelta
from typing import Optional
from dateutil import parser as date_parser


def parse_date_flexible(date_str: str) -> Optional[datetime]:
    """
    Parse date string in various formats.

    Supported formats:
    - "March 25, 2025"
    - "25 March 2025"
    - "Published: 25 March 2025"
    - "2025-03-25"
    - ISO 8601

    Args:
        date_str: Date string to parse

    Returns:
        datetime object or None if parsing fails
    """
    if not date_str:
        return None

    try:
        # Remove common prefixes
        clean_str = date_str.replace('Published:', '').replace('Last updated:', '').strip()

        # Try dateutil parser (handles most formats)
        return date_parser.parse(clean_str, fuzzy=True)
    except Exception:
        return None


def parse_japanese_era_date(date_str: str) -> Optional[datetime]:
    """
    Parse Japanese date formats.

    Supported formats:
    - R7.1.17 (Reiwa era: R{year}.{month}.{day})
    - 2025年11月25日 (Japanese format: {year}年{month}月{day}日)

    Args:
        date_str: Japanese date string

    Returns:
        datetime object or None if parsing fails
    """
    if not date_str:
        return None

    date_str = date_str.strip()

    try:
        # Try Japanese format: 2025年11月25日
        jp_match = re.match(r'(\d{4})年(\d{1,2})月(\d{1,2})日', date_str)
        if jp_match:
            year = int(jp_match.group(1))
            month = int(jp_match.group(2))
            day = int(jp_match.group(3))
            return datetime(year, month, day)

        # Try Reiwa era format: R7.1.17
        era_match = re.match(r'R(\d+)\.(\d+)\.(\d+)', date_str)
        if era_match:
            reiwa_year = int(era_match.group(1))
            month = int(era_match.group(2))
            day = int(era_match.group(3))
            # Convert Reiwa year to Gregorian year
            # Reiwa 1 = 2019 (started May 1, 2019)
            gregorian_year = 2018 + reiwa_year
            return datetime(gregorian_year, month, day)

        return None
    except Exception:
        return None


def get_date_range_boundaries(range_type: str) -> tuple[datetime, datetime]:
    """
    Get start and end datetime for a date range.

    Args:
        range_type: 'today', 'this-week', 'last-week', 'this-month', 'last-month',
                    or 'YYYY-MM' format for specific month

    Returns:
        Tuple of (start_date, end_date)
    """
    now = datetime.now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = now.replace(hour=23, minute=59, second=59, microsecond=999999)

    if range_type == 'today':
        return today_start, today_end

    elif range_type == 'this-week':
        # Monday to Sunday of current week
        weekday = now.weekday()  # Monday = 0, Sunday = 6
        week_start = today_start - timedelta(days=weekday)
        week_end = week_start + timedelta(days=6, hours=23, minutes=59, seconds=59)
        return week_start, week_end

    elif range_type == 'last-week':
        # Monday to Sunday of last week
        weekday = now.weekday()
        last_week_start = today_start - timedelta(days=weekday + 7)
        last_week_end = last_week_start + timedelta(days=6, hours=23, minutes=59, seconds=59)
        return last_week_start, last_week_end

    elif range_type == 'this-month':
        # First to last day of current month
        month_start = today_start.replace(day=1)
        # Get last day of month
        if now.month == 12:
            next_month = month_start.replace(year=now.year + 1, month=1)
        else:
            next_month = month_start.replace(month=now.month + 1)
        month_end = next_month - timedelta(seconds=1)
        return month_start, month_end

    elif range_type == 'last-month':
        # First to last day of previous month
        first_of_this_month = today_start.replace(day=1)
        last_month_end = first_of_this_month - timedelta(seconds=1)
        last_month_start = last_month_end.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        return last_month_start, last_month_end

    # Check for YYYY-MM~YYYY-MM format (month range)
    range_match = re.match(r'^(\d{4})-(\d{2})~(\d{4})-(\d{2})$', range_type)
    if range_match:
        start_year = int(range_match.group(1))
        start_month = int(range_match.group(2))
        end_year = int(range_match.group(3))
        end_month = int(range_match.group(4))

        range_start = datetime(start_year, start_month, 1, 0, 0, 0)
        # Get last day of end month
        if end_month == 12:
            next_month = datetime(end_year + 1, 1, 1)
        else:
            next_month = datetime(end_year, end_month + 1, 1)
        range_end = next_month - timedelta(seconds=1)
        return range_start, range_end

    # Check for YYYY-MM format (specific month)
    month_match = re.match(r'^(\d{4})-(\d{2})$', range_type)
    if month_match:
        year = int(month_match.group(1))
        month = int(month_match.group(2))
        month_start = datetime(year, month, 1, 0, 0, 0)
        # Get last day of month
        if month == 12:
            next_month = datetime(year + 1, 1, 1)
        else:
            next_month = datetime(year, month + 1, 1)
        month_end = next_month - timedelta(seconds=1)
        return month_start, month_end

    # Default to this month
    month_start = today_start.replace(day=1)
    if now.month == 12:
        next_month = month_start.replace(year=now.year + 1, month=1)
    else:
        next_month = month_start.replace(month=now.month + 1)
    month_end = next_month - timedelta(seconds=1)
    return month_start, month_end


def is_date_in_range(date: Optional[datetime], range_type: str) -> bool:
    """
    Check if a date falls within the specified range.

    Args:
        date: datetime to check (None returns False)
        range_type: 'today', 'this-week', 'last-week'

    Returns:
        True if date is in range, False otherwise
    """
    if not date:
        return False

    start_date, end_date = get_date_range_boundaries(range_type)
    return start_date <= date <= end_date


def format_date_for_display(date: Optional[datetime]) -> Optional[str]:
    """
    Format datetime for display.

    Args:
        date: datetime object

    Returns:
        Formatted date string or None
    """
    if not date:
        return None

    return date.strftime('%Y-%m-%d')
