"""
Migration script to reorganize attachments into hierarchical folder structure.

This script:
1. Reads all attachments from the database
2. Gets the associated article metadata (country_code, source, published_date)
3. Moves files from flat structure to: {country}/{source}/{YYYY-MM}/{article_id}/
4. Updates the file_path in the database

Usage:
    cd backend
    python migrate_attachments.py

Options:
    --dry-run    Show what would be done without making changes
"""
import argparse
import asyncio
import logging
import shutil
import sys
from datetime import datetime
from pathlib import Path

# Add backend to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.db.models import ArticleModel, AttachmentModel
from app.services.firecrawl_service import build_attachment_path, sanitize_folder_name

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


async def migrate_attachments(dry_run: bool = False):
    """
    Migrate attachments to hierarchical folder structure.

    Args:
        dry_run: If True, only show what would be done without making changes
    """
    logger.info("Starting attachment migration...")
    if dry_run:
        logger.info("DRY RUN MODE - No changes will be made")

    # Create database connection
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    base_dir = Path(settings.ATTACHMENT_DIR)

    migrated_count = 0
    skipped_count = 0
    error_count = 0

    async with async_session() as session:
        # Get all attachments with their articles
        stmt = (
            select(AttachmentModel, ArticleModel)
            .join(ArticleModel, AttachmentModel.article_id == ArticleModel.id)
        )
        result = await session.execute(stmt)
        rows = result.all()

        logger.info(f"Found {len(rows)} attachments to process")

        for attachment, article in rows:
            old_path = Path(attachment.file_path)

            # Build new path using article metadata
            new_dir = build_attachment_path(
                base_dir=base_dir,
                article_id=article.id,
                country_code=article.country_code,
                source=article.source,
                published_date=article.published_date
            )
            new_path = new_dir / attachment.filename

            # Check if already migrated (path contains article_id in expected structure)
            if article.id in str(old_path):
                logger.debug(f"Skipping (already migrated): {attachment.filename}")
                skipped_count += 1
                continue

            # Check if old file exists
            if not old_path.exists():
                logger.warning(f"Source file not found: {old_path}")
                error_count += 1
                continue

            # Check if destination already exists
            if new_path.exists():
                logger.warning(f"Destination already exists: {new_path}")
                skipped_count += 1
                continue

            logger.info(f"Migrating: {old_path} -> {new_path}")

            if not dry_run:
                try:
                    # Create destination directory
                    new_dir.mkdir(parents=True, exist_ok=True)

                    # Move file
                    shutil.move(str(old_path), str(new_path))

                    # Update database
                    update_stmt = (
                        update(AttachmentModel)
                        .where(AttachmentModel.id == attachment.id)
                        .values(file_path=str(new_path.absolute()))
                    )
                    await session.execute(update_stmt)

                    migrated_count += 1

                except Exception as e:
                    logger.error(f"Failed to migrate {attachment.filename}: {e}")
                    error_count += 1
            else:
                migrated_count += 1

        # Commit all changes
        if not dry_run:
            await session.commit()
            logger.info("Database changes committed")

    # Summary
    logger.info("=" * 50)
    logger.info("Migration Summary:")
    logger.info(f"  Migrated: {migrated_count}")
    logger.info(f"  Skipped:  {skipped_count}")
    logger.info(f"  Errors:   {error_count}")
    logger.info("=" * 50)

    if dry_run:
        logger.info("DRY RUN complete. Run without --dry-run to apply changes.")

    # Cleanup empty directories in old structure
    if not dry_run and migrated_count > 0:
        logger.info("Cleaning up empty directories...")
        cleanup_empty_dirs(base_dir)


def cleanup_empty_dirs(base_dir: Path):
    """Remove empty directories after migration."""
    # Walk bottom-up to remove empty directories
    for dirpath in sorted(base_dir.rglob("*"), key=lambda p: len(p.parts), reverse=True):
        if dirpath.is_dir():
            try:
                # Only remove if empty
                if not any(dirpath.iterdir()):
                    dirpath.rmdir()
                    logger.debug(f"Removed empty directory: {dirpath}")
            except Exception as e:
                logger.debug(f"Could not remove directory {dirpath}: {e}")


def main():
    parser = argparse.ArgumentParser(
        description="Migrate attachments to hierarchical folder structure"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be done without making changes"
    )
    args = parser.parse_args()

    asyncio.run(migrate_attachments(dry_run=args.dry_run))


if __name__ == "__main__":
    main()
