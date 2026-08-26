"""Unit proofs for the prefix-parameterized storage helpers on the collections
surface (prefix "collections"), for both LocalStorage and S3Storage.

Reuses the in-memory fake-boto3 harness from tests/test_storage_unit.py so the
real put/delete/url logic runs with no network.
"""

from __future__ import annotations

from app.storage import LocalStorage, S3Storage
from tests.test_storage_unit import FakeS3Client, _build_s3


# --- LocalStorage URL building -------------------------------------------

def test_local_collection_url(app):
    storage = LocalStorage(app.config["MEDIA_ROOT_PATH"])
    with app.test_request_context():
        assert (
            storage.photo_url("collections", "suku", "c-dddd.jpg")
            == "/media/collections/suku/c-dddd.jpg"
        )


def test_local_collection_dir_layout(app, tmp_path):
    storage = LocalStorage(tmp_path)

    class _F:
        def save(self, dest):
            dest.write_bytes(b"x")

    storage.save_photo("collections", "suku", "a.jpg", _F())
    assert (tmp_path / "collections" / "suku" / "a.jpg").read_bytes() == b"x"

    storage.delete_file("collections", "suku", "a.jpg")
    assert not (tmp_path / "collections" / "suku" / "a.jpg").exists()


def test_local_person_dir_has_no_prefix_segment(app, tmp_path):
    """Prefix "" must NOT introduce an empty path segment (person layout)."""
    storage = LocalStorage(tmp_path)

    class _F:
        def save(self, dest):
            dest.write_bytes(b"x")

    storage.save_photo("", "kalevi", "p.jpg", _F())
    assert (tmp_path / "kalevi" / "p.jpg").read_bytes() == b"x"


# --- S3Storage key scheme -------------------------------------------------

def test_s3_collection_url_key_scheme(monkeypatch):
    storage, _ = _build_s3(monkeypatch, FakeS3Client(), public_base="https://cdn.example/")
    assert (
        storage.photo_url("collections", "suku", "c.jpg")
        == "https://cdn.example/collections/suku/c.jpg"
    )


def test_s3_empty_prefix_url_has_no_leading_segment(monkeypatch):
    storage, _ = _build_s3(monkeypatch, FakeS3Client(), public_base="https://cdn.example/")
    assert storage.photo_url("", "kalevi", "f.jpg") == "https://cdn.example/kalevi/f.jpg"


def test_s3_save_and_delete_collection(monkeypatch):
    fake = FakeS3Client()
    storage, _ = _build_s3(monkeypatch, fake)

    from io import BytesIO

    storage.save_photo("collections", "suku", "c.jpg", BytesIO(b"data"))
    assert fake.puts[0]["Key"] == "collections/suku/c.jpg"

    storage.delete_file("collections", "suku", "c.jpg")
    assert fake.deleted_one[0]["Key"] == "collections/suku/c.jpg"


def test_s3_delete_all_collection_prefix(monkeypatch):
    fake = FakeS3Client()
    fake._store = {
        "collections/suku/a.jpg": 1,
        "collections/suku/b.jpg": 1,
        "collections/other/c.jpg": 1,
    }
    storage, _ = _build_s3(monkeypatch, fake)

    storage.delete_all("collections", "suku")
    assert len(fake.deleted_objs) == 1
    keys = {o["Key"] for o in fake.deleted_objs[0]["Delete"]["Objects"]}
    assert keys == {"collections/suku/a.jpg", "collections/suku/b.jpg"}
