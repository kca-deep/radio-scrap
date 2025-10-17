"""
Excel file parser for URL list uploads.
Extracts article metadata (title, date, link, source) from Excel files.
"""
import logging
from datetime import date
from pathlib import Path
from typing import Optional

import pandas as pd
from pydantic import BaseModel, HttpUrl, field_validator

logger = logging.getLogger(__name__)


class URLItem(BaseModel):
    """Parsed URL item from Excel."""
    title: str
    date: Optional[date] = None
    link: HttpUrl
    source: str

    @field_validator('title', 'source')
    @classmethod
    def validate_not_empty(cls, v: str) -> str:
        """Ensure title and source are not empty."""
        if not v or not v.strip():
            raise ValueError("Field cannot be empty")
        return v.strip()


def parse_url_excel(file_path: str | Path) -> list[URLItem]:
    """
    Parse Excel file containing URL list.

    Expected columns:
    - title: Article title (str, required)
    - date: Publication date (date, optional)
    - link: Article URL (str, required)
    - source: Source organization (str, required)

    Args:
        file_path: Path to Excel file (.xlsx, .xls)

    Returns:
        List of URLItem objects

    Raises:
        FileNotFoundError: If file doesn't exist
        ValueError: If required columns are missing or data is invalid
        pd.errors.EmptyDataError: If file is empty

    Examples:
        >>> items = parse_url_excel("urls.xlsx")
        >>> len(items)
        10
        >>> items[0].title
        'FCC Proposes New Spectrum Rules'
    """
    file_path = Path(file_path)

    if not file_path.exists():
        raise FileNotFoundError(f"Excel file not found: {file_path}")

    logger.info(f"Parsing Excel file: {file_path}")

    try:
        # Read Excel file
        df = pd.read_excel(file_path)

        if df.empty:
            raise pd.errors.EmptyDataError("Excel file is empty")

        logger.info(f"Read {len(df)} rows from Excel")

        # Validate required columns
        required_cols = {'title', 'date', 'link', 'source'}
        existing_cols = set(df.columns)

        missing_cols = required_cols - existing_cols
        if missing_cols:
            raise ValueError(f"Missing required columns: {missing_cols}")

        # Parse each row
        url_items = []
        errors = []

        for idx, row in df.iterrows():
            try:
                # Handle date conversion
                row_date = None
                if pd.notna(row['date']):
                    if isinstance(row['date'], pd.Timestamp):
                        row_date = row['date'].date()
                    elif isinstance(row['date'], date):
                        row_date = row['date']
                    else:
                        # Try to parse string date
                        try:
                            row_date = pd.to_datetime(row['date']).date()
                        except Exception as e:
                            logger.warning(f"Row {idx + 2}: Invalid date format '{row['date']}': {e}")

                # Create URLItem
                item = URLItem(
                    title=str(row['title']),
                    date=row_date,
                    link=str(row['link']),
                    source=str(row['source'])
                )
                url_items.append(item)

            except Exception as e:
                error_msg = f"Row {idx + 2}: {str(e)}"
                errors.append(error_msg)
                logger.error(error_msg)

        # Report parsing results
        logger.info(f"Successfully parsed {len(url_items)}/{len(df)} rows")

        if errors:
            logger.warning(f"Failed to parse {len(errors)} rows:")
            for error in errors[:5]:  # Show first 5 errors
                logger.warning(f"  {error}")
            if len(errors) > 5:
                logger.warning(f"  ... and {len(errors) - 5} more errors")

        if not url_items:
            raise ValueError("No valid URL items found in Excel file")

        return url_items

    except pd.errors.EmptyDataError as e:
        logger.error(f"Excel file is empty: {e}")
        raise

    except Exception as e:
        logger.error(f"Failed to parse Excel file: {e}")
        raise


def validate_excel_structure(file_path: str | Path) -> dict[str, any]:
    """
    Validate Excel file structure without full parsing.

    Args:
        file_path: Path to Excel file

    Returns:
        Dictionary with validation results:
        {
            'valid': bool,
            'row_count': int,
            'columns': list[str],
            'missing_columns': list[str],
            'errors': list[str]
        }
    """
    file_path = Path(file_path)
    result = {
        'valid': False,
        'row_count': 0,
        'columns': [],
        'missing_columns': [],
        'errors': []
    }

    try:
        if not file_path.exists():
            result['errors'].append(f"File not found: {file_path}")
            return result

        df = pd.read_excel(file_path)
        result['row_count'] = len(df)
        result['columns'] = list(df.columns)

        # Check required columns
        required_cols = {'title', 'date', 'link', 'source'}
        existing_cols = set(df.columns)
        missing_cols = required_cols - existing_cols

        if missing_cols:
            result['missing_columns'] = list(missing_cols)
            result['errors'].append(f"Missing columns: {missing_cols}")
        else:
            result['valid'] = True

    except Exception as e:
        result['errors'].append(str(e))

    return result
