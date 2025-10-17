"""
Common enums and types used across Pydantic models.
"""
from enum import Enum


class StatusEnum(str, Enum):
    """Article status."""
    SCRAPED = "scraped"
    TRANSLATED = "translated"


class JobStatusEnum(str, Enum):
    """Job status for background tasks."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class CountryCodeEnum(str, Enum):
    """Country codes for article sources."""
    KR = "KR"
    US = "US"
    UK = "UK"
    JP = "JP"
