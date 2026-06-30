"""Playwright E2E smoke tests against the REAL Flask app + built SPA.

These boot the real application factory (via ``tests.conftest._make_app``, the
same seeder the unit suite uses) on a live werkzeug server and drive a real
chromium browser through the built ``frontend/dist`` bundle. The load-bearing
assertion proves that seeded media bytes actually fetch and decode through real
Flask (``naturalWidth > 0``), not just that markup renders.

Excluded from the default test gate (marked ``e2e``); run with ``pytest -m e2e``.
Requires chromium (``python -m playwright install chromium``) and a built
``frontend/dist`` (``cd frontend && npm ci && npm run build``).
"""

from __future__ import annotations

import threading
import time
import urllib.request
from pathlib import Path

import pytest
from playwright.sync_api import expect, sync_playwright

from tests.conftest import _make_app

REPO_ROOT = Path(__file__).resolve().parent.parent
DIST = REPO_ROOT / "frontend" / "dist"

pytestmark = pytest.mark.e2e


@pytest.fixture(scope="session")
def _e2e_env():
    """Skip the whole module unless the build + browser are actually present."""
    if not (DIST / "index.html").is_file():
        pytest.skip(
            "frontend/dist not built — run: cd frontend && npm ci && npm run build",
            allow_module_level=False,
        )
    try:
        with sync_playwright() as p:
            exe = p.chromium.executable_path
        if not exe or not Path(exe).exists():
            pytest.skip(
                "Chromium not installed — run: python -m playwright install chromium"
            )
    except Exception:
        pytest.skip(
            "Chromium not installed — run: python -m playwright install chromium"
        )


@pytest.fixture(scope="session")
def live_server(_e2e_env, tmp_path_factory):
    """Boot the real seeded app on a background werkzeug server, ready on HTTP 200."""
    from werkzeug.serving import make_server

    app = _make_app(tmp_path_factory, "local")
    app.config["SPA_DIST"] = str(DIST)

    server = make_server("127.0.0.1", 0, app, threaded=True)
    port = server.server_port
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    url = f"http://127.0.0.1:{port}/"
    deadline = time.time() + 15
    ready = False
    while time.time() < deadline:
        try:
            resp = urllib.request.urlopen(url, timeout=1)
            if resp.status == 200:
                ready = True
                break
        except Exception:
            pass
        time.sleep(0.1)
    if not ready:
        pytest.fail("live server did not return 200 for / within timeout")

    yield f"http://127.0.0.1:{port}"

    server.shutdown()
    thread.join()


@pytest.fixture(scope="session")
def base_url(live_server):
    # Override pytest-playwright's base_url so relative goto works AND so fixture
    # ordering (page -> context -> base_url -> live_server -> _e2e_env) guarantees
    # the skip-guard runs before chromium launches.
    return live_server


def test_person_page_loads_real_media_bytes(page):
    page.goto("/")
    page.get_by_role("link", name="Kalevi").click()
    expect(page.get_by_role("heading", name="Kalevi")).to_be_visible()
    # Load-bearing: the seeded /media/kalevi/p-aaaa.jpg must fetch decodable bytes
    # through real Flask. wait_for_function raises TimeoutError on failure.
    page.wait_for_function(
        "() => { const i = document.querySelector(\"img[src*='/media/']\");"
        " return !!(i && i.complete && i.naturalWidth > 0); }"
    )


def test_event_page_renders(page):
    page.goto("/events")
    page.get_by_role("link", name="Party").click()
    expect(page.get_by_role("heading", name="Party")).to_be_visible()
    expect(page.locator(".photo-grid img")).to_have_count(1)
