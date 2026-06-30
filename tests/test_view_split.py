"""Proof that the `views` blueprint split is correct.

The four login-gated routes moved INTO the `admin` blueprint (url_prefix="/admin"):
    admin.edit          GET/POST /admin/<slug>/edit
    admin.upload        GET/POST /admin/<slug>/upload
    admin.event_edit    GET/POST /admin/event/<slug>/edit
    admin.event_upload  GET/POST /admin/event/<slug>/upload

The public routes stay on the `views` blueprint:
    views.index (/), views.person (/<slug>), views.event (/event/<slug>),
    views.set_language (/lang/<code>).

The old endpoints views.edit/upload/event_edit/event_upload no longer exist.

Everything here drives the REAL app/client fixtures from conftest.py; nothing
is mocked. The auth gate is exercised via the real session-based login_required.
"""

from __future__ import annotations

import pytest
from flask import url_for
from werkzeug.routing import BuildError

GATED_PATHS = [
    "/admin/kalevi/edit",
    "/admin/kalevi/upload",
    "/admin/event/party/edit",
    "/admin/event/party/upload",
]


def test_public_routes_ok(client):
    assert client.get("/").status_code == 200
    assert client.get("/kalevi").status_code == 200
    assert client.get("/event/party").status_code == 200


def test_views_index_endpoint_resolves(app):
    with app.test_request_context():
        assert url_for("views.index") == "/"


def test_management_urls_build(app):
    with app.test_request_context():
        assert url_for("admin.edit", slug="kalevi") == "/admin/kalevi/edit"
        assert url_for("admin.upload", slug="kalevi") == "/admin/kalevi/upload"
        assert url_for("admin.event_edit", slug="party") == "/admin/event/party/edit"
        assert url_for("admin.event_upload", slug="party") == "/admin/event/party/upload"


def test_old_endpoints_removed(app):
    with app.test_request_context():
        with pytest.raises(BuildError):
            url_for("views.edit", slug="kalevi")
        with pytest.raises(BuildError):
            url_for("views.upload", slug="kalevi")
        with pytest.raises(BuildError):
            url_for("views.event_edit", slug="party")
        with pytest.raises(BuildError):
            url_for("views.event_upload", slug="party")


def test_gated_routes_redirect_when_anonymous(app):
    client = app.test_client()  # fresh client, no authed session
    for path in GATED_PATHS:
        resp = client.get(path)
        assert resp.status_code == 302, f"{path} expected 302, got {resp.status_code}"
        assert "/login" in resp.headers["Location"], (
            f"{path} redirect Location missing /login: {resp.headers['Location']}"
        )


def test_gated_routes_ok_when_authed(client):
    with client.session_transaction() as s:
        s["authed"] = True
    for path in GATED_PATHS:
        resp = client.get(path)
        assert resp.status_code == 200, f"{path} expected 200, got {resp.status_code}"
