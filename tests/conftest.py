"""Shared fixtures for the media/api proof harness.

These exercise the REAL application factory (`app.create_app`) and the REAL
model seeding APIs (`app.models.create_person`, `add_photo`, `create_event`,
`add_event_photo`). Nothing is mocked except the explicit S3 stub used to prove
the redirect branch (test 6), which never touches the network.

Config that the factory hard-codes (DATABASE / MEDIA_ROOT / STORAGE_BACKEND) is
not env-driven, so we override it post-construction inside an app context and
rebind ``app.extensions["storage"]`` to a LocalStorage rooted at the same tmp
dir the media route reads via ``current_app.config["MEDIA_ROOT"]``.
"""

from __future__ import annotations

import base64
from pathlib import Path

import pytest

from app import create_app, models
from app.db import init_db
from app.storage import LocalStorage

# A genuinely valid 1x1 baseline JPEG (SOI..EOI). The serving tests assert the
# served body is byte-for-byte identical to what was written, so the only thing
# that matters is a real, round-trippable file on disk.
_JPEG_B64 = (
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRof"
    "Hh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wgALCAABAAEBAREA/8QAFBAB"
    "AAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgB"
    "AwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAA"
    "AAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oA"
    "DAMBAAIAAwAAABCQ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPxB//8QAFBEBAAAA"
    "AAAAAAAAAAAAAAAAAP/aAAgBAgEBPxB//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAB"
    "PxB//9k="
)
JPEG_BYTES = base64.b64decode(_JPEG_B64)


def _seed(media_root: Path) -> None:
    """Seed people/events through the real model APIs and lay down real files.

    Layout written under MEDIA_ROOT:
        kalevi/p-aaaa.jpg              -> person 'kalevi' gallery photo
        events/party/e-bbbb.jpg        -> event  'party'  gallery photo
        events/cover.jpg               -> person 'events' (edge slug) photo
    """
    # Person 'kalevi' with one photo.
    kalevi_id = models.create_person("kalevi", "Kalevi")
    (media_root / "kalevi").mkdir(parents=True, exist_ok=True)
    (media_root / "kalevi" / "p-aaaa.jpg").write_bytes(JPEG_BYTES)
    models.add_photo(kalevi_id, "p-aaaa.jpg")

    # Person 'aino' WITH a profile image (exercises the profile_image_url enrich).
    aino_id = models.create_person("aino", "Aino", profile_image="profile/aino.jpg")
    (media_root / "aino" / "profile").mkdir(parents=True, exist_ok=True)
    (media_root / "aino" / "profile" / "aino.jpg").write_bytes(JPEG_BYTES)
    (media_root / "aino" / "p-aino.jpg").write_bytes(JPEG_BYTES)
    models.add_photo(aino_id, "p-aino.jpg")

    # Event 'party' with one photo.
    party_id = models.create_event("party", "Party")
    (media_root / "events" / "party").mkdir(parents=True, exist_ok=True)
    (media_root / "events" / "party" / "e-bbbb.jpg").write_bytes(JPEG_BYTES)
    models.add_event_photo(party_id, "e-bbbb.jpg")

    # Edge case: a person whose slug is literally 'events', with a SINGLE-segment
    # filename. /media/events/cover.jpg has only two path segments after /media,
    # so it cannot match the three-segment media.event rule and correctly serves
    # the person. NOTE (documented, accepted limitation): a MULTI-segment
    # filename under person slug 'events' (e.g. /media/events/sub/x.jpg) would be
    # shadowed by the static-prefixed media.event rule and resolve as an event.
    events_person_id = models.create_person("events", "Events Person")
    (media_root / "events").mkdir(parents=True, exist_ok=True)
    (media_root / "events" / "cover.jpg").write_bytes(JPEG_BYTES)
    models.add_photo(events_person_id, "cover.jpg")


def _make_app(tmp_path_factory, storage_backend: str):
    media_root = tmp_path_factory.mktemp("media")
    db_path = tmp_path_factory.mktemp("db") / "gallery.db"

    app = create_app()
    app.config.update(
        TESTING=True,
        DATABASE=str(db_path),
        MEDIA_ROOT=str(media_root),
        STORAGE_BACKEND=storage_backend,
    )
    # Rebind storage so it is rooted at the SAME tmp dir the media route reads
    # from config; the default factory storage points at the repo's media/ dir.
    app.extensions["storage"] = LocalStorage(media_root)

    with app.app_context():
        init_db()
        _seed(media_root)

    app.config["MEDIA_ROOT_PATH"] = media_root  # convenience for tests
    return app


@pytest.fixture
def app(tmp_path_factory):
    """Real app wired to an isolated tmp DB + media dir, local storage backend."""
    return _make_app(tmp_path_factory, storage_backend="local")


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def spa_app(tmp_path_factory):
    """Real seeded app whose SPA_DIST points at a fake built `dist/` we control.

    Reuses ``_make_app`` so the DB is seeded (needed for `/api/people`), then
    lays down a recognizable fake frontend build so the spa blueprint serves
    real bytes off disk (nothing mocked).
    """
    app = _make_app(tmp_path_factory, storage_backend="local")
    dist_dir = tmp_path_factory.mktemp("dist")
    (dist_dir / "index.html").write_bytes(b'<!doctype html><div id="root">SPA-INDEX</div>')
    (dist_dir / "assets").mkdir(parents=True, exist_ok=True)
    (dist_dir / "assets" / "app.js").write_bytes(b'console.log("spa-asset");')
    (dist_dir / "favicon.svg").write_bytes(b"<svg/>")
    (dist_dir / "icons.svg").write_bytes(b"<svg/>")
    app.config["SPA_DIST"] = str(dist_dir)
    return app


@pytest.fixture
def spa_client(spa_app):
    return spa_app.test_client()


class _StubStorage:
    """Stand-in for S3Storage that returns a fixed CDN URL without any network.

    Only used to prove the media route's s3 redirect branch (test 6).
    """

    def person_photo_url(self, slug, filename):
        return "https://cdn.example/x.jpg"

    def event_photo_url(self, slug, filename):
        return "https://cdn.example/x.jpg"


@pytest.fixture
def s3_app(tmp_path_factory):
    """Separate app instance configured for the s3 backend with a stub storage.

    A distinct instance (not the `app` fixture) avoids config/storage bleed.
    """
    app = _make_app(tmp_path_factory, storage_backend="s3")
    app.extensions["storage"] = _StubStorage()
    return app
