"""Real auth-flow proofs against the live login/logout routes.

Nothing mocked: each test drives the real Flask test client through the actual
``auth`` blueprint, then inspects the REAL signed session cookie / response body.
DEFAULT_LANG is "fi" with a compiled catalog, so tests that assert on flash TEXT
first pin the session locale to "en" (no catalog -> gettext falls back to msgid).
"""

from __future__ import annotations


def test_login_wrong_password_rerenders_and_stays_anon(app, client):
    with client.session_transaction() as s:
        s["lang"] = "en"

    resp = client.post("/login", data={"password": "definitely-wrong"})

    # Re-render (NOT a redirect) so the user can retry.
    assert resp.status_code == 200
    assert b'name="password"' in resp.data
    # The flash is consumed by base.html during this same render, so it must be
    # asserted via the response BODY, not the session.
    assert b"Wrong password." in resp.data

    with client.session_transaction() as s:
        assert not s.get("authed")


def test_login_correct_password_redirects_to_next(app, client):
    resp = client.post(
        "/login?next=/admin/",
        data={"password": app.config["UPLOAD_PASSWORD"]},
    )

    assert resp.status_code == 302
    assert resp.headers["Location"].endswith("/admin/")

    with client.session_transaction() as s:
        assert s.get("authed") is True


def test_logout_clears_auth(app, client):
    with client.session_transaction() as s:
        s["authed"] = True

    resp = client.post("/logout")

    assert resp.status_code == 302
    with client.session_transaction() as s:
        assert not s.get("authed")
