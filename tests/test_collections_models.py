"""Proofs for the collections + site-settings model layer.

Mirrors tests/test_models.py: every model fn needs an app context (they call
get_db()), so each operation is wrapped in ``with app.app_context():``. Seeded
data (tests/conftest.py::_seed): collection 'suku' with photo 'c-dddd.jpg'.
"""

from __future__ import annotations

from app import models


# --- update_collection ----------------------------------------------------

def test_update_collection_ignores_non_editable_fields(app):
    with app.app_context():
        original_id = models.get_collection("suku")["id"]
        models.update_collection("suku", name="Updated", id=999)

        updated = models.get_collection("suku")
        assert updated["name"] == "Updated"
        assert updated["id"] == original_id
        assert updated["id"] != 999
        assert models.get_collection("suku")["slug"] == "suku"
        assert models.get_collection("hacked") is None


def test_update_collection_noop_when_all_filtered(app):
    with app.app_context():
        before = models.get_collection("suku")
        models.update_collection("suku", id=12345)  # only non-editable -> noop
        after = models.get_collection("suku")
        assert after == before


# --- delete ---------------------------------------------------------------

def test_delete_collection(app):
    with app.app_context():
        cid = models.get_collection("suku")["id"]
        models.delete_collection(cid)
        assert models.get_collection("suku") is None


# --- listing / counting shapes -------------------------------------------

def test_list_collections_cover_filename(app):
    with app.app_context():
        collections = models.list_collections()
    suku = next(c for c in collections if c["slug"] == "suku")
    required = {"id", "slug", "name", "info", "profile_image", "cover_filename"}
    assert required.issubset(suku.keys())
    assert suku["cover_filename"] == "c-dddd.jpg"


def test_collection_photo_count_and_list_shape(app):
    with app.app_context():
        cid = models.get_collection("suku")["id"]
        assert models.count_collection_photos(cid) == 1
        photos = models.list_collection_photos(cid)
        required = {"id", "filename", "caption", "folder_id", "uploaded_at"}
        assert required.issubset(photos[0].keys())
        assert photos[0]["filename"] == "c-dddd.jpg"


