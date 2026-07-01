"""Real proofs for the JSON write API (app/admin_api.py).

Every assertion checks a REAL DB row (read back through app.models inside an app
context) or a REAL file on the tmp MEDIA_ROOT written by the real LocalStorage.
Nothing is mocked: the authed_client carries a genuine ``authed`` session and the
requests flow through the actual admin_api blueprint.

Seeded data we lean on (see tests/conftest.py::_seed):
  - person 'kalevi'  : 1 gallery photo 'p-aaaa.jpg', no profile image
  - person 'aino'    : profile_image 'profile/aino.jpg', 1 photo 'p-aino.jpg'
  - event  'party'   : 1 gallery photo 'e-bbbb.jpg'
"""

from __future__ import annotations

import io

from app import models
from tests.conftest import JPEG_BYTES


# --- helpers --------------------------------------------------------------


def _photo_id(app, slug: str, filename: str) -> int:
    with app.app_context():
        pid = models.get_person(slug)["id"]
        for ph in models.list_photos(pid):
            if ph["filename"] == filename:
                return ph["id"]
    raise AssertionError(f"photo {filename!r} not found under {slug!r}")


def _event_photo_id(app, slug: str, filename: str) -> int:
    with app.app_context():
        eid = models.get_event(slug)["id"]
        for ph in models.list_event_photos(eid):
            if ph["filename"] == filename:
                return ph["id"]
    raise AssertionError(f"event photo {filename!r} not found under {slug!r}")


# ==========================================================================
# PEOPLE
# ==========================================================================


def test_create_person_returns_created_slug(app, authed_client):
    r = authed_client.post("/api/people", json={"display_name": "New Guy"})
    assert r.status_code == 201
    body = r.get_json()
    assert body["slug"] == "new-guy"
    assert body["display_name"] == "New Guy"
    with app.app_context():
        assert models.get_person("new-guy") is not None


def test_create_person_collision_auto_suffixes(app, authed_client):
    first = authed_client.post("/api/people", json={"display_name": "Collide Me"})
    second = authed_client.post("/api/people", json={"display_name": "Collide Me"})
    assert first.status_code == 201
    assert second.status_code == 201
    assert first.get_json()["slug"] == "collide-me"
    assert second.get_json()["slug"] == "collide-me-2"
    assert first.get_json()["slug"] != second.get_json()["slug"]


def test_create_person_missing_display_name_is_400(app, authed_client):
    r = authed_client.post("/api/people", json={"display_name": "   "})
    assert r.status_code == 400
    assert "error" in r.get_json()

    r2 = authed_client.post("/api/people", json={})
    assert r2.status_code == 400
    assert "error" in r2.get_json()


def test_update_person_applies_whitelist_ignores_non_editable(app, authed_client):
    with app.app_context():
        original_id = models.get_person("kalevi")["id"]

    r = authed_client.put(
        "/api/people/kalevi",
        json={"bio": "A carpenter.", "birth_year": 1921, "id": 999999, "slug": "hacked"},
    )
    assert r.status_code == 200
    body = r.get_json()
    assert body["bio"] == "A carpenter."
    assert body["birth_year"] == 1921
    # Non-editable fields must be untouched.
    assert body["slug"] == "kalevi"
    assert body["id"] == original_id

    with app.app_context():
        assert models.get_person("kalevi")["bio"] == "A carpenter."
        assert models.get_person("hacked") is None


def test_update_person_unknown_slug_is_404(app, authed_client):
    r = authed_client.put("/api/people/nobody", json={"bio": "x"})
    assert r.status_code == 404
    assert "error" in r.get_json()


def test_delete_person_removes_db_and_media_tree(app, authed_client):
    media_root = app.config["MEDIA_ROOT_PATH"]
    assert (media_root / "aino").exists()

    r = authed_client.delete("/api/people/aino")
    assert r.status_code == 200
    assert r.get_json() == {"deleted": True}

    assert not (media_root / "aino").exists()
    with app.app_context():
        assert models.get_person("aino") is None


def test_delete_person_unknown_is_404(app, authed_client):
    r = authed_client.delete("/api/people/nobody")
    assert r.status_code == 404
    assert "error" in r.get_json()


def test_person_writes_require_auth(app, client):
    assert client.post("/api/people", json={"display_name": "X"}).status_code == 401
    assert client.put("/api/people/kalevi", json={"bio": "x"}).status_code == 401
    assert client.delete("/api/people/kalevi").status_code == 401
    # And nothing changed.
    with app.app_context():
        assert models.get_person("kalevi") is not None


# ==========================================================================
# EVENTS
# ==========================================================================


def test_create_event_returns_created_slug(app, authed_client):
    r = authed_client.post("/api/events", json={"name": "Summer Fest"})
    assert r.status_code == 201
    body = r.get_json()
    assert body["slug"] == "summer-fest"
    assert body["name"] == "Summer Fest"
    with app.app_context():
        assert models.get_event("summer-fest") is not None


def test_create_event_collision_auto_suffixes(app, authed_client):
    first = authed_client.post("/api/events", json={"name": "Gala"})
    second = authed_client.post("/api/events", json={"name": "Gala"})
    assert first.get_json()["slug"] == "gala"
    assert second.get_json()["slug"] == "gala-2"


def test_create_event_missing_name_is_400(app, authed_client):
    r = authed_client.post("/api/events", json={"name": "  "})
    assert r.status_code == 400
    assert "error" in r.get_json()


def test_update_event_applies_whitelist_ignores_non_editable(app, authed_client):
    with app.app_context():
        original_id = models.get_event("party")["id"]

    r = authed_client.put(
        "/api/events/party",
        json={"description": "Great night", "place": "Hall", "id": 42, "slug": "hacked"},
    )
    assert r.status_code == 200
    body = r.get_json()
    assert body["description"] == "Great night"
    assert body["place"] == "Hall"
    assert body["slug"] == "party"
    assert body["id"] == original_id

    with app.app_context():
        assert models.get_event("hacked") is None
        assert models.get_event("party")["description"] == "Great night"


def test_update_event_unknown_slug_is_404(app, authed_client):
    r = authed_client.put("/api/events/nope", json={"description": "x"})
    assert r.status_code == 404


def test_delete_event_removes_db_and_media_tree(app, authed_client):
    media_root = app.config["MEDIA_ROOT_PATH"]
    assert (media_root / "events" / "party").exists()

    r = authed_client.delete("/api/events/party")
    assert r.status_code == 200
    assert r.get_json() == {"deleted": True}

    assert not (media_root / "events" / "party").exists()
    with app.app_context():
        assert models.get_event("party") is None


def test_delete_event_unknown_is_404(app, authed_client):
    r = authed_client.delete("/api/events/nope")
    assert r.status_code == 404


def test_event_writes_require_auth(app, client):
    assert client.post("/api/events", json={"name": "X"}).status_code == 401
    assert client.put("/api/events/party", json={"description": "x"}).status_code == 401
    assert client.delete("/api/events/party").status_code == 401
    with app.app_context():
        assert models.get_event("party") is not None


# ==========================================================================
# PHOTO UPLOADS
# ==========================================================================


def test_upload_person_photos_saves_valid_skips_invalid(app, authed_client):
    media_root = app.config["MEDIA_ROOT_PATH"]
    with app.app_context():
        kalevi_id = models.get_person("kalevi")["id"]
        assert models.count_photos(kalevi_id) == 1

    r = authed_client.post(
        "/api/people/kalevi/photos",
        data={
            "photos": [
                (io.BytesIO(JPEG_BYTES), "good.jpg"),
                (io.BytesIO(b"not an image"), "notes.txt"),
            ]
        },
        content_type="multipart/form-data",
    )
    assert r.status_code == 200
    assert r.get_json() == {"saved": 1, "skipped": 1}

    with app.app_context():
        assert models.count_photos(kalevi_id) == 2
        names = [p["filename"] for p in models.list_photos(kalevi_id)]
    new_names = [n for n in names if n != "p-aaaa.jpg"]
    assert len(new_names) == 1
    new_name = new_names[0]
    assert new_name.endswith(".jpg")
    # The real file landed on disk; the .txt never did.
    assert (media_root / "kalevi" / new_name).exists()
    assert not list((media_root / "kalevi").glob("*.txt"))


def test_upload_person_photos_unknown_slug_is_404(app, authed_client):
    r = authed_client.post(
        "/api/people/nobody/photos",
        data={"photos": [(io.BytesIO(JPEG_BYTES), "good.jpg")]},
        content_type="multipart/form-data",
    )
    assert r.status_code == 404


def test_upload_person_photos_requires_auth(app, client):
    r = client.post(
        "/api/people/kalevi/photos",
        data={"photos": [(io.BytesIO(JPEG_BYTES), "good.jpg")]},
        content_type="multipart/form-data",
    )
    assert r.status_code == 401


def test_upload_event_photos_saves_valid_skips_invalid(app, authed_client):
    media_root = app.config["MEDIA_ROOT_PATH"]
    with app.app_context():
        party_id = models.get_event("party")["id"]
        assert models.count_event_photos(party_id) == 1

    r = authed_client.post(
        "/api/events/party/photos",
        data={
            "photos": [
                (io.BytesIO(JPEG_BYTES), "snap.jpg"),
                (io.BytesIO(b"junk"), "readme.txt"),
            ]
        },
        content_type="multipart/form-data",
    )
    assert r.status_code == 200
    assert r.get_json() == {"saved": 1, "skipped": 1}

    with app.app_context():
        assert models.count_event_photos(party_id) == 2
        names = [p["filename"] for p in models.list_event_photos(party_id)]
    new_names = [n for n in names if n != "e-bbbb.jpg"]
    assert len(new_names) == 1
    assert (media_root / "events" / "party" / new_names[0]).exists()
    assert not list((media_root / "events" / "party").glob("*.txt"))


def test_upload_event_photos_unknown_slug_is_404(app, authed_client):
    r = authed_client.post(
        "/api/events/nope/photos",
        data={"photos": [(io.BytesIO(JPEG_BYTES), "good.jpg")]},
        content_type="multipart/form-data",
    )
    assert r.status_code == 404


def test_upload_event_photos_requires_auth(app, client):
    r = client.post(
        "/api/events/party/photos",
        data={"photos": [(io.BytesIO(JPEG_BYTES), "good.jpg")]},
        content_type="multipart/form-data",
    )
    assert r.status_code == 401


# ==========================================================================
# PROFILE IMAGE
# ==========================================================================


def test_set_profile_image_saves_file_and_sets_key(app, authed_client):
    media_root = app.config["MEDIA_ROOT_PATH"]
    with app.app_context():
        assert models.get_person("kalevi")["profile_image"] is None

    r = authed_client.put(
        "/api/people/kalevi/profile-image",
        data={"profile_image": (io.BytesIO(JPEG_BYTES), "face.jpg")},
        content_type="multipart/form-data",
    )
    assert r.status_code == 200
    body = r.get_json()
    key = body["profile_image"]
    assert key is not None
    assert key.startswith("profile/") and key.endswith(".jpg")
    assert body["profile_image_url"] is not None

    with app.app_context():
        assert models.get_person("kalevi")["profile_image"] == key
    assert (media_root / "kalevi" / key).exists()


def test_remove_profile_image_clears_key_and_deletes_file(app, authed_client):
    media_root = app.config["MEDIA_ROOT_PATH"]
    existing = media_root / "aino" / "profile" / "aino.jpg"
    assert existing.exists()
    with app.app_context():
        assert models.get_person("aino")["profile_image"] == "profile/aino.jpg"

    r = authed_client.put(
        "/api/people/aino/profile-image",
        data={"remove": "true"},
        content_type="multipart/form-data",
    )
    assert r.status_code == 200
    body = r.get_json()
    assert body["profile_image"] is None
    assert body["profile_image_url"] is None

    with app.app_context():
        assert models.get_person("aino")["profile_image"] is None
    assert not existing.exists()


def test_set_profile_image_unknown_slug_is_404(app, authed_client):
    r = authed_client.put(
        "/api/people/nobody/profile-image",
        data={"profile_image": (io.BytesIO(JPEG_BYTES), "face.jpg")},
        content_type="multipart/form-data",
    )
    assert r.status_code == 404


def test_set_profile_image_requires_auth(app, client):
    r = client.put(
        "/api/people/kalevi/profile-image",
        data={"profile_image": (io.BytesIO(JPEG_BYTES), "face.jpg")},
        content_type="multipart/form-data",
    )
    assert r.status_code == 401


# ==========================================================================
# SINGLE-PHOTO DELETE (incl. cross-slug data-corruption guard)
# ==========================================================================


def test_delete_person_photo_happy_path(app, authed_client):
    media_root = app.config["MEDIA_ROOT_PATH"]
    photo_id = _photo_id(app, "kalevi", "p-aaaa.jpg")
    on_disk = media_root / "kalevi" / "p-aaaa.jpg"
    assert on_disk.exists()

    r = authed_client.delete(f"/api/people/kalevi/photos/{photo_id}")
    assert r.status_code == 200
    assert r.get_json() == {"deleted": True}

    assert not on_disk.exists()
    with app.app_context():
        kalevi_id = models.get_person("kalevi")["id"]
        ids = [p["id"] for p in models.list_photos(kalevi_id)]
    assert photo_id not in ids


def test_delete_person_photo_cross_slug_guard(app, authed_client):
    """Deleting a real photo id under the WRONG person's slug must 404 and
    leave the row AND the file fully intact. Against an unconditional
    ``DELETE FROM photos WHERE id=?`` this would 200 and destroy data."""
    media_root = app.config["MEDIA_ROOT_PATH"]
    aino_photo_id = _photo_id(app, "aino", "p-aino.jpg")
    on_disk = media_root / "aino" / "p-aino.jpg"
    assert on_disk.exists()

    # Attempt deletion under kalevi's slug -- aino's photo does not belong there.
    r = authed_client.delete(f"/api/people/kalevi/photos/{aino_photo_id}")
    assert r.status_code == 404
    assert "error" in r.get_json()

    # The row still exists and the file is untouched.
    with app.app_context():
        aino_id = models.get_person("aino")["id"]
        ids = [p["id"] for p in models.list_photos(aino_id)]
    assert aino_photo_id in ids
    assert on_disk.exists()


def test_delete_person_photo_unknown_id_is_404(app, authed_client):
    r = authed_client.delete("/api/people/kalevi/photos/999999")
    assert r.status_code == 404


def test_delete_person_photo_requires_auth(app, client):
    photo_id = _photo_id(app, "kalevi", "p-aaaa.jpg")
    r = client.delete(f"/api/people/kalevi/photos/{photo_id}")
    assert r.status_code == 401
    # Untouched.
    assert (app.config["MEDIA_ROOT_PATH"] / "kalevi" / "p-aaaa.jpg").exists()


def test_delete_event_photo_happy_path(app, authed_client):
    media_root = app.config["MEDIA_ROOT_PATH"]
    photo_id = _event_photo_id(app, "party", "e-bbbb.jpg")
    on_disk = media_root / "events" / "party" / "e-bbbb.jpg"
    assert on_disk.exists()

    r = authed_client.delete(f"/api/events/party/photos/{photo_id}")
    assert r.status_code == 200
    assert r.get_json() == {"deleted": True}

    assert not on_disk.exists()
    with app.app_context():
        party_id = models.get_event("party")["id"]
        ids = [p["id"] for p in models.list_event_photos(party_id)]
    assert photo_id not in ids


def test_delete_event_photo_cross_slug_guard(app, authed_client):
    """Same data-corruption guard for event photos: a real photo id under the
    wrong event slug must 404 and leave row + file intact."""
    media_root = app.config["MEDIA_ROOT_PATH"]
    # Create a second event so we have a real-but-wrong slug to aim at.
    with app.app_context():
        models.create_event("other-event", "Other Event")
    party_photo_id = _event_photo_id(app, "party", "e-bbbb.jpg")
    on_disk = media_root / "events" / "party" / "e-bbbb.jpg"
    assert on_disk.exists()

    r = authed_client.delete(f"/api/events/other-event/photos/{party_photo_id}")
    assert r.status_code == 404
    assert "error" in r.get_json()

    with app.app_context():
        party_id = models.get_event("party")["id"]
        ids = [p["id"] for p in models.list_event_photos(party_id)]
    assert party_photo_id in ids
    assert on_disk.exists()


def test_delete_event_photo_unknown_id_is_404(app, authed_client):
    r = authed_client.delete("/api/events/party/photos/999999")
    assert r.status_code == 404


def test_delete_event_photo_requires_auth(app, client):
    photo_id = _event_photo_id(app, "party", "e-bbbb.jpg")
    r = client.delete(f"/api/events/party/photos/{photo_id}")
    assert r.status_code == 401
    assert (app.config["MEDIA_ROOT_PATH"] / "events" / "party" / "e-bbbb.jpg").exists()


# ==========================================================================
# REMOVED ROUTE
# ==========================================================================


def test_admin_ping_route_is_gone(app, authed_client):
    # The route is genuinely unregistered: no rule maps to it and there is no
    # view function for it. (If it still existed, an authed GET would return
    # 200 {"ok": True}; unmatched /api/* now falls through to the SPA catch-all.)
    assert "admin_api.ping" not in app.view_functions
    assert not any("/api/admin/ping" == str(r) for r in app.url_map.iter_rules())

    # And the live response no longer honors the old {"ok": True} contract.
    r = authed_client.get("/api/admin/ping")
    assert not (r.status_code == 200 and r.get_json() == {"ok": True})
