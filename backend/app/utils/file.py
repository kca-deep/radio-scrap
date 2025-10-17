"""
File system utilities.
"""
import os
import re
from pathlib import Path
from typing import Optional


def ensure_directory(directory: str | Path) -> Path:
    """
    Ensure directory exists, create if it doesn't.

    Args:
        directory: Directory path

    Returns:
        Path object
    """
    path = Path(directory)
    path.mkdir(parents=True, exist_ok=True)
    return path


def sanitize_filename(filename: str, max_length: int = 255) -> str:
    """
    Sanitize filename by removing invalid characters.

    Args:
        filename: Original filename
        max_length: Maximum filename length

    Returns:
        Sanitized filename
    """
    # Remove invalid characters
    filename = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '', filename)

    # Replace multiple spaces with single space
    filename = re.sub(r'\s+', ' ', filename)

    # Trim to max length
    if len(filename) > max_length:
        name, ext = os.path.splitext(filename)
        max_name_length = max_length - len(ext)
        filename = name[:max_name_length] + ext

    return filename.strip()


def get_file_extension(filename: str) -> Optional[str]:
    """
    Extract file extension from filename.

    Args:
        filename: Filename with extension

    Returns:
        Extension (with dot) or None
    """
    _, ext = os.path.splitext(filename)
    return ext.lower() if ext else None
