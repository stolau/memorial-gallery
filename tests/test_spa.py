"""Proof that the SPA blueprint serves the built frontend and respects route
precedence over the API / redirect rules.

The spa blueprint is registered LAST, so concrete blueprints (api, admin_api,
media) must win over its `/<path:path>` catch-all, while unknown slugs fall
through to the SPA index. Everything drives the REAL app via the `spa_client`
fixture, which points `SPA_DIST` at a fake-but-real `dist/` directory on disk;
the bytes asserted here are byte-for-byte what the fixture wrote. Nothing is
mocked.
"""

from __future__ import annotations

from tests.conftest import _make_app


def test_index_serves_spa_html(spa_client):
    resp = spa_client.get("/")
    assert resp.status_code == 200
    assert b"SPA-INDEX" in resp.data


def test_asset_served_exactly(spa_client):
    resp = spa_client.get("/assets/app.js")
    assert resp.status_code == 200
    assert resp.data == b'console.log("spa-asset");'


def test_missing_asset_is_404_not_index(spa_client):
    # A real asset miss must be a natural 404, NOT a fallthrough to index.html.
    resp = spa_client.get("/assets/missing.js")
    assert resp.status_code == 404
    assert b"SPA-INDEX" not in resp.data


def test_api_wins_over_spa_catch_all(spa_client):
    resp = spa_client.get("/api/people")
    assert resp.status_code == 200
    assert resp.mimetype == "application/json"
    assert b"SPA-INDEX" not in resp.data


def test_slug_route_owned_by_spa(spa_client):
    # /kalevi is a seeded person, but the slug route now belongs to the SPA.
    resp = spa_client.get("/kalevi")
    assert resp.status_code == 200
    assert b"SPA-INDEX" in resp.data


def test_legacy_event_path_redirects(spa_client):
    resp = spa_client.get("/event/party", follow_redirects=False)
    assert resp.status_code == 301
    assert resp.headers["Location"].endswith("/events/party")


def test_missing_dist_guard_returns_503(tmp_path_factory):
    # Point SPA_DIST at a path we control that is GUARANTEED never to exist, so
    # the guard is exercised regardless of whether the repo's real dist exists.
    app = _make_app(tmp_path_factory, storage_backend="local")
    nonexistent = tmp_path_factory.mktemp("nodist") / "does-not-exist"
    app.config["SPA_DIST"] = str(nonexistent)

    resp = app.test_client().get("/")
    assert resp.status_code == 503
    assert b"npm run build" in resp.data
