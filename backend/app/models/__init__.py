"""Pydantic models package."""
from app.models.common import StatusEnum, JobStatusEnum, CountryCodeEnum
from app.models.attachment import Attachment, AttachmentCreate, AttachmentBase
from app.models.article import Article, ArticleCreate, ArticleUpdate, ArticleList, ArticleBase
from app.models.scrape_job import ScrapeJob, ScrapeJobCreate, ScrapeJobStatus, ScrapeJobBase
from app.models.publication import Publication, PublicationCreate, PublicationBase
from app.models.requests import (
    StartScrapeRequest,
    TranslateRequest,
    PublishHTMLRequest,
    SendEmailRequest,
)
from app.models.responses import SuccessResponse, ErrorResponse

__all__ = [
    # Enums
    "StatusEnum",
    "JobStatusEnum",
    "CountryCodeEnum",
    # Attachments
    "Attachment",
    "AttachmentCreate",
    "AttachmentBase",
    # Articles
    "Article",
    "ArticleCreate",
    "ArticleUpdate",
    "ArticleList",
    "ArticleBase",
    # Scrape Jobs
    "ScrapeJob",
    "ScrapeJobCreate",
    "ScrapeJobStatus",
    "ScrapeJobBase",
    # Publications
    "Publication",
    "PublicationCreate",
    "PublicationBase",
    # Requests
    "StartScrapeRequest",
    "TranslateRequest",
    "PublishHTMLRequest",
    "SendEmailRequest",
    # Responses
    "SuccessResponse",
    "ErrorResponse",
]
