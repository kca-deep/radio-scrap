"""
Pydantic models for common API responses.
"""
from typing import Any, Dict
from pydantic import BaseModel, Field


class SuccessResponse(BaseModel):
    """Generic success response."""
    success: bool = Field(True, description="Operation success status")
    message: str = Field(..., description="Success message")
    data: Dict[str, Any] | None = Field(None, description="Additional response data")


class ErrorResponse(BaseModel):
    """Generic error response."""
    success: bool = Field(False, description="Operation success status")
    error: str = Field(..., description="Error type")
    message: str = Field(..., description="Error message")
    details: Dict[str, Any] | None = Field(None, description="Additional error details")
