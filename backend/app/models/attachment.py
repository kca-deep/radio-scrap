"""
Pydantic models for Attachment API schema.
"""
from datetime import datetime
from pydantic import BaseModel, Field


class AttachmentBase(BaseModel):
    """Base attachment schema."""
    filename: str = Field(..., description="File name")
    file_url: str | None = Field(None, description="Original file URL")


class AttachmentCreate(AttachmentBase):
    """Schema for creating an attachment."""
    article_id: str = Field(..., description="Associated article ID")
    file_path: str = Field(..., description="Local file path")


class Attachment(AttachmentBase):
    """Schema for attachment response."""
    id: int = Field(..., description="Attachment ID")
    article_id: str = Field(..., description="Associated article ID")
    file_path: str = Field(..., description="Local file path")
    downloaded_at: datetime = Field(..., description="Download timestamp")

    model_config = {"from_attributes": True}
