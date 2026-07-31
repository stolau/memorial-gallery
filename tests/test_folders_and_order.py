"""Real proofs for photo folders and manual photo ordering.

Every assertion reads REAL DB rows back through app.models inside an app
context; requests flow through the actual api/admin_api blueprints. Seeded
data (tests/conftest.py::_seed): person 'kalevi' with photo 'p-aaaa.jpg',
person 'aino' with 'p-aino.jpg', event 'party' with 'e-bbbb.jpg'.
"""

from __future__ import annotations

import sqlite3

from app import models
from app.db import _migrate_photo_columns


# --- helpers --------------------------------------------------------------


def _person_photos(app, slug: str) -> list[dict]:
    with app.app_context():
        pid = models.get_person(slug)["id"]
        return models.list_photos(pid)


def _event_photos(app, slug: str) -> list[dict]:
    with app.app_context():
        eid = models.get_event(slug)["id"]
        return models.list_event_photos(eid)


def _add_photos(app, slug: str, filenames: list[str]) -> list[int]:
    with app.app_context():
        pid = models.get_person(slug)["id"]
        return [models.add_photo(pid, fn) for fn in filenames]


def _make_folder(app, slug: str, name: str) -> int:
    with app.app_context():
        pid = models.get_person(slug)["id"]
        return models.create_folder(pid, name)


# ==========================================================================
# Migration
# ==========================================================================


def test_migrate_photo_columns_adds_missing_and_is_idempotent():
    """An old-schema DB (no folder_id/position) gains the columns; re-running
    the migration is a no-op rather than an error."""
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.execute(
        "CREATE TABLE photos (id INTEGER PRIMARY KEY, person_id INTEGER, "
        "filename TEXT, caption TEXT, uploaded_at TIMESTAMP)"
    )
    conn.execute(
        "CREATE TABLE event_photos (id INTEGER PRIMARY KEY, event_id INTEGER, "
        "filename TEXT, caption TEXT, uploaded_at TIMESTAMP)"
    )

    _migrate_photo_columns(conn)
    cols = {r["name"] for r in conn.execute("PRAGMA table_info(photos)")}
    assert {"folder_id", "position"} <= cols
    event_cols = {r["name"] for r in conn.execute("PRAGMA table_info(event_photos)")}
    assert "position" in event_cols
    assert "folder_id" not in event_cols  # events have no folders

    _migrate_photo_columns(conn)  # idempotent


# ==========================================================================
# Ordering
# ==========================================================================


def test_new_uploads_append_after_existing_photos(app):
    ids = _add_photos(app, "kalevi", ["b.jpg", "c.jpg"])

    photos = _person_photos(app, "kalevi")
    assert [p["filename"] for p in photos] == ["p-aaaa.jpg", "b.jpg", "c.jpg"]
    # Positions are strictly increasing in list order.
    positions = [p["position"] for p in photos]
    assert positions == sorted(positions)
    assert [p["id"] for p in photos][-2:] == ids


def test_reorder_person_photos_persists_given_order(app, authed_client):
    _add_photos(app, "kalevi", ["b.jpg", "c.jpg"])
    ids = [p["id"] for p in _person_photos(app, "kalevi")]
    reversed_ids = list(reversed(ids))

    r = authed_client.put("/api/people/kalevi/photos/order", json={"order": reversed_ids})
    assert r.status_code == 200
    assert r.get_json() == {"ok": True}

    assert [p["id"] for p in _person_photos(app, "kalevi")] == reversed_ids


def test_reorder_rejects_partial_or_foreign_id_set(app, authed_client):
    _add_photos(app, "kalevi", ["b.jpg"])
    ids = [p["id"] for p in _person_photos(app, "kalevi")]
    before = ids[:]

    # Missing one id -> not a permutation of the person's photos.
    r = authed_client.put("/api/people/kalevi/photos/order", json={"order": ids[:1]})
    assert r.status_code == 400

    # Contains another person's photo id.
    aino_id = _person_photos(app, "aino")[0]["id"]
    r = authed_client.put(
        "/api/people/kalevi/photos/order", json={"order": ids[:-1] + [aino_id]}
    )
    assert r.status_code == 400

    # Malformed payloads.
    assert authed_client.put(
        "/api/people/kalevi/photos/order", json={"order": "not-a-list"}
    ).status_code == 400
    assert authed_client.put(
        "/api/people/kalevi/photos/order", json={}
    ).status_code == 400

    # Order untouched throughout.
    assert [p["id"] for p in _person_photos(app, "kalevi")] == before


def test_reorder_person_photos_requires_auth(app, client):
    ids = [p["id"] for p in _person_photos(app, "kalevi")]
    r = client.put("/api/people/kalevi/photos/order", json={"order": ids})
    assert r.status_code == 401


def test_reorder_unknown_person_is_404(authed_client):
    r = authed_client.put("/api/people/nobody/photos/order", json={"order": []})
    assert r.status_code == 404


def test_reorder_event_photos_persists_given_order(app, authed_client):
    with app.app_context():
        eid = models.get_event("party")["id"]
        models.add_event_photo(eid, "e-cccc.jpg")
    ids = [p["id"] for p in _event_photos(app, "party")]
    reversed_ids = list(reversed(ids))

    r = authed_client.put("/api/events/party/photos/order", json={"order": reversed_ids})
    assert r.status_code == 200

    assert [p["id"] for p in _event_photos(app, "party")] == reversed_ids


# ==========================================================================
# Folders: CRUD
# ==========================================================================


def test_create_folder_and_public_listing(app, authed_client, client):
    r = authed_client.post("/api/people/kalevi/folders", json={"name": "Lapsuus"})
    assert r.status_code == 201
    body = r.get_json()
    assert body["name"] == "Lapsuus"

    # The public person endpoint exposes the folder.
    pub = client.get("/api/people/kalevi").get_json()
    assert pub["folders"] == [{"id": body["id"], "name": "Lapsuus"}]
    # Photos carry a folder_id key (null while unassigned).
    assert all(ph["folder_id"] is None for ph in pub["photos"])


def test_create_folder_requires_auth(client):
    assert client.post(
        "/api/people/kalevi/folders", json={"name": "x"}
    ).status_code == 401


def test_create_folder_name_required(authed_client):
    assert authed_client.post(
        "/api/people/kalevi/folders", json={"name": "  "}
    ).status_code == 400


def test_create_folder_unknown_person_is_404(authed_client):
    assert authed_client.post(
        "/api/people/nobody/folders", json={"name": "x"}
    ).status_code == 404


def test_delete_folder_unsorts_its_photos(app, authed_client):
    folder_id = _make_folder(app, "kalevi", "Lapsuus")
    photo_id = _person_photos(app, "kalevi")[0]["id"]
    with app.app_context():
        assert models.set_photo_folder(photo_id, "kalevi", folder_id)
    assert _person_photos(app, "kalevi")[0]["folder_id"] == folder_id

    r = authed_client.delete(f"/api/people/kalevi/folders/{folder_id}")
    assert r.status_code == 200
    assert r.get_json() == {"deleted": True}

    # Photo survives, unassigned (ON DELETE SET NULL).
    photos = _person_photos(app, "kalevi")
    assert [p["id"] for p in photos] == [photo_id]
    assert photos[0]["folder_id"] is None
    with app.app_context():
        pid = models.get_person("kalevi")["id"]
        assert models.list_folders(pid) == []


def test_delete_folder_cross_slug_guard(app, authed_client):
    aino_folder = _make_folder(app, "aino", "Aino's")

    r = authed_client.delete(f"/api/people/kalevi/folders/{aino_folder}")
    assert r.status_code == 404

    with app.app_context():
        pid = models.get_person("aino")["id"]
        assert [f["id"] for f in models.list_folders(pid)] == [aino_folder]


# ==========================================================================
# Folders: photo assignment via PATCH
# ==========================================================================


def test_assign_and_unassign_photo_folder(app, authed_client):
    folder_id = _make_folder(app, "kalevi", "Lapsuus")
    photo_id = _person_photos(app, "kalevi")[0]["id"]

    r = authed_client.patch(
        f"/api/people/kalevi/photos/{photo_id}", json={"folder_id": folder_id}
    )
    assert r.status_code == 200
    assert _person_photos(app, "kalevi")[0]["folder_id"] == folder_id

    r = authed_client.patch(
        f"/api/people/kalevi/photos/{photo_id}", json={"folder_id": None}
    )
    assert r.status_code == 200
    assert _person_photos(app, "kalevi")[0]["folder_id"] is None


def test_assign_other_persons_folder_is_404_and_noop(app, authed_client):
    aino_folder = _make_folder(app, "aino", "Aino's")
    photo_id = _person_photos(app, "kalevi")[0]["id"]

    r = authed_client.patch(
        f"/api/people/kalevi/photos/{photo_id}", json={"folder_id": aino_folder}
    )
    assert r.status_code == 404
    assert _person_photos(app, "kalevi")[0]["folder_id"] is None


def test_caption_only_patch_leaves_folder_assignment(app, authed_client):
    folder_id = _make_folder(app, "kalevi", "Lapsuus")
    photo_id = _person_photos(app, "kalevi")[0]["id"]
    with app.app_context():
        assert models.set_photo_folder(photo_id, "kalevi", folder_id)

    r = authed_client.patch(
        f"/api/people/kalevi/photos/{photo_id}", json={"caption": "New cap"}
    )
    assert r.status_code == 200

    photo = _person_photos(app, "kalevi")[0]
    assert photo["caption"] == "New cap"
    assert photo["folder_id"] == folder_id


def test_combined_caption_and_folder_patch(app, authed_client):
    folder_id = _make_folder(app, "kalevi", "Lapsuus")
    photo_id = _person_photos(app, "kalevi")[0]["id"]

    r = authed_client.patch(
        f"/api/people/kalevi/photos/{photo_id}",
        json={"caption": "Both", "folder_id": folder_id},
    )
    assert r.status_code == 200

    photo = _person_photos(app, "kalevi")[0]
    assert photo["caption"] == "Both"
    assert photo["folder_id"] == folder_id


def test_assign_non_integer_folder_id_is_404(app, authed_client):
    photo_id = _person_photos(app, "kalevi")[0]["id"]
    r = authed_client.patch(
        f"/api/people/kalevi/photos/{photo_id}", json={"folder_id": "1"}
    )
    assert r.status_code == 404
    assert _person_photos(app, "kalevi")[0]["folder_id"] is None
