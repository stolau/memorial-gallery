"""Real proofs for the JSON auth API slice (admin_api + api_login_required).

Nothing mocked: every test drives the REAL Flask test client through the actual
``admin_api`` blueprint and inspects the REAL signed-session cookie / JSON body.
The password is read from ``app.config["UPLOAD_PASSWORD"]`` (the factory default)
so the suite never hard-codes the literal secret.
"""

from __future__ import annotations


def test_login_wrong_password_json_returns_401_and_stays_anon(app, client):
    resp = client.post("/api/login", json={"password": "definitely-wrong"})

    assert resp.status_code == 401
    body = resp.get_json()
    # The error branch must NOT report an authed session.
    assert body.get("authed") is not True

    with client.session_transaction() as s:
        assert not s.get("authed")


def test_login_success_flow_sets_session_and_me_reflects_it(app, client):
    # FALSIFIABILITY: /api/me is false BEFORE we log in. If this asserted true
    # here, the later `authed:true` would prove nothing (it could be a default).
    pre = client.get("/api/me")
    assert pre.status_code == 200
    assert pre.get_json() == {"authed": False}

    resp = client.post("/api/login", json={"password": app.config["UPLOAD_PASSWORD"]})

    assert resp.status_code == 200
    assert resp.get_json() == {"authed": True}
    # Logging in must hand back a session cookie.
    assert "Set-Cookie" in resp.headers

    # The same client now carries the session: /api/me flips to true.
    post = client.get("/api/me")
    assert post.status_code == 200
    assert post.get_json() == {"authed": True}

    with client.session_transaction() as s:
        assert s.get("authed") is True


def test_me_unauthenticated_returns_authed_false(app, client):
    resp = client.get("/api/me")

    assert resp.status_code == 200
    assert resp.get_json() == {"authed": False}


def test_logout_clears_session_and_me_goes_false(app, authed_client):
    # Sanity: the authed_client really is authed before we log out.
    assert authed_client.get("/api/me").get_json() == {"authed": True}

    resp = authed_client.post("/api/logout")

    assert resp.status_code == 200
    assert resp.get_json() == {"authed": False}

    after = authed_client.get("/api/me")
    assert after.status_code == 200
    assert after.get_json() == {"authed": False}


def test_login_non_json_body_is_rejected_and_stays_anon(app, client):
    # Form-encoded body (no JSON content-type) must NOT authenticate, even though
    # it carries the correct password. The route demands JSON -> 415.
    resp = client.post("/api/login", data={"password": app.config["UPLOAD_PASSWORD"]})

    assert resp.status_code != 200
    assert resp.status_code == 415

    with client.session_transaction() as s:
        assert not s.get("authed")


def test_session_cookie_hardening_config(app):
    assert app.config["SESSION_COOKIE_SAMESITE"] == "Lax"
    assert app.config["SESSION_COOKIE_HTTPONLY"] is True
    # No SESSION_COOKIE_SECURE / BEHIND_PROXY env set in the test fixture.
    assert app.config["SESSION_COOKIE_SECURE"] is False
