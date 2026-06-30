"""Proof that the API presenters enrich rows with storage-derived media URLs.

Exercises the REAL app factory + REAL model seeding + REAL LocalStorage (same
harness as tests/test_media_api.py). All URLs are asserted against the actual
``url_for`` output the route resolves to (``/media/...``).

The key falsifiability check is test 2: kalevi is seeded with NO profile_image,
so the null-guard in ``attach_profile_url`` must produce ``None`` rather than a
bogus ``/media/kalevi/None`` URL.
"""

from __future__ import annotations


def _find(items, slug):
    for it in items:
        if it["slug"] == slug:
            return it
    raise AssertionError(f"slug {slug!r} not found in {[i['slug'] for i in items]}")


# --- 1. /api/people enriches profile_image_url when present ----------------

def test_people_index_attaches_profile_url(client):
    resp = client.get("/api/people")
    assert resp.status_code == 200, resp.get_data(as_text=True)
    aino = _find(resp.get_json(), "aino")
    assert aino["profile_image_url"] == "/media/aino/profile/aino.jpg"


# --- 2. Null-guard: no profile_image -> None (NOT /media/kalevi/None) ------

def test_people_index_null_profile_url(client):
    resp = client.get("/api/people")
    assert resp.status_code == 200, resp.get_data(as_text=True)
    kalevi = _find(resp.get_json(), "kalevi")
    assert kalevi["profile_image_url"] is None


# --- 3. /api/events enriches cover_url from latest event photo -------------

def test_events_index_attaches_cover_url(client):
    resp = client.get("/api/events")
    assert resp.status_code == 200, resp.get_data(as_text=True)
    party = _find(resp.get_json(), "party")
    assert party["cover_url"] == "/media/events/party/e-bbbb.jpg"


# --- 4. /api/people/<slug> enriches person profile + every photo url -------

def test_person_detail_attaches_profile_and_photo_urls(client):
    resp = client.get("/api/people/aino")
    assert resp.status_code == 200, resp.get_data(as_text=True)
    data = resp.get_json()
    assert data["person"]["profile_image_url"] == "/media/aino/profile/aino.jpg"
    assert data["photos"], "expected at least one photo for aino"
    for ph in data["photos"]:
        assert ph["url"], f"photo missing url: {ph}"


# --- 5. /api/events/<slug> photos carry url --------------------------------

def test_event_detail_attaches_photo_urls(client):
    resp = client.get("/api/events/party")
    assert resp.status_code == 200, resp.get_data(as_text=True)
    data = resp.get_json()
    assert data["photos"][0]["url"] == "/media/events/party/e-bbbb.jpg"
