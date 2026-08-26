import datetime
import mimetypes
import sqlite3
from pathlib import Path

import click
from flask import Flask, current_app, g

from .storage import S3Storage


def _convert_timestamp(val: bytes) -> datetime.datetime:
    return datetime.datetime.fromisoformat(val.decode())


sqlite3.register_converter("timestamp", _convert_timestamp)


def get_db() -> sqlite3.Connection:
    if "db" not in g:
        g.db = sqlite3.connect(
            current_app.config["DATABASE"],
            detect_types=sqlite3.PARSE_DECLTYPES,
        )
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
    return g.db


def close_db(_e=None) -> None:
    db = g.pop("db", None)
    if db is not None:
        db.close()


PEOPLE_COLUMNS: dict[str, str] = {
    "birth_date": "TEXT",
    "death_date": "TEXT",
    "birthplace": "TEXT",
    "profession": "TEXT",
    "profile_image": "TEXT",
}

# Legacy INTEGER year columns superseded by the free-text date columns above.
# Their values are carried over once when upgrading an older database.
_LEGACY_DATE_COLUMNS = (("birth_year", "birth_date"), ("death_year", "death_date"))


def _migrate_people_columns(db: sqlite3.Connection) -> None:
    existing = {row["name"] for row in db.execute("PRAGMA table_info(people)").fetchall()}
    for col, ddl in PEOPLE_COLUMNS.items():
        if col not in existing:
            db.execute(f"ALTER TABLE people ADD COLUMN {col} {ddl}")

    # Copy any legacy year values into the new date columns (as text), once.
    refreshed = {row["name"] for row in db.execute("PRAGMA table_info(people)").fetchall()}
    for old, new in _LEGACY_DATE_COLUMNS:
        if old in refreshed and new in refreshed:
            db.execute(
                f"UPDATE people SET {new} = CAST({old} AS TEXT) "
                f"WHERE {new} IS NULL AND {old} IS NOT NULL"
            )


# Columns added after these tables first shipped; ALTER'd in on upgrade
# because CREATE TABLE IF NOT EXISTS skips existing tables.
PHOTO_COLUMNS: dict[str, str] = {
    "folder_id": "INTEGER REFERENCES folders(id) ON DELETE SET NULL",
    "position": "INTEGER NOT NULL DEFAULT 0",
}

EVENT_PHOTO_COLUMNS: dict[str, str] = {
    "position": "INTEGER NOT NULL DEFAULT 0",
}

FOLDER_COLUMNS: dict[str, str] = {
    "position": "INTEGER NOT NULL DEFAULT 0",
}


def _migrate_photo_columns(db: sqlite3.Connection) -> None:
    tables = (
        ("photos", PHOTO_COLUMNS),
        ("event_photos", EVENT_PHOTO_COLUMNS),
        ("folders", FOLDER_COLUMNS),
    )
    for table, columns in tables:
        existing = {row["name"] for row in db.execute(f"PRAGMA table_info({table})").fetchall()}
        for col, ddl in columns.items():
            if col not in existing:
                db.execute(f"ALTER TABLE {table} ADD COLUMN {col} {ddl}")


def init_db() -> None:
    db = get_db()
    schema = (Path(current_app.root_path) / "schema.sql").read_text()
    db.executescript(schema)
    _migrate_people_columns(db)
    _migrate_photo_columns(db)
    # Pin a single blank settings row so get_settings always returns one.
    db.execute("INSERT OR IGNORE INTO site_settings (id) VALUES (1)")
    db.commit()


@click.command("init-db")
def init_db_command() -> None:
    """Create database tables."""
    init_db()
    click.echo("Initialized the database.")


@click.command("seed-kalevi")
def seed_kalevi_command() -> None:
    """Insert the kalevi person row if missing."""
    db = get_db()
    db.execute(
        "INSERT OR IGNORE INTO people (slug, display_name, bio) VALUES (?, ?, ?)",
        ("kalevi", "Kalevi", "Rakkaudella muistaen."),
    )
    db.commit()
    click.echo("Seeded kalevi.")


@click.command("migrate-media-to-s3")
def migrate_media_to_s3_command() -> None:
    """Upload every file under MEDIA_ROOT into the configured S3 bucket."""
    if current_app.config["STORAGE_BACKEND"] != "s3":
        raise click.ClickException("Set STORAGE_BACKEND=s3 in .env before running.")
    storage = current_app.extensions["storage"]
    if not isinstance(storage, S3Storage):
        raise click.ClickException("Storage backend is not S3.")

    root = Path(current_app.config["MEDIA_ROOT"])
    if not root.exists():
        click.echo(f"No media directory at {root}; nothing to migrate.")
        return

    count = 0
    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue
        key = path.relative_to(root).as_posix()
        content_type = mimetypes.guess_type(key)[0] or "application/octet-stream"
        with path.open("rb") as f:
            storage.client.put_object(
                Bucket=storage.bucket, Key=key, Body=f, ContentType=content_type,
            )
        click.echo(f"  uploaded {key}")
        count += 1
    click.echo(f"Uploaded {count} file(s) to bucket '{storage.bucket}'.")


@click.command("backfill-images")
@click.option("--max-px", type=int, default=None)
def backfill_images_command(max_px) -> None:
    """Cap oversized images already under MEDIA_ROOT (idempotent; skips GIFs)."""
    from io import BytesIO
    from pathlib import Path

    from PIL import Image

    from .images import cap

    root = Path(current_app.config["MEDIA_ROOT"])
    mp = max_px if max_px is not None else current_app.config["IMAGE_MAX_PX"]
    processed = skipped = 0
    for p in root.rglob("*"):
        if not p.is_file() or p.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
            skipped += 1
            continue
        try:
            data = p.read_bytes()
            with Image.open(BytesIO(data)) as im:
                w, h = im.size
        except Exception:
            skipped += 1
            continue
        if max(w, h) <= mp:
            skipped += 1
            continue
        p.write_bytes(cap(BytesIO(data), max_px=mp).getvalue())
        processed += 1
    click.echo(f"Backfill: processed {processed}, skipped {skipped}.")


def init_app(app: Flask) -> None:
    app.teardown_appcontext(close_db)
    app.cli.add_command(init_db_command)
    app.cli.add_command(seed_kalevi_command)
    app.cli.add_command(migrate_media_to_s3_command)
    app.cli.add_command(backfill_images_command)
