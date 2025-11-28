"""
API routes package.
Aggregates all route modules into a single router.
"""
from fastapi import APIRouter

from app.api.routes import scrape, articles, attachments, translate, publish, auto_collect

# Create main API router
api_router = APIRouter()

# Include all route modules
api_router.include_router(scrape.router)
api_router.include_router(auto_collect.router)
api_router.include_router(articles.router)
api_router.include_router(attachments.router)
api_router.include_router(translate.router)
api_router.include_router(publish.router)

__all__ = ["api_router"]
