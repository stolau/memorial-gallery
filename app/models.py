from __future__ import annotations

from .db import get_db


def list_people() -> list[dict]:
    rows = get_db().execute(
        "SELECT id, slug, display_name, bio, profile_image FROM people ORDER BY display_name"
    ).fetchall()
    return [dict(r) for r in rows]


PERSON_FIELDS = (
    "id", "slug", "display_name", "bio",
    "birth_year", "death_year", "birthplace", "profession",
    "profile_image",
)
EDITABLE_PERSON_FIELDS = frozenset(PERSON_FIELDS) - {"id", "slug"}


def get_person(slug: str) -> dict | None:
    row = get_db().execute(
        f"SELECT {', '.join(PERSON_FIELDS)} FROM people WHERE slug = ?",
        (slug,),
    ).fetchone()
    return dict(row) if row else None


def create_person(slug: str, display_name: str, **fields) -> int:
    cols = ["slug", "display_name"]
    values = [slug, display_name]
    for k, v in fields.items():
        if k in EDITABLE_PERSON_FIELDS:
            cols.append(k)
            values.append(v)
    placeholders = ", ".join(["?"] * len(values))
    db = get_db()
    cur = db.execute(
        f"INSERT INTO people ({', '.join(cols)}) VALUES ({placeholders})",
        values,
    )
    db.commit()
    return cur.lastrowid


def update_person(slug: str, **fields) -> None:
    updates = {k: v for k, v in fields.items() if k in EDITABLE_PERSON_FIELDS}
    if not updates:
        return
    set_clause = ", ".join(f"{k} = ?" for k in updates)
    values = list(updates.values()) + [slug]
    db = get_db()
    db.execute(f"UPDATE people SET {set_clause} WHERE slug = ?", values)
    db.commit()


def delete_person(person_id: int) -> None:
    db = get_db()
    db.execute("DELETE FROM people WHERE id = ?", (person_id,))
    db.commit()


def list_photos(person_id: int) -> list[dict]:
    rows = get_db().execute(
        "SELECT id, filename, caption, uploaded_at "
        "FROM photos WHERE person_id = ? ORDER BY uploaded_at DESC, id DESC",
        (person_id,),
    ).fetchall()
    return [dict(r) for r in rows]


def count_photos(person_id: int) -> int:
    return get_db().execute(
        "SELECT count(*) FROM photos WHERE person_id = ?", (person_id,)
    ).fetchone()[0]


def add_photo(person_id: int, filename: str, caption: str | None = None) -> int:
    db = get_db()
    cur = db.execute(
        "INSERT INTO photos (person_id, filename, caption) VALUES (?, ?, ?)",
        (person_id, filename, caption),
    )
    db.commit()
    return cur.lastrowid
