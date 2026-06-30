import mimetypes
import sqlite3
from pathlib import Path

import click
from flask import Flask, current_app, g

from .storage import S3Storage


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
    "birth_year": "INTEGER",
    "death_year": "INTEGER",
    "birthplace": "TEXT",
    "profession": "TEXT",
    "profile_image": "TEXT",
}


def _migrate_people_columns(db: sqlite3.Connection) -> None:
    existing = {row["name"] for row in db.execute("PRAGMA table_info(people)").fetchall()}
    for col, ddl in PEOPLE_COLUMNS.items():
        if col not in existing:
            db.execute(f"ALTER TABLE people ADD COLUMN {col} {ddl}")


def init_db() -> None:
    db = get_db()
    schema = (Path(current_app.root_path) / "schema.sql").read_text()
    db.executescript(schema)
    _migrate_people_columns(db)
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


def init_app(app: Flask) -> None:
    app.teardown_appcontext(close_db)
    app.cli.add_command(init_db_command)
    app.cli.add_command(seed_kalevi_command)
    app.cli.add_command(migrate_media_to_s3_command)
