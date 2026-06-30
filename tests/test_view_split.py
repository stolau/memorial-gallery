"""Proof that the `views` blueprint split is correct after the SPA migration.

The four login-gated routes live on the `admin` blueprint (url_prefix="/admin"):
    admin.edit          GET/POST /admin/<slug>/edit
    admin.upload        GET/POST /admin/<slug>/upload
    admin.event_edit    GET/POST /admin/event/<slug>/edit
    admin.event_upload  GET/POST /admin/event/<slug>/upload

The old public Jinja views were DELETED in favor of the SPA: views.index (/),
views.person (/<slug>) and views.event (/event/<slug>) no longer exist; only
views.set_language survives on the `views` blueprint. The legacy management
endpoints views.edit/upload/event_edit/event_upload were also removed.

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


def test_management_urls_build(app):
    with app.test_request_context():
        assert url_for("admin.edit", slug="kalevi") == "/admin/kalevi/edit"
        assert url_for("admin.upload", slug="kalevi") == "/admin/kalevi/upload"
        assert url_for("admin.event_edit", slug="party") == "/admin/event/party/edit"
        assert url_for("admin.event_upload", slug="party") == "/admin/event/party/upload"


def test_old_endpoints_removed(app):
    removed = [
        ("views.index", {}),
        ("views.person", {"slug": "kalevi"}),
        ("views.event", {"slug": "party"}),
        ("views.edit", {"slug": "kalevi"}),
        ("views.upload", {"slug": "kalevi"}),
        ("views.event_edit", {"slug": "party"}),
        ("views.event_upload", {"slug": "party"}),
    ]
    with app.test_request_context():
        for endpoint, kwargs in removed:
            with pytest.raises(BuildError):
                url_for(endpoint, **kwargs)


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


def test_admin_auth_templates_render(client):
    # All these templates extend base.html; a stale url_for to a deleted endpoint
    # would raise BuildError and surface as a 500. A clean 200 is the acceptance
    # gate proving every kept template still renders after the rewire.
    with client.session_transaction() as s:
        s["authed"] = True
    paths = [
        "/admin/",  # admin.index is route "/" under url_prefix "/admin"
        "/login",
        "/admin/kalevi/edit",
        "/admin/kalevi/upload",
        "/admin/event/party/edit",
        "/admin/event/party/upload",
    ]
    for path in paths:
        resp = client.get(path)
        assert resp.status_code == 200, f"{path} expected 200, got {resp.status_code}"
