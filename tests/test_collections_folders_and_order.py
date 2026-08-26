"""Real proofs for collection folders + manual photo ordering.

Mirrors tests/test_folders_and_order.py: assertions read REAL DB rows back
through app.models inside an app context; requests flow through the actual
api/admin_api blueprints. Seeded (tests/conftest.py::_seed): collection 'suku'
with photo 'c-dddd.jpg'.
"""

from __future__ import annotations

from app import models


def _collection_photos(app, slug: str) -> list[dict]:
    with app.app_context():
        cid = models.get_collection(slug)["id"]
        return models.list_collection_photos(cid)


def _add_photos(app, slug: str, filenames: list[str]) -> list[int]:
    with app.app_context():
        cid = models.get_collection(slug)["id"]
        return [models.add_collection_photo(cid, fn) for fn in filenames]


def _make_folder(app, slug: str, name: str) -> int:
    with app.app_context():
        cid = models.get_collection(slug)["id"]
        return models.create_collection_folder(cid, name)


# ==========================================================================
# Ordering
# ==========================================================================


def test_new_uploads_append_after_existing_photos(app):
    ids = _add_photos(app, "suku", ["b.jpg", "c.jpg"])
    photos = _collection_photos(app, "suku")
    assert [p["filename"] for p in photos] == ["c-dddd.jpg", "b.jpg", "c.jpg"]
    positions = [p["position"] for p in photos]
    assert positions == sorted(positions)
    assert [p["id"] for p in photos][-2:] == ids


def test_reorder_collection_photos_persists_given_order(app, authed_client):
    _add_photos(app, "suku", ["b.jpg", "c.jpg"])
    ids = [p["id"] for p in _collection_photos(app, "suku")]
    reversed_ids = list(reversed(ids))

    r = authed_client.put("/api/collections/suku/photos/order", json={"order": reversed_ids})
    assert r.status_code == 200
    assert r.get_json() == {"ok": True}
    assert [p["id"] for p in _collection_photos(app, "suku")] == reversed_ids


def test_reorder_rejects_partial_or_foreign_id_set(app, authed_client):
    _add_photos(app, "suku", ["b.jpg"])
    ids = [p["id"] for p in _collection_photos(app, "suku")]
    before = ids[:]

    assert authed_client.put(
        "/api/collections/suku/photos/order", json={"order": ids[:1]}
    ).status_code == 400
    assert authed_client.put(
        "/api/collections/suku/photos/order", json={"order": "not-a-list"}
    ).status_code == 400
    assert authed_client.put(
        "/api/collections/suku/photos/order", json={}
    ).status_code == 400
    assert [p["id"] for p in _collection_photos(app, "suku")] == before


def test_reorder_collection_photos_requires_auth(app, client):
    ids = [p["id"] for p in _collection_photos(app, "suku")]
    r = client.put("/api/collections/suku/photos/order", json={"order": ids})
    assert r.status_code == 401


def test_reorder_unknown_collection_is_404(authed_client):
    r = authed_client.put("/api/collections/nobody/photos/order", json={"order": []})
    assert r.status_code == 404


# ==========================================================================
# Folders: CRUD + reorder
# ==========================================================================


def test_create_folder_and_public_listing(app, authed_client, client):
    r = authed_client.post("/api/collections/suku/folders", json={"name": "Vanhemmat"})
    assert r.status_code == 201
    body = r.get_json()
    assert body["name"] == "Vanhemmat"

    pub = client.get("/api/collections/suku").get_json()
    assert pub["folders"] == [{"id": body["id"], "name": "Vanhemmat"}]
    assert all(ph["folder_id"] is None for ph in pub["photos"])


def test_create_folder_requires_auth(client):
    assert client.post(
        "/api/collections/suku/folders", json={"name": "x"}
    ).status_code == 401


def test_create_folder_name_required(authed_client):
    assert authed_client.post(
        "/api/collections/suku/folders", json={"name": "  "}
    ).status_code == 400


def test_create_folder_unknown_collection_is_404(authed_client):
    assert authed_client.post(
        "/api/collections/nobody/folders", json={"name": "x"}
    ).status_code == 404


def test_folders_list_in_creation_order_and_reorder_persists(app, authed_client, client):
    b_id = _make_folder(app, "suku", "b-kansio")
    a_id = _make_folder(app, "suku", "a-kansio")
    with app.app_context():
        cid = models.get_collection("suku")["id"]
        assert [f["id"] for f in models.list_collection_folders(cid)] == [b_id, a_id]

    r = authed_client.put(
        "/api/collections/suku/folders/order", json={"order": [a_id, b_id]}
    )
    assert r.status_code == 200
    assert r.get_json() == {"ok": True}

    pub = client.get("/api/collections/suku").get_json()
    assert [f["id"] for f in pub["folders"]] == [a_id, b_id]


def test_reorder_folders_rejects_partial_set(app, authed_client):
    _make_folder(app, "suku", "K")
    assert authed_client.put(
        "/api/collections/suku/folders/order", json={"order": []}
    ).status_code == 400


def test_reorder_folders_requires_auth(app, client):
    folder_id = _make_folder(app, "suku", "K")
    r = client.put("/api/collections/suku/folders/order", json={"order": [folder_id]})
    assert r.status_code == 401


def test_delete_folder_unsorts_its_photos(app, authed_client):
    folder_id = _make_folder(app, "suku", "Vanhemmat")
    photo_id = _collection_photos(app, "suku")[0]["id"]
    with app.app_context():
        assert models.set_collection_photo_folder(photo_id, "suku", folder_id)
    assert _collection_photos(app, "suku")[0]["folder_id"] == folder_id

    r = authed_client.delete(f"/api/collections/suku/folders/{folder_id}")
    assert r.status_code == 200
    assert r.get_json() == {"deleted": True}

    photos = _collection_photos(app, "suku")
    assert [p["id"] for p in photos] == [photo_id]
    assert photos[0]["folder_id"] is None
    with app.app_context():
        cid = models.get_collection("suku")["id"]
        assert models.list_collection_folders(cid) == []


def test_delete_folder_cross_slug_guard(app, authed_client):
    with app.app_context():
        other_id = models.create_collection("other-suku", "Other")
        other_folder = models.create_collection_folder(other_id, "Theirs")

    r = authed_client.delete(f"/api/collections/suku/folders/{other_folder}")
    assert r.status_code == 404
    with app.app_context():
        assert [f["id"] for f in models.list_collection_folders(other_id)] == [other_folder]


# ==========================================================================
# Folders: photo assignment via PATCH
# ==========================================================================


def test_assign_and_unassign_photo_folder(app, authed_client):
    folder_id = _make_folder(app, "suku", "Vanhemmat")
    photo_id = _collection_photos(app, "suku")[0]["id"]

    r = authed_client.patch(
        f"/api/collections/suku/photos/{photo_id}", json={"folder_id": folder_id}
    )
    assert r.status_code == 200
    assert _collection_photos(app, "suku")[0]["folder_id"] == folder_id

    r = authed_client.patch(
        f"/api/collections/suku/photos/{photo_id}", json={"folder_id": None}
    )
    assert r.status_code == 200
    assert _collection_photos(app, "suku")[0]["folder_id"] is None


def test_assign_other_collections_folder_is_404_and_noop(app, authed_client):
    with app.app_context():
        other_id = models.create_collection("other-suku", "Other")
        foreign_folder = models.create_collection_folder(other_id, "Theirs")
    photo_id = _collection_photos(app, "suku")[0]["id"]

    r = authed_client.patch(
        f"/api/collections/suku/photos/{photo_id}", json={"folder_id": foreign_folder}
    )
    assert r.status_code == 404
    assert _collection_photos(app, "suku")[0]["folder_id"] is None


def test_caption_only_patch_leaves_folder_assignment(app, authed_client):
    folder_id = _make_folder(app, "suku", "Vanhemmat")
    photo_id = _collection_photos(app, "suku")[0]["id"]
    with app.app_context():
        assert models.set_collection_photo_folder(photo_id, "suku", folder_id)

    r = authed_client.patch(
        f"/api/collections/suku/photos/{photo_id}", json={"caption": "New cap"}
    )
    assert r.status_code == 200
    photo = _collection_photos(app, "suku")[0]
    assert photo["caption"] == "New cap"
    assert photo["folder_id"] == folder_id


def test_assign_non_integer_folder_id_is_404(app, authed_client):
    photo_id = _collection_photos(app, "suku")[0]["id"]
    r = authed_client.patch(
        f"/api/collections/suku/photos/{photo_id}", json={"folder_id": "1"}
    )
    assert r.status_code == 404
    assert _collection_photos(app, "suku")[0]["folder_id"] is None
