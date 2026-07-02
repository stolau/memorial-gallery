"""Unit proofs for the storage backends (LocalStorage URL building + S3Storage).

boto3 is NOT installed; S3Storage lazily ``import boto3`` then calls
``boto3.client(...)``. We inject a fake ``boto3`` module into ``sys.modules``
before constructing S3Storage so the real put/delete logic runs against an
in-memory fake client (no network, nothing mocked at the method-under-test).
"""

from __future__ import annotations

import sys
import types
from io import BytesIO

import pytest

from app.storage import LocalStorage, S3Storage


class _FakePaginator:
    def __init__(self, store):
        self._store = store

    def paginate(self, Bucket=None, Prefix=""):
        keys = [k for k in self._store if k.startswith(Prefix)]
        if keys:
            yield {"Contents": [{"Key": k} for k in keys]}
        else:
            yield {}


class FakeS3Client:
    """In-memory S3 stand-in that records the real calls S3Storage makes."""

    def __init__(self):
        self.puts = []            # list of put_object kwargs
        self.deleted_one = []     # list of delete_object kwargs
        self.deleted_objs = []    # list of delete_objects kwargs
        self._store = {}          # key -> object (for list/delete-prefix)

    def put_object(self, **kwargs):
        self.puts.append(kwargs)
        self._store[kwargs["Key"]] = kwargs.get("Body")

    def delete_object(self, **kwargs):
        self.deleted_one.append(kwargs)
        self._store.pop(kwargs["Key"], None)

    def get_paginator(self, name):
        assert name == "list_objects_v2"
        return _FakePaginator(self._store)

    def delete_objects(self, **kwargs):
        self.deleted_objs.append(kwargs)
        for o in kwargs["Delete"]["Objects"]:
            self._store.pop(o["Key"], None)


def _build_s3(monkeypatch, fake_client, public_base="https://cdn.example/", region=None):
    """Inject a fake boto3 whose .client captures kwargs and returns fake_client.

    Returns (storage, captured_kwargs_dict). The sys.modules injection is via
    monkeypatch.setitem so it auto-restores after the test (no leak).
    """
    captured = {}

    def _client(*args, **kwargs):
        captured["args"] = args
        captured.update(kwargs)
        return fake_client

    fake_boto3 = types.SimpleNamespace(client=_client)
    monkeypatch.setitem(sys.modules, "boto3", fake_boto3)

    # storage.py also does `from botocore.config import Config`; botocore isn't
    # installed either, so inject a fake package + submodule with a Config that
    # records its kwargs (so tests can assert the addressing-style config).
    class _FakeConfig:
        def __init__(self, **kwargs):
            self.kwargs = kwargs

    fake_botocore = types.ModuleType("botocore")
    fake_botocore_config = types.ModuleType("botocore.config")
    fake_botocore_config.Config = _FakeConfig
    fake_botocore.config = fake_botocore_config
    monkeypatch.setitem(sys.modules, "botocore", fake_botocore)
    monkeypatch.setitem(sys.modules, "botocore.config", fake_botocore_config)

    storage = S3Storage(
        endpoint="https://s3.example",
        bucket="mybucket",
        access_key="AK",
        secret_key="SK",
        public_base=public_base,
        region=region,
    )
    return storage, captured


# --- LocalStorage URL building -------------------------------------------

def test_local_person_url(app):
    storage = LocalStorage(app.config["MEDIA_ROOT_PATH"])
    with app.test_request_context():
        assert storage.person_photo_url("kalevi", "p-aaaa.jpg") == "/media/kalevi/p-aaaa.jpg"


def test_local_event_url(app):
    storage = LocalStorage(app.config["MEDIA_ROOT_PATH"])
    with app.test_request_context():
        assert storage.event_photo_url("party", "e-bbbb.jpg") == "/media/events/party/e-bbbb.jpg"


# --- S3Storage public URL building ---------------------------------------

def test_s3_person_url_strips_trailing_slash(monkeypatch):
    storage, _ = _build_s3(monkeypatch, FakeS3Client(), public_base="https://cdn.example/")
    assert storage.person_photo_url("kalevi", "f.jpg") == "https://cdn.example/kalevi/f.jpg"


def test_s3_event_url_key_scheme(monkeypatch):
    storage, _ = _build_s3(monkeypatch, FakeS3Client(), public_base="https://cdn.example/")
    assert storage.event_photo_url("party", "e.jpg") == "https://cdn.example/events/party/e.jpg"


# --- S3 client construction kwargs ---------------------------------------

def test_s3_client_kwargs(monkeypatch):
    _, captured = _build_s3(monkeypatch, FakeS3Client(), region=None)
    assert captured["region_name"] == "us-east-1"
    assert captured["endpoint_url"] == "https://s3.example"
    assert captured["aws_access_key_id"] == "AK"
    assert captured["aws_secret_access_key"] == "SK"
    # Path-style addressing + checksum opt-out are required by UpCloud / most
    # S3-compatible providers.
    assert captured["config"].kwargs == {
        "s3": {"addressing_style": "path"},
        "request_checksum_calculation": "when_required",
        "response_checksum_validation": "when_required",
    }


# --- _put content-type resolution ----------------------------------------

def test_put_content_type_from_mimetype(monkeypatch):
    fake = FakeS3Client()
    storage, _ = _build_s3(monkeypatch, fake)

    upload = types.SimpleNamespace(stream=BytesIO(b"data"), mimetype="image/png")
    storage.save_person_photo("kalevi", "f.bin", upload)

    assert len(fake.puts) == 1
    put = fake.puts[0]
    assert put["Key"] == "kalevi/f.bin"
    assert put["ContentType"] == "image/png"
    assert put["Body"] is upload.stream


def test_put_content_type_guessed(monkeypatch):
    fake = FakeS3Client()
    storage, _ = _build_s3(monkeypatch, fake)

    bio = BytesIO(b"data")
    storage.save_event_photo("party", "p.jpg", bio)

    put = fake.puts[0]
    assert put["Key"] == "events/party/p.jpg"
    assert put["ContentType"] == "image/jpeg"


def test_put_content_type_fallback_octet_stream(monkeypatch):
    fake = FakeS3Client()
    storage, _ = _build_s3(monkeypatch, fake)

    bio = BytesIO(b"data")
    storage.save_person_photo("kalevi", "f.unknownext", bio)

    assert fake.puts[0]["ContentType"] == "application/octet-stream"


def test_put_seeks_body_to_zero(monkeypatch):
    fake = FakeS3Client()
    storage, _ = _build_s3(monkeypatch, fake)

    bio = BytesIO()
    bio.write(b"some bytes")  # leaves position > 0
    assert bio.tell() > 0
    storage.save_person_photo("kalevi", "f.jpg", bio)

    assert fake.puts[0]["Body"].tell() == 0


# --- delete operations ----------------------------------------------------

def test_delete_person_file(monkeypatch):
    fake = FakeS3Client()
    storage, _ = _build_s3(monkeypatch, fake)

    storage.delete_person_file("kalevi", "f.jpg")
    assert len(fake.deleted_one) == 1
    assert fake.deleted_one[0]["Key"] == "kalevi/f.jpg"


def test_delete_prefix_person(monkeypatch):
    fake = FakeS3Client()
    fake._store = {"kalevi/a.jpg": 1, "kalevi/b.jpg": 1, "other/c.jpg": 1}
    storage, _ = _build_s3(monkeypatch, fake)

    storage.delete_person_all("kalevi")

    assert len(fake.deleted_objs) == 1
    keys = {o["Key"] for o in fake.deleted_objs[0]["Delete"]["Objects"]}
    assert keys == {"kalevi/a.jpg", "kalevi/b.jpg"}


def test_delete_prefix_event(monkeypatch):
    fake = FakeS3Client()
    fake._store = {"events/party/a.jpg": 1, "events/party/b.jpg": 1, "events/other/c.jpg": 1}
    storage, _ = _build_s3(monkeypatch, fake)

    storage.delete_event_all("party")

    assert len(fake.deleted_objs) == 1
    keys = {o["Key"] for o in fake.deleted_objs[0]["Delete"]["Objects"]}
    assert keys == {"events/party/a.jpg", "events/party/b.jpg"}


def test_delete_prefix_empty_store_no_delete(monkeypatch):
    fake = FakeS3Client()  # empty store
    storage, _ = _build_s3(monkeypatch, fake)

    storage.delete_person_all("kalevi")

    assert fake.deleted_objs == []
