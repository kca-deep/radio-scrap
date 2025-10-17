"""
Pydantic models for Publication API schema.
"""
from datetime import datetime
from typing import List
from pydantic import BaseModel, Field


class PublicationBase(BaseModel):
    """Base publication schema."""
    title: str = Field(..., description="Magazine title")
    article_ids: List[str] = Field(..., min_length=1, description="List of article UUIDs")


class PublicationCreate(PublicationBase):
    """Schema for creating a publication."""
    pass


class Publication(PublicationBase):
    """Schema for publication response."""
    id: str = Field(..., description="Publication UUID")
    html_path: str = Field(..., description="Path to generated HTML file")
    created_at: datetime = Field(..., description="Creation timestamp")
    sent_at: datetime | None = Field(None, description="Email sent timestamp")

    model_config = {"from_attributes": True}
