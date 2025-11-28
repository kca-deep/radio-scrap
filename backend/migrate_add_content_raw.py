"""
Migration script to add content_raw column and copy existing data.
Run this once to update the database schema.
"""
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "database.db"

def migrate():
    print(f"Migrating database: {DB_PATH}")

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # Check if column already exists
        cursor.execute("PRAGMA table_info(articles)")
        columns = [col[1] for col in cursor.fetchall()]

        if "content_raw" in columns:
            print("content_raw column already exists. Skipping migration.")
            return

        # Add content_raw column
        print("Adding content_raw column...")
        cursor.execute("ALTER TABLE articles ADD COLUMN content_raw TEXT")

        # Copy existing content to content_raw (preserve original)
        print("Copying existing content to content_raw...")
        cursor.execute("UPDATE articles SET content_raw = content WHERE content_raw IS NULL")

        conn.commit()
        print("Migration completed successfully!")

        # Verify
        cursor.execute("SELECT COUNT(*) FROM articles WHERE content_raw IS NOT NULL")
        count = cursor.fetchone()[0]
        print(f"Updated {count} articles with content_raw")

    except Exception as e:
        print(f"Migration failed: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
