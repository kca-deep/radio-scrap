"""
Pydantic models for Article API schema.
"""
from datetime import datetime, date
from typing import List

from pydantic import BaseModel, Field, HttpUrl

from app.models.common import StatusEnum, CountryCodeEnum
from app.models.attachment import Attachment


class ArticleBase(BaseModel):
    """Base article schema with common fields."""
    url: HttpUrl = Field(..., description="Article URL")
    title: str | None = Field(None, description="Original title")
    source: str | None = Field(None, description="Source name")
    country_code: CountryCodeEnum | None = Field(None, description="Country code")
    published_date: date | None = Field(None, description="Publication date")


class ArticleCreate(ArticleBase):
    """Schema for creating an article."""
    content: str | None = Field(None, description="Article content (markdown)")


class ArticleUpdate(BaseModel):
    """Schema for updating an article (all fields optional)."""
    title: str | None = None
    title_ko: str | None = None
    content: str | None = None
    content_ko: str | None = None
    status: StatusEnum | None = None


class Article(ArticleBase):
    """Schema for article response with full details."""
    id: str = Field(..., description="Article UUID")
    title_ko: str | None = Field(None, description="Translated title")
    content: str | None = Field(None, description="Original content")
    content_ko: str | None = Field(None, description="Translated content")
    status: StatusEnum = Field(..., description="Processing status")
    scraped_at: datetime = Field(..., description="Scrape timestamp")
    translated_at: datetime | None = Field(None, description="Translation timestamp")
    attachments: List[Attachment] = Field(default_factory=list, description="Associated files")

    model_config = {"from_attributes": True}


class ArticleList(BaseModel):
    """Schema for article list response (simplified)."""
    id: str
    url: str
    title: str | None
    title_ko: str | None
    source: str | None
    country_code: CountryCodeEnum | None
    published_date: date | None
    status: StatusEnum
    scraped_at: datetime
    translated_at: datetime | None = None
    attachments_count: int = 0

    model_config = {"from_attributes": True}
