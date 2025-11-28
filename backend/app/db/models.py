"""
SQLAlchemy ORM models for database tables.
Defines the schema for articles, attachments, scrape_jobs, and publications.
"""
from datetime import datetime
from typing import List

from sqlalchemy import String, Text, DateTime, Integer, Date, ForeignKey, JSON, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base


class ArticleModel(Base):
    """
    Article table - stores scraped articles with translation status.
    """
    __tablename__ = "articles"

    # Primary Key
    id: Mapped[str] = mapped_column(String(36), primary_key=True)

    # Article Content
    url: Mapped[str] = mapped_column(String(512), unique=True, nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(512), nullable=True)
    title_ko: Mapped[str] = mapped_column(String(512), nullable=True)
    content_raw: Mapped[str] = mapped_column(Text, nullable=True)  # Raw markdown from Firecrawl
    content: Mapped[str] = mapped_column(Text, nullable=True)  # Cleaned/extracted content
    content_ko: Mapped[str] = mapped_column(Text, nullable=True)  # Translated content
    content_html: Mapped[str] = mapped_column(Text, nullable=True)  # Raw HTML from Firecrawl

    # Metadata
    source: Mapped[str] = mapped_column(String(128), nullable=True)
    country_code: Mapped[str] = mapped_column(String(2), nullable=True, index=True)
    published_date: Mapped[datetime] = mapped_column(Date, nullable=True, index=True)

    # Status & Timestamps
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="scraped", index=True)
    scraped_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    translated_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)

    # Relationships
    attachments: Mapped[List["AttachmentModel"]] = relationship(
        "AttachmentModel",
        back_populates="article",
        cascade="all, delete-orphan"
    )

    # Indexes
    __table_args__ = (
        Index("idx_country_status", "country_code", "status"),
        Index("idx_published_status", "published_date", "status"),
    )


class AttachmentModel(Base):
    """
    Attachment table - stores files associated with articles.
    """
    __tablename__ = "attachments"

    # Primary Key
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Foreign Key
    article_id: Mapped[str] = mapped_column(String(36), ForeignKey("articles.id"), nullable=False, index=True)

    # File Information
    filename: Mapped[str] = mapped_column(String(256), nullable=False)
    file_path: Mapped[str] = mapped_column(String(512), nullable=False)
    file_url: Mapped[str] = mapped_column(String(512), nullable=True)

    # Timestamp
    downloaded_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    # Relationships
    article: Mapped["ArticleModel"] = relationship(
        "ArticleModel",
        back_populates="attachments"
    )


class ScrapeJobModel(Base):
    """
    ScrapeJob table - tracks background scraping jobs.
    """
    __tablename__ = "scrape_jobs"

    # Primary Key
    job_id: Mapped[str] = mapped_column(String(36), primary_key=True)

    # Job Status
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending", index=True)

    # Progress Tracking
    total_urls: Mapped[int] = mapped_column(Integer, nullable=False)
    processed_urls: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )


class PublicationModel(Base):
    """
    Publication table - stores generated HTML magazines.
    """
    __tablename__ = "publications"

    # Primary Key
    id: Mapped[str] = mapped_column(String(36), primary_key=True)

    # Publication Information
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    article_ids: Mapped[dict] = mapped_column(JSON, nullable=False)  # List of article IDs
    html_path: Mapped[str] = mapped_column(String(512), nullable=False)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    sent_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
