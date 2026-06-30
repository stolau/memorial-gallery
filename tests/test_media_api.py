"""Proof that media-serving moved to an always-registered `media` blueprint and
that the API now emits relative `/media/...` URLs (the 500 -> 200 fix).

The core regression is test 1: before the fix, the API built photo URLs against
a route that lived on a conditionally-registered blueprint, so `url_for(...)`
raised BuildError -> 500. With the fix, `media.person` is always registered and
the URL resolves to `/media/<slug>/<filename>`.
"""

from __future__ import annotations

from werkzeug.exceptions import RequestEntityTooLarge

from tests.conftest import JPEG_BYTES


# --- 1. Regression (primary): the 500 -> 200 fix ---------------------------

def test_api_person_returns_relative_media_url(client):
    resp = client.get("/api/people/kalevi")
    assert resp.status_code == 200, resp.get_data(as_text=True)
    data = resp.get_json()
    assert data["photos"][0]["url"] == "/media/kalevi/p-aaaa.jpg"


# --- 2. Event API URL ------------------------------------------------------

def test_api_event_returns_relative_media_url(client):
    resp = client.get("/api/events/party")
    assert resp.status_code == 200, resp.get_data(as_text=True)
    data = resp.get_json()
    assert data["photos"][0]["url"] == "/media/events/party/e-bbbb.jpg"


# --- 3. Serving: bytes round-trip through the media routes ------------------

def test_media_person_serves_seeded_bytes(client):
    resp = client.get("/media/kalevi/p-aaaa.jpg")
    assert resp.status_code == 200
    assert resp.get_data() == JPEG_BYTES


def test_media_event_serves_seeded_bytes(client):
    resp = client.get("/media/events/party/e-bbbb.jpg")
    assert resp.status_code == 200
    assert resp.get_data() == JPEG_BYTES


# --- 4. Route overlap: static `events` segment out-prioritizes <slug> ------

def test_route_overlap_event_vs_person(app):
    adapter = app.url_map.bind("localhost")
    assert adapter.match("/media/events/party/e-bbbb.jpg")[0] == "media.event"
    assert adapter.match("/media/kalevi/p-aaaa.jpg")[0] == "media.person"


# --- 5. Edge guard: person slug literally `events`, single-segment file ----

def test_edge_person_slug_events_single_segment(app, client):
    adapter = app.url_map.bind("localhost")
    # Single-segment filename -> only two segments after /media -> media.person.
    assert adapter.match("/media/events/cover.jpg")[0] == "media.person"
    # And it actually serves the person's file.
    resp = client.get("/media/events/cover.jpg")
    assert resp.status_code == 200
    assert resp.get_data() == JPEG_BYTES


# --- 6. S3 redirect branch -------------------------------------------------

def test_s3_backend_redirects(s3_app):
    client = s3_app.test_client()
    resp = client.get("/media/kalevi/p-aaaa.jpg")
    assert resp.status_code == 302
    assert resp.headers["Location"] == "https://cdn.example/x.jpg"

    resp_evt = client.get("/media/events/party/e-bbbb.jpg")
    assert resp_evt.status_code == 302
    assert resp_evt.headers["Location"] == "https://cdn.example/x.jpg"


def test_local_backend_does_not_redirect(client):
    """Guards the s3 test: with the local backend the same URL serves bytes."""
    resp = client.get("/media/kalevi/p-aaaa.jpg")
    assert resp.status_code == 200


# --- 7. too_large handler keys off request.path ----------------------------

def test_too_large_returns_json_for_api_path(app):
    with app.test_request_context("/api/upload"):
        rv = app.handle_user_exception(RequestEntityTooLarge())
        resp = app.make_response(rv)
    assert resp.status_code == 413
    assert "error" in resp.get_json()


def test_too_large_redirects_for_non_api_path(app):
    with app.test_request_context("/upload"):
        rv = app.handle_user_exception(RequestEntityTooLarge())
        resp = app.make_response(rv)
    assert resp.status_code == 303
    assert "Location" in resp.headers
