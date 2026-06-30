"""Real admin CRUD proofs: every assertion checks a REAL DB row or a REAL file.

The authed_client carries a genuine ``authed`` session so it passes
``login_required`` for real. Post-request DB reads go through ``app.models`` and
therefore need an app context. Saved filenames carry a ``-<token_hex(4)>``
suffix, so we never hardcode them -- we read them back from the DB/disk.
"""

from __future__ import annotations

import io

from app import models


def test_create_person_slugifies_and_collision_suffixes(app, authed_client):
    r1 = authed_client.post("/admin/people", data={"display_name": "Test Person"})
    assert r1.status_code == 302
    with app.app_context():
        assert models.get_person("test-person")

    # Same display name again -> slug collision -> "-2" suffix.
    r2 = authed_client.post("/admin/people", data={"display_name": "Test Person"})
    assert r2.status_code == 302
    with app.app_context():
        assert models.get_person("test-person-2")


def test_create_event(app, authed_client):
    r = authed_client.post("/admin/events", data={"display_name": "Summer Fest"})
    assert r.status_code == 302
    with app.app_context():
        assert models.get_event("summer-fest")


def test_edit_person_profile_upload_then_remove(app, authed_client):
    from tests.conftest import JPEG_BYTES

    media_root = app.config["MEDIA_ROOT_PATH"]

    r = authed_client.post(
        "/admin/kalevi/edit",
        data={
            "display_name": "Kalevi",
            "profile_image": (io.BytesIO(JPEG_BYTES), "face.jpg"),
        },
        content_type="multipart/form-data",
    )
    assert r.status_code == 302

    with app.app_context():
        key = models.get_person("kalevi")["profile_image"]
    assert key is not None
    assert key.startswith("profile/")
    assert key.endswith(".jpg")

    saved_path = media_root / "kalevi" / key
    assert saved_path.exists()

    # Now remove the profile image.
    r2 = authed_client.post(
        "/admin/kalevi/edit",
        data={"display_name": "Kalevi", "remove_profile_image": "on"},
    )
    assert r2.status_code == 302

    with app.app_context():
        assert models.get_person("kalevi")["profile_image"] is None
    assert not saved_path.exists()


def test_upload_filters_disallowed_extensions(app, authed_client):
    from tests.conftest import JPEG_BYTES

    media_root = app.config["MEDIA_ROOT_PATH"]

    with app.app_context():
        kalevi_id = models.get_person("kalevi")["id"]
        assert models.count_photos(kalevi_id) == 1

    with authed_client.session_transaction() as s:
        s["lang"] = "en"

    r = authed_client.post(
        "/admin/kalevi/upload",
        data={
            "photos": [
                (io.BytesIO(JPEG_BYTES), "good.jpg"),
                (io.BytesIO(b"hello"), "notes.txt"),
            ]
        },
        content_type="multipart/form-data",
    )
    assert r.status_code == 302

    with app.app_context():
        assert models.count_photos(kalevi_id) == 2
        names = [p["filename"] for p in models.list_photos(kalevi_id)]

    # The newly added photo is the one that is not the seeded p-aaaa.jpg.
    new_names = [n for n in names if n != "p-aaaa.jpg"]
    assert len(new_names) == 1
    new_name = new_names[0]
    assert new_name.endswith(".jpg")
    assert (media_root / "kalevi" / new_name).exists()

    # The disallowed .txt upload must never hit disk.
    assert not list((media_root / "kalevi").glob("*.txt"))

    with authed_client.session_transaction() as s:
        flashes = s["_flashes"]
    assert ("message", "Uploaded 1 photo.") in flashes
    assert any("Skipped 1 file" in msg for _cat, msg in flashes)


def test_delete_person_removes_tree(app, authed_client):
    media_root = app.config["MEDIA_ROOT_PATH"]
    assert (media_root / "aino").exists()

    r = authed_client.post("/admin/people/aino/delete")
    assert r.status_code == 302

    assert not (media_root / "aino").exists()
    with app.app_context():
        assert models.get_person("aino") is None


def test_delete_event_removes_tree(app, authed_client):
    media_root = app.config["MEDIA_ROOT_PATH"]
    assert (media_root / "events" / "party").exists()

    r = authed_client.post("/admin/events/party/delete")
    assert r.status_code == 302

    assert not (media_root / "events" / "party").exists()
    with app.app_context():
        assert models.get_event("party") is None
