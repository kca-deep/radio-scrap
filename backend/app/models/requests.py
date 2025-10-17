"""
Pydantic models for API request bodies.
"""
from typing import List
from pydantic import BaseModel, Field, EmailStr


class StartScrapeRequest(BaseModel):
    """Request body for starting a scrape job."""
    job_id: str = Field(..., description="Job UUID returned from upload")


class TranslateRequest(BaseModel):
    """Request body for translating articles."""
    article_ids: List[str] = Field(..., min_length=1, description="List of article UUIDs to translate")


class PublishHTMLRequest(BaseModel):
    """Request body for generating HTML magazine."""
    title: str = Field(..., description="Magazine title")
    article_ids: List[str] = Field(..., min_length=1, description="List of article UUIDs")


class SendEmailRequest(BaseModel):
    """Request body for sending email."""
    publication_id: str = Field(..., description="Publication UUID")
    recipients: List[EmailStr] = Field(..., min_length=1, description="List of recipient email addresses")
    subject: str = Field(..., description="Email subject")
