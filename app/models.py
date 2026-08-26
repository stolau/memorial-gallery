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


def get_person_by_id(person_id: int) -> dict | None:
    row = get_db().execute(
        f"SELECT {', '.join(PERSON_FIELDS)} FROM people WHERE id = ?",
        (person_id,),
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

EVENT_FIELDS = ("id", "slug", "name", "description", "event_time", "place", "kind")
EDITABLE_EVENT_FIELDS = frozenset(EVENT_FIELDS) - {"id", "slug"}


def list_events() -> list[dict]:
    rows = get_db().execute(
        "SELECT id, slug, name, description, event_time, place, kind, "
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


# --- Collections ----------------------------------------------------------

COLLECTION_FIELDS = ("id", "slug", "name", "info", "profile_image")
EDITABLE_COLLECTION_FIELDS = frozenset(COLLECTION_FIELDS) - {"id", "slug"}


def list_collections() -> list[dict]:
    rows = get_db().execute(
        "SELECT id, slug, name, info, profile_image, "
        "(SELECT filename FROM collection_photos cp WHERE cp.collection_id = collections.id "
        " ORDER BY cp.uploaded_at DESC, cp.id DESC LIMIT 1) AS cover_filename "
        "FROM collections ORDER BY created_at DESC"
    ).fetchall()
    return [dict(r) for r in rows]


def get_collection(slug: str) -> dict | None:
    row = get_db().execute(
        f"SELECT {', '.join(COLLECTION_FIELDS)} FROM collections WHERE slug = ?",
        (slug,),
    ).fetchone()
    return dict(row) if row else None


def create_collection(slug: str, name: str, **fields) -> int:
    cols = ["slug", "name"]
    values = [slug, name]
    for k, v in fields.items():
        if k in EDITABLE_COLLECTION_FIELDS:
            cols.append(k)
            values.append(v)
    placeholders = ", ".join(["?"] * len(values))
    db = get_db()
    cur = db.execute(
        f"INSERT INTO collections ({', '.join(cols)}) VALUES ({placeholders})",
        values,
    )
    db.commit()
    return cur.lastrowid


def update_collection(slug: str, **fields) -> None:
    updates = {k: v for k, v in fields.items() if k in EDITABLE_COLLECTION_FIELDS}
    if not updates:
        return
    set_clause = ", ".join(f"{k} = ?" for k in updates)
    values = list(updates.values()) + [slug]
    db = get_db()
    db.execute(f"UPDATE collections SET {set_clause} WHERE slug = ?", values)
    db.commit()


def delete_collection(collection_id: int) -> None:
    db = get_db()
    db.execute("DELETE FROM collections WHERE id = ?", (collection_id,))
    db.commit()


def list_collection_photos(collection_id: int) -> list[dict]:
    rows = get_db().execute(
        "SELECT id, filename, caption, folder_id, position, uploaded_at "
        "FROM collection_photos WHERE collection_id = ? "
        "ORDER BY position, uploaded_at DESC, id DESC",
        (collection_id,),
    ).fetchall()
    return [dict(r) for r in rows]


def count_collection_photos(collection_id: int) -> int:
    return get_db().execute(
        "SELECT count(*) FROM collection_photos WHERE collection_id = ?", (collection_id,)
    ).fetchone()[0]


def add_collection_photo(collection_id: int, filename: str, caption: str | None = None) -> int:
    db = get_db()
    cur = db.execute(
        "INSERT INTO collection_photos (collection_id, filename, caption, position) "
        "VALUES (?, ?, ?, (SELECT COALESCE(MAX(position), 0) + 1 FROM collection_photos WHERE collection_id = ?))",
        (collection_id, filename, caption, collection_id),
    )
    db.commit()
    return cur.lastrowid


def delete_collection_photo(photo_id: int, slug: str) -> str | None:
    db = get_db()
    row = db.execute(
        "SELECT cp.filename FROM collection_photos cp JOIN collections c ON c.id = cp.collection_id "
        "WHERE cp.id = ? AND c.slug = ?",
        (photo_id, slug),
    ).fetchone()
    if row is None:
        return None
    db.execute("DELETE FROM collection_photos WHERE id = ?", (photo_id,))
    db.commit()
    return row["filename"]


def update_collection_photo_caption(photo_id: int, slug: str, caption: str | None) -> bool:
    db = get_db()
    row = db.execute(
        "SELECT cp.id FROM collection_photos cp JOIN collections c ON c.id = cp.collection_id "
        "WHERE cp.id = ? AND c.slug = ?",
        (photo_id, slug),
    ).fetchone()
    if row is None:
        return False
    db.execute("UPDATE collection_photos SET caption = ? WHERE id = ?", (caption, photo_id))
    db.commit()
    return True


def reorder_collection_photos(collection_id: int, ids: list[int]) -> bool:
    """Twin of reorder_photos for collection galleries."""
    db = get_db()
    current = [
        r["id"]
        for r in db.execute(
            "SELECT id FROM collection_photos WHERE collection_id = ?", (collection_id,)
        ).fetchall()
    ]
    if sorted(ids) != sorted(current):
        return False
    db.executemany(
        "UPDATE collection_photos SET position = ? WHERE id = ?",
        [(pos, photo_id) for pos, photo_id in enumerate(ids, start=1)],
    )
    db.commit()
    return True


def list_collection_folders(collection_id: int) -> list[dict]:
    rows = get_db().execute(
        "SELECT id, name FROM collection_folders WHERE collection_id = ? "
        "ORDER BY position, name COLLATE NOCASE, id",
        (collection_id,),
    ).fetchall()
    return [dict(r) for r in rows]


def create_collection_folder(collection_id: int, name: str) -> int:
    db = get_db()
    cur = db.execute(
        "INSERT INTO collection_folders (collection_id, name, position) "
        "VALUES (?, ?, (SELECT COALESCE(MAX(position), 0) + 1 FROM collection_folders WHERE collection_id = ?))",
        (collection_id, name, collection_id),
    )
    db.commit()
    return cur.lastrowid


def reorder_collection_folders(collection_id: int, ids: list[int]) -> bool:
    """Twin of reorder_folders for a collection's folders."""
    db = get_db()
    current = [
        r["id"]
        for r in db.execute(
            "SELECT id FROM collection_folders WHERE collection_id = ?", (collection_id,)
        ).fetchall()
    ]
    if sorted(ids) != sorted(current):
        return False
    db.executemany(
        "UPDATE collection_folders SET position = ? WHERE id = ?",
        [(pos, folder_id) for pos, folder_id in enumerate(ids, start=1)],
    )
    db.commit()
    return True


def delete_collection_folder(folder_id: int, slug: str) -> bool:
    db = get_db()
    row = db.execute(
        "SELECT f.id FROM collection_folders f JOIN collections c ON c.id = f.collection_id "
        "WHERE f.id = ? AND c.slug = ?",
        (folder_id, slug),
    ).fetchone()
    if row is None:
        return False
    # collection_photos.folder_id has ON DELETE SET NULL: photos become unsorted.
    db.execute("DELETE FROM collection_folders WHERE id = ?", (folder_id,))
    db.commit()
    return True


def set_collection_photo_folder(photo_id: int, slug: str, folder_id: int | None) -> bool:
    db = get_db()
    photo = db.execute(
        "SELECT cp.id, cp.collection_id FROM collection_photos cp "
        "JOIN collections c ON c.id = cp.collection_id "
        "WHERE cp.id = ? AND c.slug = ?",
        (photo_id, slug),
    ).fetchone()
    if photo is None:
        return False
    if folder_id is not None:
        folder = db.execute(
            "SELECT id FROM collection_folders WHERE id = ? AND collection_id = ?",
            (folder_id, photo["collection_id"]),
        ).fetchone()
        if folder is None:
            return False
    db.execute("UPDATE collection_photos SET folder_id = ? WHERE id = ?", (folder_id, photo_id))
    db.commit()
    return True


# --- Contacts -------------------------------------------------------------

CONTACT_FIELDS = ("id", "position", "name", "role", "phone", "email")
EDITABLE_CONTACT_FIELDS = frozenset(("name", "role", "phone", "email"))


def list_contacts() -> list[dict]:
    rows = get_db().execute(
        f"SELECT {', '.join(CONTACT_FIELDS)} FROM contacts ORDER BY position, id"
    ).fetchall()
    return [dict(r) for r in rows]


def get_contact(contact_id: int) -> dict | None:
    row = get_db().execute(
        f"SELECT {', '.join(CONTACT_FIELDS)} FROM contacts WHERE id = ?",
        (contact_id,),
    ).fetchone()
    return dict(row) if row else None


def create_contact(name: str, **fields) -> int:
    cols = ["name"]
    values = [name]
    for k, v in fields.items():
        if k in EDITABLE_CONTACT_FIELDS and k != "name":
            cols.append(k)
            values.append(v)
    placeholders = ", ".join(["?"] * len(values))
    db = get_db()
    cur = db.execute(
        f"INSERT INTO contacts ({', '.join(cols)}, position) "
        f"VALUES ({placeholders}, (SELECT COALESCE(MAX(position), 0) + 1 FROM contacts))",
        values,
    )
    db.commit()
    return cur.lastrowid


def update_contact(contact_id: int, **fields) -> bool:
    updates = {k: v for k, v in fields.items() if k in EDITABLE_CONTACT_FIELDS}
    if not updates:
        return get_contact(contact_id) is not None
    set_clause = ", ".join(f"{k} = ?" for k in updates)
    values = list(updates.values()) + [contact_id]
    db = get_db()
    cur = db.execute(f"UPDATE contacts SET {set_clause} WHERE id = ?", values)
    db.commit()
    return cur.rowcount > 0


def delete_contact(contact_id: int) -> bool:
    db = get_db()
    cur = db.execute("DELETE FROM contacts WHERE id = ?", (contact_id,))
    db.commit()
    return cur.rowcount > 0


def reorder_contacts(ids: list[int]) -> bool:
    """Twin of reorder_folders for the global contacts list."""
    db = get_db()
    current = [r["id"] for r in db.execute("SELECT id FROM contacts").fetchall()]
    if sorted(ids) != sorted(current):
        return False
    db.executemany(
        "UPDATE contacts SET position = ? WHERE id = ?",
        [(pos, contact_id) for pos, contact_id in enumerate(ids, start=1)],
    )
    db.commit()
    return True


# --- Family lines ---------------------------------------------------------

FAMILY_LINE_FIELDS = ("id", "slug", "name", "year_range", "note", "position")
EDITABLE_FAMILY_LINE_FIELDS = frozenset(("name", "year_range", "note"))


def _family_line_members(family_line_id: int) -> list[dict]:
    rows = get_db().execute(
        "SELECT p.slug, p.display_name FROM family_line_members m "
        "JOIN people p ON p.id = m.person_id "
        "WHERE m.family_line_id = ? ORDER BY m.position, p.display_name",
        (family_line_id,),
    ).fetchall()
    return [dict(r) for r in rows]


def list_family_lines() -> list[dict]:
    rows = get_db().execute(
        f"SELECT {', '.join(FAMILY_LINE_FIELDS)} FROM family_lines "
        "ORDER BY position, id"
    ).fetchall()
    result = []
    for r in rows:
        line = dict(r)
        line["members"] = _family_line_members(line["id"])
        result.append(line)
    return result


def get_family_line(slug: str) -> dict | None:
    row = get_db().execute(
        f"SELECT {', '.join(FAMILY_LINE_FIELDS)} FROM family_lines WHERE slug = ?",
        (slug,),
    ).fetchone()
    if row is None:
        return None
    line = dict(row)
    line["members"] = _family_line_members(line["id"])
    return line


def create_family_line(slug: str, name: str, **fields) -> int:
    cols = ["slug", "name"]
    values = [slug, name]
    for k, v in fields.items():
        if k in EDITABLE_FAMILY_LINE_FIELDS and k != "name":
            cols.append(k)
            values.append(v)
    placeholders = ", ".join(["?"] * len(values))
    db = get_db()
    cur = db.execute(
        f"INSERT INTO family_lines ({', '.join(cols)}, position) "
        f"VALUES ({placeholders}, (SELECT COALESCE(MAX(position), 0) + 1 FROM family_lines))",
        values,
    )
    db.commit()
    return cur.lastrowid


def update_family_line(slug: str, **fields) -> None:
    updates = {k: v for k, v in fields.items() if k in EDITABLE_FAMILY_LINE_FIELDS}
    if not updates:
        return
    set_clause = ", ".join(f"{k} = ?" for k in updates)
    values = list(updates.values()) + [slug]
    db = get_db()
    db.execute(f"UPDATE family_lines SET {set_clause} WHERE slug = ?", values)
    db.commit()


def delete_family_line(family_line_id: int) -> None:
    db = get_db()
    db.execute("DELETE FROM family_lines WHERE id = ?", (family_line_id,))
    db.commit()


def add_family_line_member(family_line_id: int, person_id: int) -> bool:
    """Add a person to a family line at the end; idempotent on duplicates."""
    db = get_db()
    exists = db.execute(
        "SELECT 1 FROM family_line_members WHERE family_line_id = ? AND person_id = ?",
        (family_line_id, person_id),
    ).fetchone()
    if exists:
        return False
    db.execute(
        "INSERT INTO family_line_members (family_line_id, person_id, position) "
        "VALUES (?, ?, (SELECT COALESCE(MAX(position), 0) + 1 "
        "FROM family_line_members WHERE family_line_id = ?))",
        (family_line_id, person_id, family_line_id),
    )
    db.commit()
    return True


def remove_family_line_member(family_line_id: int, person_id: int) -> bool:
    db = get_db()
    cur = db.execute(
        "DELETE FROM family_line_members WHERE family_line_id = ? AND person_id = ?",
        (family_line_id, person_id),
    )
    db.commit()
    return cur.rowcount > 0


def reorder_family_line_members(family_line_id: int, person_ids: list[int]) -> bool:
    """Persist a full manual ordering of a family line's members."""
    db = get_db()
    current = [
        r["person_id"]
        for r in db.execute(
            "SELECT person_id FROM family_line_members WHERE family_line_id = ?",
            (family_line_id,),
        ).fetchall()
    ]
    if sorted(person_ids) != sorted(current):
        return False
    db.executemany(
        "UPDATE family_line_members SET position = ? "
        "WHERE family_line_id = ? AND person_id = ?",
        [(pos, family_line_id, pid) for pos, pid in enumerate(person_ids, start=1)],
    )
    db.commit()
    return True
