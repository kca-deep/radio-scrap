"""
UUID generation utilities.
"""
import uuid


def generate_article_id() -> str:
    """Generate unique article ID."""
    return str(uuid.uuid4())


def generate_job_id() -> str:
    """Generate unique job ID."""
    return str(uuid.uuid4())


def generate_publication_id() -> str:
    """Generate unique publication ID."""
    return str(uuid.uuid4())
