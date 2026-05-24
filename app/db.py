import sqlite3
from pathlib import Path

import click
from flask import Flask, current_app, g


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


def init_app(app: Flask) -> None:
    app.teardown_appcontext(close_db)
    app.cli.add_command(init_db_command)
    app.cli.add_command(seed_kalevi_command)
