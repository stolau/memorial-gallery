"""Playwright E2E for the admin WRITE path: login -> create -> upload -> delete.

Complements test_e2e_smoke.py (public pages) by driving the authenticated admin
flow against real Flask + the built SPA. Reuses the live-server fixtures lifted
into conftest.py. Marked e2e; excluded from the default gate.
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


def test_admin_create_upload_delete_flow(page):
    # Auto-accept the window.confirm() dialogs on photo/person delete.
    page.on("dialog", lambda d: d.accept())
    name = f"E2E Person {int(time.time())}"

    # 1. Log in (password field is not i18n'd) and land on /admin via ?next.
    page.goto("/login?next=/admin")
    page.get_by_label("Password").fill("changeme")
    page.get_by_role("button", name="Log in").click()
    page.wait_for_url("**/admin")
    expect(page.get_by_role("heading", name="Henkilöt")).to_be_visible()

    # 2. Create a person; the form redirects to its edit page on success.
    page.goto("/admin/people/new")
    page.get_by_label("Nimi").fill(name)
    page.get_by_role("button", name="Tallenna").click()
    page.wait_for_url("**/admin/people/*/edit")
    assert name in page.request.get("/api/people").text()

    # 3. Upload a real JPEG through the admin photo grid (the multiple-file input,
    #    distinct from the single-file profile-image input) and prove the bytes
    #    round-trip through real Flask media serving (decoded pixels, not markup).
    file_input = page.locator("input[type='file'][multiple]")
    file_input.set_input_files(
        files=[{"name": "e2e.jpg", "mimeType": "image/jpeg", "buffer": JPEG_BYTES}]
    )
    page.get_by_role("button", name="Lataa").click()
    page.wait_for_function(
        "() => { const i = document.querySelector(\".photo-grid img[src*='/media/']\");"
        " return !!(i && i.complete && i.naturalWidth > 0); }"
    )
    expect(page.locator(".photo-grid figure")).to_have_count(1)

    # 4. Delete the photo, then the person; assert both are gone.
    page.locator(".photo-grid figure").first.get_by_role(
        "button", name="Poista"
    ).click()
    expect(page.locator(".photo-grid figure")).to_have_count(0)

    page.goto("/admin")
    person_item = page.get_by_role("listitem").filter(has_text=name)
    expect(person_item).to_have_count(1)
    person_item.get_by_role("button", name="Poista").click()
    expect(page.get_by_role("listitem").filter(has_text=name)).to_have_count(0)
    assert name not in page.request.get("/api/people").text()


def _login_and_create_person(page):
    """Log in and create a fresh uniquely-named person; return ``(name, slug)``.

    Mirrors the login+create steps of test_admin_create_upload_delete_flow. The
    slug is the server-side slugification of the name (app/admin_logic._slugify),
    parsed off the ``/admin/people/<slug>/edit`` redirect URL and reused to hit
    ``/api/people/<slug>``.
    """
    name = f"E2E Person {int(time.time() * 1000)}"
    page.goto("/login?next=/admin")
    page.get_by_label("Password").fill("changeme")
    page.get_by_role("button", name="Log in").click()
    page.wait_for_url("**/admin")

    page.goto("/admin/people/new")
    page.get_by_label("Nimi").fill(name)
    page.get_by_role("button", name="Tallenna").click()
    page.wait_for_url("**/admin/people/*/edit")
    slug = page.url.rstrip("/").split("/")[-2]
    return name, slug


def _upload_photos(page, count):
    """Upload ``count`` real JPEGs via the admin photo grid; wait until persisted."""
    file_input = page.locator("input[type='file'][multiple]")
    file_input.set_input_files(
        files=[
            {"name": f"e2e{i}.jpg", "mimeType": "image/jpeg", "buffer": JPEG_BYTES}
            for i in range(count)
        ]
    )
    page.get_by_role("button", name="Lataa").click()
    expect(page.locator(".photo-grid figure")).to_have_count(count)


def test_admin_edit_photo_caption(page):
    _login_and_create_person(page)
    _upload_photos(page, 1)

    fig = page.locator(".photo-grid figure").first
    fig.get_by_role("button", name="Muokkaa").click()
    fig.get_by_role("textbox").fill("Uusi kuvateksti")
    fig.get_by_role("button", name="Tallenna").click()
    expect(page.locator(".photo-grid figcaption")).to_have_text("Uusi kuvateksti")


def test_admin_delete_one_of_two_photos(page):
    # Auto-accept the window.confirm() dialog on photo delete (set before clicks).
    page.on("dialog", lambda d: d.accept())
    _name, slug = _login_and_create_person(page)
    _upload_photos(page, 2)

    page.locator(".photo-grid figure").first.get_by_role(
        "button", name="Poista"
    ).click()
    expect(page.locator(".photo-grid figure")).to_have_count(1)
    assert len(page.request.get(f"/api/people/{slug}").json()["photos"]) == 1
