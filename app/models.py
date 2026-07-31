from __future__ import annotations

from .db import get_db


def list_people() -> list[dict]:
    rows = get_db().execute(
        "SELECT id, slug, display_name, bio, profile_image FROM people ORDER BY display_name"
    ).fetchall()
    return [dict(r) for r in rows]


PERSON_FIELDS = (
    "id", "slug", "display_name", "bio",
    "birth_date", "death_date", "birthplace", "profession",
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
    # position drives manual ordering; rows that predate it (position 0) fall
    # back to newest-first among themselves.
    rows = get_db().execute(
        "SELECT id, filename, caption, folder_id, position, uploaded_at "
        "FROM photos WHERE person_id = ? "
        "ORDER BY position, uploaded_at DESC, id DESC",
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
        "INSERT INTO photos (person_id, filename, caption, position) "
        "VALUES (?, ?, ?, (SELECT COALESCE(MAX(position), 0) + 1 FROM photos WHERE person_id = ?))",
        (person_id, filename, caption, person_id),
    )
    db.commit()
    return cur.lastrowid


def delete_photo(photo_id: int, slug: str) -> str | None:
    db = get_db()
    row = db.execute(
        "SELECT ph.filename FROM photos ph JOIN people p ON p.id = ph.person_id "
        "WHERE ph.id = ? AND p.slug = ?",
        (photo_id, slug),
    ).fetchone()
    if row is None:
        return None
    db.execute("DELETE FROM photos WHERE id = ?", (photo_id,))
    db.commit()
    return row["filename"]


def update_photo_caption(photo_id: int, slug: str, caption: str | None) -> bool:
    db = get_db()
    row = db.execute(
        "SELECT ph.id FROM photos ph JOIN people p ON p.id = ph.person_id "
        "WHERE ph.id = ? AND p.slug = ?",
        (photo_id, slug),
    ).fetchone()
    if row is None:
        return False
    db.execute("UPDATE photos SET caption = ? WHERE id = ?", (caption, photo_id))
    db.commit()
    return True


def reorder_photos(person_id: int, ids: list[int]) -> bool:
    """Persist a full manual ordering. ``ids`` must be exactly the person's
    photo ids (any order); positions become 1..n in the given order."""
    db = get_db()
    current = [
        r["id"]
        for r in db.execute(
            "SELECT id FROM photos WHERE person_id = ?", (person_id,)
        ).fetchall()
    ]
    if sorted(ids) != sorted(current):
        return False
    db.executemany(
        "UPDATE photos SET position = ? WHERE id = ?",
        [(pos, photo_id) for pos, photo_id in enumerate(ids, start=1)],
    )
    db.commit()
    return True


# --- Folders --------------------------------------------------------------


def list_folders(person_id: int) -> list[dict]:
    rows = get_db().execute(
        "SELECT id, name FROM folders WHERE person_id = ? "
        "ORDER BY position, name COLLATE NOCASE, id",
        (person_id,),
    ).fetchall()
    return [dict(r) for r in rows]


def create_folder(person_id: int, name: str) -> int:
    db = get_db()
    cur = db.execute(
        "INSERT INTO folders (person_id, name, position) "
        "VALUES (?, ?, (SELECT COALESCE(MAX(position), 0) + 1 FROM folders WHERE person_id = ?))",
        (person_id, name, person_id),
    )
    db.commit()
    return cur.lastrowid


def reorder_folders(person_id: int, ids: list[int]) -> bool:
    """Twin of reorder_photos for a person's folders."""
    db = get_db()
    current = [
        r["id"]
        for r in db.execute(
            "SELECT id FROM folders WHERE person_id = ?", (person_id,)
        ).fetchall()
    ]
    if sorted(ids) != sorted(current):
        return False
    db.executemany(
        "UPDATE folders SET position = ? WHERE id = ?",
        [(pos, folder_id) for pos, folder_id in enumerate(ids, start=1)],
    )
    db.commit()
    return True


def delete_folder(folder_id: int, slug: str) -> bool:
    db = get_db()
    row = db.execute(
        "SELECT f.id FROM folders f JOIN people p ON p.id = f.person_id "
        "WHERE f.id = ? AND p.slug = ?",
        (folder_id, slug),
    ).fetchone()
    if row is None:
        return False
    # photos.folder_id has ON DELETE SET NULL: photos become unsorted.
    db.execute("DELETE FROM folders WHERE id = ?", (folder_id,))
    db.commit()
    return True


def set_photo_folder(photo_id: int, slug: str, folder_id: int | None) -> bool:
    db = get_db()
    photo = db.execute(
        "SELECT ph.id, ph.person_id FROM photos ph JOIN people p ON p.id = ph.person_id "
        "WHERE ph.id = ? AND p.slug = ?",
        (photo_id, slug),
    ).fetchone()
    if photo is None:
        return False
    if folder_id is not None:
        folder = db.execute(
            "SELECT id FROM folders WHERE id = ? AND person_id = ?",
            (folder_id, photo["person_id"]),
        ).fetchone()
        if folder is None:
            return False
    db.execute("UPDATE photos SET folder_id = ? WHERE id = ?", (folder_id, photo_id))
    db.commit()
    return True


# --- Events ---------------------------------------------------------------

EVENT_FIELDS = ("id", "slug", "name", "description", "event_time", "place")
EDITABLE_EVENT_FIELDS = frozenset(EVENT_FIELDS) - {"id", "slug"}


def list_events() -> list[dict]:
    rows = get_db().execute(
        "SELECT id, slug, name, description, event_time, place, "
        "(SELECT filename FROM event_photos ep WHERE ep.event_id = events.id "
        " ORDER BY ep.uploaded_at DESC, ep.id DESC LIMIT 1) AS cover_filename "
        "FROM events ORDER BY created_at DESC"
    ).fetchall()
    return [dict(r) for r in rows]


def get_event(slug: str) -> dict | None:
    row = get_db().execute(
        f"SELECT {', '.join(EVENT_FIELDS)} FROM events WHERE slug = ?",
        (slug,),
    ).fetchone()
    return dict(row) if row else None


def create_event(slug: str, name: str, **fields) -> int:
    cols = ["slug", "name"]
    values = [slug, name]
    for k, v in fields.items():
        if k in EDITABLE_EVENT_FIELDS:
            cols.append(k)
            values.append(v)
    placeholders = ", ".join(["?"] * len(values))
    db = get_db()
    cur = db.execute(
        f"INSERT INTO events ({', '.join(cols)}) VALUES ({placeholders})",
        values,
    )
    db.commit()
    return cur.lastrowid


def update_event(slug: str, **fields) -> None:
    updates = {k: v for k, v in fields.items() if k in EDITABLE_EVENT_FIELDS}
    if not updates:
        return
    set_clause = ", ".join(f"{k} = ?" for k in updates)
    values = list(updates.values()) + [slug]
    db = get_db()
    db.execute(f"UPDATE events SET {set_clause} WHERE slug = ?", values)
    db.commit()


def delete_event(event_id: int) -> None:
    db = get_db()
    db.execute("DELETE FROM events WHERE id = ?", (event_id,))
    db.commit()


def list_event_photos(event_id: int) -> list[dict]:
    rows = get_db().execute(
        "SELECT id, filename, caption, position, uploaded_at "
        "FROM event_photos WHERE event_id = ? "
        "ORDER BY position, uploaded_at DESC, id DESC",
        (event_id,),
    ).fetchall()
    return [dict(r) for r in rows]


def count_event_photos(event_id: int) -> int:
    return get_db().execute(
        "SELECT count(*) FROM event_photos WHERE event_id = ?", (event_id,)
    ).fetchone()[0]


def add_event_photo(event_id: int, filename: str, caption: str | None = None) -> int:
    db = get_db()
    cur = db.execute(
        "INSERT INTO event_photos (event_id, filename, caption, position) "
        "VALUES (?, ?, ?, (SELECT COALESCE(MAX(position), 0) + 1 FROM event_photos WHERE event_id = ?))",
        (event_id, filename, caption, event_id),
    )
    db.commit()
    return cur.lastrowid


def delete_event_photo(photo_id: int, slug: str) -> str | None:
    db = get_db()
    row = db.execute(
        "SELECT ep.filename FROM event_photos ep JOIN events e ON e.id = ep.event_id "
        "WHERE ep.id = ? AND e.slug = ?",
        (photo_id, slug),
    ).fetchone()
    if row is None:
        return None
    db.execute("DELETE FROM event_photos WHERE id = ?", (photo_id,))
    db.commit()
    return row["filename"]


def update_event_photo_caption(photo_id: int, slug: str, caption: str | None) -> bool:
    db = get_db()
    row = db.execute(
        "SELECT ep.id FROM event_photos ep JOIN events e ON e.id = ep.event_id "
        "WHERE ep.id = ? AND e.slug = ?",
        (photo_id, slug),
    ).fetchone()
    if row is None:
        return False
    db.execute("UPDATE event_photos SET caption = ? WHERE id = ?", (caption, photo_id))
    db.commit()
    return True


def reorder_event_photos(event_id: int, ids: list[int]) -> bool:
    """Twin of reorder_photos for event galleries."""
    db = get_db()
    current = [
        r["id"]
        for r in db.execute(
            "SELECT id FROM event_photos WHERE event_id = ?", (event_id,)
        ).fetchall()
    ]
    if sorted(ids) != sorted(current):
        return False
    db.executemany(
        "UPDATE event_photos SET position = ? WHERE id = ?",
        [(pos, photo_id) for pos, photo_id in enumerate(ids, start=1)],
    )
    db.commit()
    return True
