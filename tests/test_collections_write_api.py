"""Real proofs for the collections + contact JSON write API (app/admin_api.py).

Mirrors tests/test_write_api.py: assertions read REAL DB rows back through
app.models inside an app context, or check REAL files on the tmp MEDIA_ROOT.
Nothing is mocked. Seeded (tests/conftest.py::_seed): collection 'suku' with
gallery photo 'c-dddd.jpg'.
"""

from __future__ import annotations

import io

from app import models
from tests.conftest import JPEG_BYTES


def _collection_photo_id(app, slug: str, filename: str) -> int:
    with app.app_context():
        cid = models.get_collection(slug)["id"]
        for ph in models.list_collection_photos(cid):
            if ph["filename"] == filename:
                return ph["id"]
    raise AssertionError(f"collection photo {filename!r} not found under {slug!r}")


# ==========================================================================
# COLLECTIONS CRUD
# ==========================================================================


def test_create_collection_returns_created_slug(app, authed_client):
    r = authed_client.post("/api/collections", json={"name": "Kaijankosken suku"})
    assert r.status_code == 201
    body = r.get_json()
    assert body["slug"] == "kaijankosken-suku"
    assert body["name"] == "Kaijankosken suku"
    with app.app_context():
        assert models.get_collection("kaijankosken-suku") is not None


def test_create_collection_collision_auto_suffixes(app, authed_client):
    first = authed_client.post("/api/collections", json={"name": "Branch"})
    second = authed_client.post("/api/collections", json={"name": "Branch"})
    assert first.get_json()["slug"] == "branch"
    assert second.get_json()["slug"] == "branch-2"


def test_create_collection_missing_name_is_400(app, authed_client):
    assert authed_client.post("/api/collections", json={"name": "  "}).status_code == 400
    assert authed_client.post("/api/collections", json={}).status_code == 400


def test_update_collection_applies_whitelist_ignores_non_editable(app, authed_client):
    with app.app_context():
        original_id = models.get_collection("suku")["id"]

    r = authed_client.put(
        "/api/collections/suku",
        json={"info": "Family branch.", "id": 999999, "slug": "hacked"},
    )
    assert r.status_code == 200
    body = r.get_json()
    assert body["info"] == "Family branch."
    assert body["slug"] == "suku"
    assert body["id"] == original_id
    with app.app_context():
        assert models.get_collection("suku")["info"] == "Family branch."
        assert models.get_collection("hacked") is None


def test_update_collection_unknown_slug_is_404(app, authed_client):
    r = authed_client.put("/api/collections/nope", json={"info": "x"})
    assert r.status_code == 404


def test_delete_collection_removes_db_and_media_tree(app, authed_client):
    media_root = app.config["MEDIA_ROOT_PATH"]
    assert (media_root / "collections" / "suku").exists()

    r = authed_client.delete("/api/collections/suku")
    assert r.status_code == 200
    assert r.get_json() == {"deleted": True}

    assert not (media_root / "collections" / "suku").exists()
    with app.app_context():
        assert models.get_collection("suku") is None


def test_delete_collection_unknown_is_404(app, authed_client):
    assert authed_client.delete("/api/collections/nope").status_code == 404


def test_collection_writes_require_auth(app, client):
    assert client.post("/api/collections", json={"name": "X"}).status_code == 401
    assert client.put("/api/collections/suku", json={"info": "x"}).status_code == 401
    assert client.delete("/api/collections/suku").status_code == 401
    with app.app_context():
        assert models.get_collection("suku") is not None


# ==========================================================================
# PHOTO UPLOADS + DELETE
# ==========================================================================


def test_upload_collection_photos_saves_valid_skips_invalid(app, authed_client):
    media_root = app.config["MEDIA_ROOT_PATH"]
    with app.app_context():
        cid = models.get_collection("suku")["id"]
        assert models.count_collection_photos(cid) == 1

    r = authed_client.post(
        "/api/collections/suku/photos",
        data={
            "photos": [
                (io.BytesIO(JPEG_BYTES), "good.jpg"),
                (io.BytesIO(b"junk"), "readme.txt"),
            ]
        },
        content_type="multipart/form-data",
    )
    assert r.status_code == 200
    assert r.get_json() == {"saved": 1, "skipped": 1}

    with app.app_context():
        assert models.count_collection_photos(cid) == 2
        names = [p["filename"] for p in models.list_collection_photos(cid)]
    new_names = [n for n in names if n != "c-dddd.jpg"]
    assert len(new_names) == 1
    assert (media_root / "collections" / "suku" / new_names[0]).exists()
    assert not list((media_root / "collections" / "suku").glob("*.txt"))


def test_upload_collection_photos_unknown_slug_is_404(app, authed_client):
    r = authed_client.post(
        "/api/collections/nope/photos",
        data={"photos": [(io.BytesIO(JPEG_BYTES), "good.jpg")]},
        content_type="multipart/form-data",
    )
    assert r.status_code == 404


def test_upload_collection_photos_requires_auth(app, client):
    r = client.post(
        "/api/collections/suku/photos",
        data={"photos": [(io.BytesIO(JPEG_BYTES), "good.jpg")]},
        content_type="multipart/form-data",
    )
    assert r.status_code == 401


def test_delete_collection_photo_happy_path(app, authed_client):
    media_root = app.config["MEDIA_ROOT_PATH"]
    photo_id = _collection_photo_id(app, "suku", "c-dddd.jpg")
    on_disk = media_root / "collections" / "suku" / "c-dddd.jpg"
    assert on_disk.exists()

    r = authed_client.delete(f"/api/collections/suku/photos/{photo_id}")
    assert r.status_code == 200
    assert r.get_json() == {"deleted": True}

    assert not on_disk.exists()
    with app.app_context():
        cid = models.get_collection("suku")["id"]
        ids = [p["id"] for p in models.list_collection_photos(cid)]
    assert photo_id not in ids


def test_delete_collection_photo_cross_slug_guard(app, authed_client):
    media_root = app.config["MEDIA_ROOT_PATH"]
    with app.app_context():
        models.create_collection("other-suku", "Other")
    photo_id = _collection_photo_id(app, "suku", "c-dddd.jpg")
    on_disk = media_root / "collections" / "suku" / "c-dddd.jpg"

    r = authed_client.delete(f"/api/collections/other-suku/photos/{photo_id}")
    assert r.status_code == 404
    assert "error" in r.get_json()

    with app.app_context():
        cid = models.get_collection("suku")["id"]
        ids = [p["id"] for p in models.list_collection_photos(cid)]
    assert photo_id in ids
    assert on_disk.exists()


def test_delete_collection_photo_unknown_id_is_404(app, authed_client):
    assert authed_client.delete("/api/collections/suku/photos/999999").status_code == 404


def test_delete_collection_photo_requires_auth(app, client):
    photo_id = _collection_photo_id(app, "suku", "c-dddd.jpg")
    r = client.delete(f"/api/collections/suku/photos/{photo_id}")
    assert r.status_code == 401
    assert (app.config["MEDIA_ROOT_PATH"] / "collections" / "suku" / "c-dddd.jpg").exists()


# ==========================================================================
# CONTACT / SITE SETTINGS
# ==========================================================================


def test_get_contact_returns_blank_seeded_fields(client):
    r = client.get("/api/contact")
    assert r.status_code == 200
    assert r.get_json() == {
        "contact_name": None,
        "contact_email": None,
        "contact_phone": None,
    }


def test_put_contact_updates_and_returns_fields(app, authed_client):
    r = authed_client.put(
        "/api/contact",
        json={
            "contact_name": "Anssi",
            "contact_email": "anssi@example.com",
            "contact_phone": "+358 40 123 4567",
        },
    )
    assert r.status_code == 200
    body = r.get_json()
    assert body == {
        "contact_name": "Anssi",
        "contact_email": "anssi@example.com",
        "contact_phone": "+358 40 123 4567",
    }
    # Public GET reflects the persisted change.
    assert authed_client.get("/api/contact").get_json()["contact_name"] == "Anssi"
    with app.app_context():
        assert models.get_settings()["contact_email"] == "anssi@example.com"


def test_put_contact_blank_string_clears_to_none(app, authed_client):
    authed_client.put("/api/contact", json={"contact_name": "Anssi"})
    r = authed_client.put("/api/contact", json={"contact_name": "   "})
    assert r.status_code == 200
    assert r.get_json()["contact_name"] is None


def test_put_contact_requires_auth(app, client):
    r = client.put("/api/contact", json={"contact_name": "Hacker"})
    assert r.status_code == 401
    with app.app_context():
        assert models.get_settings()["contact_name"] is None
