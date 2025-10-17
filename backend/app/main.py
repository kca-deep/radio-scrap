"""
FastAPI main application.
Configures CORS, lifespan events, and API routes.
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db, close_db
from app.api import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan context manager.
    Handles startup and shutdown events.
    """
    # Startup
    print(f"[STARTUP] Starting FastAPI application (DEBUG={settings.DEBUG})")
    await init_db()
    print("[STARTUP] Database initialized")

    yield

    # Shutdown
    print("[SHUTDOWN] Shutting down FastAPI application")
    await close_db()
    print("[SHUTDOWN] Database connections closed")


# Create FastAPI app instance
app = FastAPI(
    title="Radio Policy Magazine API",
    description="Automated web scraping, translation, and magazine generation system",
    version="1.0.0",
    lifespan=lifespan,
    debug=settings.DEBUG,
)

# Configure CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Health check endpoint
@app.get("/health", tags=["Health"])
async def health_check():
    """
    Health check endpoint.
    Returns 200 OK if the service is running.
    """
    return {
        "status": "healthy",
        "service": "radio-scrap-backend",
        "version": "1.0.0"
    }


# Include API router
app.include_router(api_router, prefix="/api")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
    )
