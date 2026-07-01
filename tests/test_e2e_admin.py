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
