"""Proof for the production dev-default secret guard in ``app.create_app``.

The guard (in ``app/__init__.py``) refuses to boot when a *production signal*
is present AND a dev-default secret is still in effect:

* Production signal: env ``BEHIND_PROXY`` truthy OR env ``SESSION_COOKIE_SECURE``
  truthy, where truthy == one of "1"/"true"/"yes" (case-insensitive).
* Offending secrets: ``SECRET_KEY`` still ``"dev-only-change-me"`` or empty, and
  ``UPLOAD_PASSWORD`` still ``"changeme"`` or empty.

When triggered it raises ``RuntimeError`` whose message NAMES each offending env
var. With no production signal the dev defaults are allowed and the factory
returns a normal Flask app.

Every test fully controls the four relevant env vars: the ``_clean_env`` helper
``delenv``s all of them first so an ambient exported var can never flip a result,
then each test sets only what it needs. Nothing is mocked -- the REAL
``create_app`` is exercised.
"""

from __future__ import annotations

import flask
import pytest

from app import create_app

# Dev-default sentinels the guard checks against (must match app/__init__.py).
DEV_SECRET_KEY = "dev-only-change-me"
DEV_UPLOAD_PASSWORD = "changeme"

# Strong stand-in values that must NOT trip the guard.
STRONG_SECRET_KEY = "a" * 64
STRONG_UPLOAD_PASSWORD = "s3cret-upload-pw"

# All env vars that influence the guard's decision.
_GUARD_VARS = ("BEHIND_PROXY", "SESSION_COOKIE_SECURE", "SECRET_KEY", "UPLOAD_PASSWORD")


def _clean_env(monkeypatch):
    """Remove every guard-relevant var so tests start from a known-empty slate.

    Uses ``raising=False`` so it works whether or not the var is currently set
    (e.g. exported ambiently in the shell/CI). After this, only what a test sets
    explicitly via ``monkeypatch.setenv`` is visible to ``create_app``.
    """
    for var in _GUARD_VARS:
        monkeypatch.delenv(var, raising=False)


def test_prod_signal_default_secret_key_raises(monkeypatch):
    """Case 1: prod signal + strong UPLOAD_PASSWORD but default SECRET_KEY -> raise."""
    _clean_env(monkeypatch)
    monkeypatch.setenv("BEHIND_PROXY", "1")
    monkeypatch.setenv("UPLOAD_PASSWORD", STRONG_UPLOAD_PASSWORD)
    # SECRET_KEY deliberately left unset -> factory default "dev-only-change-me".

    with pytest.raises(RuntimeError) as excinfo:
        create_app()

    assert "SECRET_KEY" in str(excinfo.value)


def test_prod_signal_default_upload_password_raises(monkeypatch):
    """Case 2: prod signal + strong SECRET_KEY but default UPLOAD_PASSWORD -> raise."""
    _clean_env(monkeypatch)
    monkeypatch.setenv("BEHIND_PROXY", "1")
    monkeypatch.setenv("SECRET_KEY", STRONG_SECRET_KEY)
    # UPLOAD_PASSWORD deliberately left unset -> factory default "changeme".

    with pytest.raises(RuntimeError) as excinfo:
        create_app()

    assert "UPLOAD_PASSWORD" in str(excinfo.value)


def test_prod_signal_both_strong_returns_app(monkeypatch):
    """Case 3: prod signal + both secrets strong -> normal Flask app, no raise."""
    _clean_env(monkeypatch)
    monkeypatch.setenv("BEHIND_PROXY", "1")
    monkeypatch.setenv("SECRET_KEY", STRONG_SECRET_KEY)
    monkeypatch.setenv("UPLOAD_PASSWORD", STRONG_UPLOAD_PASSWORD)

    app = create_app()

    assert isinstance(app, flask.Flask)
    assert app.config["SECRET_KEY"] == STRONG_SECRET_KEY
    assert app.config["UPLOAD_PASSWORD"] == STRONG_UPLOAD_PASSWORD


def test_dev_defaults_allowed_without_prod_signal(monkeypatch):
    """Case 4: no prod signal + factory defaults -> app boots with dev defaults."""
    _clean_env(monkeypatch)
    # No BEHIND_PROXY / SESSION_COOKIE_SECURE, no secret overrides.

    app = create_app()

    assert isinstance(app, flask.Flask)
    assert app.config["SECRET_KEY"] == DEV_SECRET_KEY
    assert app.config["UPLOAD_PASSWORD"] == DEV_UPLOAD_PASSWORD


def test_session_cookie_secure_signal_default_secret_raises(monkeypatch):
    """Case 5: the OTHER prod signal (SESSION_COOKIE_SECURE=true) trips the guard."""
    _clean_env(monkeypatch)
    monkeypatch.setenv("SESSION_COOKIE_SECURE", "true")
    # Both secrets left at factory defaults.

    with pytest.raises(RuntimeError) as excinfo:
        create_app()

    assert "SECRET_KEY" in str(excinfo.value)


def test_prod_signal_empty_secret_key_raises(monkeypatch):
    """Case 6: prod signal + explicitly EMPTY SECRET_KEY -> raise (the 'or empty' branch)."""
    _clean_env(monkeypatch)
    monkeypatch.setenv("BEHIND_PROXY", "1")
    monkeypatch.setenv("SECRET_KEY", "")  # explicit empty -> must still be rejected
    monkeypatch.setenv("UPLOAD_PASSWORD", STRONG_UPLOAD_PASSWORD)

    with pytest.raises(RuntimeError) as excinfo:
        create_app()

    assert "SECRET_KEY" in str(excinfo.value)
