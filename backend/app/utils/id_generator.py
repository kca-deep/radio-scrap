"""
UUID generation utilities.
"""
import uuid


def generate_id(prefix: str = "") -> str:
    """
    Generate unique ID with optional prefix.

    Args:
        prefix: Optional prefix for the ID (e.g., 'art', 'scr', 'pub')

    Returns:
        Unique ID string with prefix if provided

    Examples:
        >>> generate_id("art")
        'art-abc123...'
        >>> generate_id()
        'abc123...'
    """
    unique_id = str(uuid.uuid4())
    return f"{prefix}-{unique_id}" if prefix else unique_id


def generate_article_id() -> str:
    """Generate unique article ID."""
    return generate_id("art")


def generate_job_id() -> str:
    """Generate unique job ID."""
    return generate_id("scr")


def generate_publication_id() -> str:
    """Generate unique publication ID."""
    return generate_id("pub")
