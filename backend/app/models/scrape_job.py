"""
Pydantic models for ScrapeJob API schema.
"""
from datetime import datetime
from pydantic import BaseModel, Field

from app.models.common import JobStatusEnum


class ScrapeJobBase(BaseModel):
    """Base scrape job schema."""
    total_urls: int = Field(..., ge=1, description="Total number of URLs")


class ScrapeJobCreate(ScrapeJobBase):
    """Schema for creating a scrape job."""
    job_id: str = Field(..., description="Job UUID")


class ScrapeJob(ScrapeJobBase):
    """Schema for scrape job response."""
    job_id: str = Field(..., description="Job UUID")
    status: JobStatusEnum = Field(..., description="Job status")
    processed_urls: int = Field(..., description="Number of processed URLs")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")

    model_config = {"from_attributes": True}


class ScrapeJobStatus(BaseModel):
    """Schema for scrape job progress."""
    job_id: str
    status: JobStatusEnum
    progress: float = Field(..., ge=0.0, le=100.0, description="Progress percentage")
    processed_urls: int
    total_urls: int
    message: str | None = None
