"""Playwright E2E for the public VIEWER surface: lightbox, portrait dialog, i18n.

Complements test_e2e_smoke.py (page loads / media bytes) and test_e2e_admin.py
(admin write path) by driving the reader-facing interactions against real Flask +
the built SPA: the photo lightbox (navigate / auto-advance / close), the portrait
"show info" dialog (incl. the ?showinfo=1 deep-link), and the language switch.
Reuses the live-server fixtures lifted into conftest.py. Marked e2e; excluded from
the default gate.
"""
from __future__ import annotations

import time

import pytest
from playwright.sync_api import expect

from tests.conftest import JPEG_BYTES

pytestmark = pytest.mark.e2e


@pytest.fixture(scope="session")
def base_url(live_server):
    # Module-local override (NOT in conftest) so pytest_base_url's autouse
    # ``_verify_url`` only pulls the live server + dist/chromium skip-guard for
    # e2e tests, never the default suite. ``live_server`` is shared from conftest.
    return live_server


def _login_and_create_person(page, *, birth_year=None, photos=0):
    """Log in, create a fresh uniquely-named person, optionally upload photos.

    Returns ``(name, slug)``. The slug is the server-side slugification of the
    name (app/admin_logic._slugify) and is parsed straight off the edit URL,
    which react-router shapes as ``/admin/people/<slug>/edit``. That same slug
    drives the public page (``/<slug>``) and the API (``/api/people/<slug>``).
    """
    name = f"E2E Viewer {int(time.time() * 1000)}"

    # Log in (password field is not i18n'd) and land on /admin via ?next.
    page.goto("/login?next=/admin")
    page.get_by_label("Password").fill("changeme")
    page.get_by_role("button", name="Log in").click()
    page.wait_for_url("**/admin")

    # Create the person; the form redirects to its edit page on success.
    page.goto("/admin/people/new")
    page.get_by_label("Nimi").fill(name)
    if birth_year is not None:
        page.get_by_label("Syntymävuosi").fill(str(birth_year))
    page.get_by_role("button", name="Tallenna").click()
    page.wait_for_url("**/admin/people/*/edit")

    # /admin/people/<slug>/edit -> the second-to-last path segment is the slug.
    slug = page.url.rstrip("/").split("/")[-2]

    if photos > 0:
        file_input = page.locator("input[type='file'][multiple]")
        file_input.set_input_files(
            files=[
                {"name": f"e2e{i}.jpg", "mimeType": "image/jpeg", "buffer": JPEG_BYTES}
                for i in range(photos)
            ]
        )
        page.get_by_role("button", name="Lataa").click()
        # MANDATORY: wait for the uploads to persist before returning, else the
        # next navigation aborts the in-flight POST (mirrors the admin guard).
        expect(page.locator(".photo-grid figure")).to_have_count(photos)

    return name, slug


def test_lightbox_navigate_and_close(page):
    _name, slug = _login_and_create_person(page, photos=2)
    page.goto(f"/{slug}")

    page.locator(".photo-grid-btn").first.click()
    expect(page.get_by_role("dialog")).to_be_visible()
    img = page.locator(".lightbox-img")
    expect(img).to_be_visible()
    first_src = img.get_attribute("src")

    page.get_by_role("button", name="Seuraava").click()
    expect(img).not_to_have_attribute("src", first_src)

    page.keyboard.press("Escape")
    expect(page.get_by_role("dialog")).to_have_count(0)


def test_lightbox_autoadvance_toggle(page):
    page.goto("/kalevi")
    page.locator(".photo-grid-btn").first.click()

    expect(page.get_by_role("button", name="Toista")).to_be_visible()
    page.get_by_role("button", name="Toista").click()
    expect(page.get_by_role("button", name="Keskeytä")).to_be_visible()
    expect(page.get_by_role("button", name="Toista")).to_have_count(0)


def test_portrait_dialog_and_showinfo(page):
    # (a) Freshly created person: open the portrait dialog from the page button.
    name, slug = _login_and_create_person(page, birth_year=1930)
    page.goto(f"/{slug}")
    page.get_by_role("button", name="Näytä tiedot").click()
    dialog = page.get_by_role("dialog")
    expect(dialog).to_be_visible()
    # Scope the heading to the dialog: PersonPage also renders an <h1> with the
    # same name, so an unscoped heading query would be ambiguous.
    expect(dialog.get_by_role("heading", name=name)).to_be_visible()
    expect(dialog.get_by_text("1930")).to_be_visible()
    page.get_by_role("button", name="Sulje").click()
    expect(page.get_by_role("dialog")).to_have_count(0)

    # (b) Seeded person via the ?showinfo=1 deep-link opens the dialog on load.
    page.goto("/kalevi?showinfo=1")
    dialog = page.get_by_role("dialog")
    expect(dialog).to_be_visible()
    # Scoped to the dialog: PersonPage's own <h1>Kalevi</h1> is also present.
    expect(dialog.get_by_role("heading", name="Kalevi")).to_be_visible()


def test_language_switch(page):
    page.goto("/")
    # exact=True: the seeded "Events Person" card link substring-matches a bare
    # name="Events", so pin the nav link to an exact accessible name.
    expect(page.get_by_role("link", name="Tapahtumat", exact=True)).to_be_visible()

    page.get_by_role("button", name="English").click()
    expect(page.get_by_role("link", name="Events", exact=True)).to_be_visible()
    expect(page.get_by_role("button", name="English")).to_have_attribute(
        "aria-pressed", "true"
    )
