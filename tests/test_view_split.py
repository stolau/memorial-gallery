"""Proof that the Jinja admin/auth/views surface is retired and the SPA owns it.

After "Move E" the app registers only the api / admin_api / media / spa
blueprints. The old Jinja management + auth + public view rules are gone:
there is no `admin`, `auth`, or `views` blueprint left, so their endpoints can
no longer be built. In single-origin mode the SPA blueprint's `/<path:path>`
catch-all serves /login and /admin/* off the built `dist/index.html` instead of
Jinja templates.

Everything here drives the REAL app via conftest fixtures. The `spa_client`
fixture lays down a real `dist/index.html` on disk whose body contains the
literal marker bytes ``SPA-INDEX``; asserting that marker proves the bytes came
from the SPA catch-all (send_from_directory) and not from a Jinja render.
Nothing is mocked.
"""

from __future__ import annotations

import pytest
from flask import url_for
from werkzeug.routing import BuildError

# Endpoints that belonged to the now-deleted Jinja blueprints. Each must be
# unbuildable because the concrete URL rule no longer exists in the map.
REMOVED_ENDPOINTS = [
    ("admin.index", {}),
    ("admin.edit", {"slug": "kalevi"}),
    ("admin.upload", {"slug": "kalevi"}),
    ("admin.event_edit", {"slug": "party"}),
    ("admin.event_upload", {"slug": "party"}),
    ("auth.login", {}),
    ("auth.logout", {}),
    ("views.set_language", {"lang": "en"}),
]

# Paths the SPA catch-all must now own (previously Jinja-rendered / gated).
SPA_OWNED_PATHS = [
    "/login",
    "/admin",
    "/admin/",
    "/admin/kalevi/edit",
    "/admin/event/party/edit",
]


def test_legacy_endpoints_unbuildable(app):
    """None of the retired Jinja endpoints can be reverse-routed anymore."""
    # A request context is an app context that also supplies a URL adapter, so
    # a missing endpoint surfaces as a genuine BuildError (not a bare-context
    # "SERVER_NAME not configured" RuntimeError).
    with app.test_request_context():
        for endpoint, kwargs in REMOVED_ENDPOINTS:
            with pytest.raises(BuildError):
                url_for(endpoint, **kwargs)


def test_spa_owns_login_and_admin(spa_client):
    """/login and /admin/* are served by the SPA catch-all, not Jinja."""
    for path in SPA_OWNED_PATHS:
        resp = spa_client.get(path)
        assert resp.status_code == 200, (
            f"{path} expected 200, got {resp.status_code}"
        )
        assert b"SPA-INDEX" in resp.data, (
            f"{path} did not serve the SPA index marker; body={resp.data!r}"
        )
