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

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.e2e


@pytest.fixture(scope="session")
def base_url(live_server):
    # Module-local override (NOT in conftest) so pytest_base_url's autouse
    # ``_verify_url`` only pulls the live server + dist/chromium skip-guard for
    # e2e tests, never the default suite. ``live_server`` is shared from conftest.
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
