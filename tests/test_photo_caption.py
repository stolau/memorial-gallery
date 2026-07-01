"""Real proofs for the caption-update write API (app/admin_api.py PATCH routes).

Every assertion checks a REAL DB row read back through app.models inside an app
context. Nothing is mocked: the authed_client carries a genuine ``authed``
session and the requests flow through the actual admin_api blueprint.

Seeded data we lean on (see tests/conftest.py::_seed):
  - person 'kalevi'  : 1 gallery photo 'p-aaaa.jpg'
  - person 'aino'    : 1 gallery photo 'p-aino.jpg'
  - event  'party'   : 1 gallery photo 'e-bbbb.jpg'
"""

from __future__ import annotations

from app import models


# --- helpers (mirror tests/test_write_api.py) -----------------------------


def _photo_id(app, slug: str, filename: str) -> int:
    with app.app_context():
        pid = models.get_person(slug)["id"]
        for ph in models.list_photos(pid):
            if ph["filename"] == filename:
                return ph["id"]
    raise AssertionError(f"photo {filename!r} not found under {slug!r}")


def _event_photo_id(app, slug: str, filename: str) -> int:
    with app.app_context():
        eid = models.get_event(slug)["id"]
        for ph in models.list_event_photos(eid):
            if ph["filename"] == filename:
                return ph["id"]
    raise AssertionError(f"event photo {filename!r} not found under {slug!r}")


def _person_photo_caption(app, slug: str, photo_id: int) -> str | None:
    with app.app_context():
        pid = models.get_person(slug)["id"]
        for ph in models.list_photos(pid):
            if ph["id"] == photo_id:
                return ph["caption"]
    raise AssertionError(f"photo id {photo_id} not found under {slug!r}")


def _event_photo_caption(app, slug: str, photo_id: int) -> str | None:
    with app.app_context():
        eid = models.get_event(slug)["id"]
        for ph in models.list_event_photos(eid):
            if ph["id"] == photo_id:
                return ph["caption"]
    raise AssertionError(f"event photo id {photo_id} not found under {slug!r}")


# ==========================================================================
# PEOPLE
# ==========================================================================


def test_update_person_photo_caption_sets_new_value(app, authed_client):
    photo_id = _photo_id(app, "kalevi", "p-aaaa.jpg")

    r = authed_client.patch(
        f"/api/people/kalevi/photos/{photo_id}", json={"caption": "New cap"}
    )
    assert r.status_code == 200
    assert r.get_json() == {"ok": True}

    # Read the REAL row back: the caption landed in the DB.
    assert _person_photo_caption(app, "kalevi", photo_id) == "New cap"


def test_update_person_photo_caption_empty_string_clears_to_none(app, authed_client):
    """An empty string flows through ``_str_or_none`` and becomes SQL NULL."""
    photo_id = _photo_id(app, "kalevi", "p-aaaa.jpg")
    # Seed a non-null caption first so clearing is observable.
    authed_client.patch(
        f"/api/people/kalevi/photos/{photo_id}", json={"caption": "temp"}
    )
    assert _person_photo_caption(app, "kalevi", photo_id) == "temp"

    r = authed_client.patch(
        f"/api/people/kalevi/photos/{photo_id}", json={"caption": ""}
    )
    assert r.status_code == 200
    assert r.get_json() == {"ok": True}

    assert _person_photo_caption(app, "kalevi", photo_id) is None


def test_update_person_photo_caption_unknown_id_is_404(app, authed_client):
    r = authed_client.patch(
        "/api/people/kalevi/photos/999999", json={"caption": "x"}
    )
    assert r.status_code == 404
    assert "error" in r.get_json()


def test_update_person_photo_caption_cross_slug_guard(app, authed_client):
    """PATCHing a real photo id under the WRONG person's slug must 404 and
    leave the row's caption fully intact. Against an unconditional
    ``UPDATE photos SET caption=? WHERE id=?`` this would 200 and corrupt data."""
    aino_photo_id = _photo_id(app, "aino", "p-aino.jpg")
    before = _person_photo_caption(app, "aino", aino_photo_id)

    # Attempt update under kalevi's slug -- aino's photo does not belong there.
    r = authed_client.patch(
        f"/api/people/kalevi/photos/{aino_photo_id}", json={"caption": "hijacked"}
    )
    assert r.status_code == 404
    assert "error" in r.get_json()

    # The caption is untouched.
    assert _person_photo_caption(app, "aino", aino_photo_id) == before


def test_update_person_photo_caption_requires_auth(app, client):
    photo_id = _photo_id(app, "kalevi", "p-aaaa.jpg")
    before = _person_photo_caption(app, "kalevi", photo_id)

    r = client.patch(
        f"/api/people/kalevi/photos/{photo_id}", json={"caption": "sneaky"}
    )
    assert r.status_code == 401

    # Nothing changed.
    assert _person_photo_caption(app, "kalevi", photo_id) == before


# ==========================================================================
# EVENTS (twins)
# ==========================================================================


def test_update_event_photo_caption_sets_new_value(app, authed_client):
    photo_id = _event_photo_id(app, "party", "e-bbbb.jpg")

    r = authed_client.patch(
        f"/api/events/party/photos/{photo_id}", json={"caption": "New cap"}
    )
    assert r.status_code == 200
    assert r.get_json() == {"ok": True}

    assert _event_photo_caption(app, "party", photo_id) == "New cap"


def test_update_event_photo_caption_empty_string_clears_to_none(app, authed_client):
    photo_id = _event_photo_id(app, "party", "e-bbbb.jpg")
    authed_client.patch(
        f"/api/events/party/photos/{photo_id}", json={"caption": "temp"}
    )
    assert _event_photo_caption(app, "party", photo_id) == "temp"

    r = authed_client.patch(
        f"/api/events/party/photos/{photo_id}", json={"caption": ""}
    )
    assert r.status_code == 200
    assert r.get_json() == {"ok": True}

    assert _event_photo_caption(app, "party", photo_id) is None


def test_update_event_photo_caption_unknown_id_is_404(app, authed_client):
    r = authed_client.patch(
        "/api/events/party/photos/999999", json={"caption": "x"}
    )
    assert r.status_code == 404
    assert "error" in r.get_json()


def test_update_event_photo_caption_cross_slug_guard(app, authed_client):
    """A real event-photo id under the wrong event slug must 404 and leave the
    caption intact."""
    with app.app_context():
        models.create_event("other-event", "Other Event")
    party_photo_id = _event_photo_id(app, "party", "e-bbbb.jpg")
    before = _event_photo_caption(app, "party", party_photo_id)

    r = authed_client.patch(
        f"/api/events/other-event/photos/{party_photo_id}",
        json={"caption": "hijacked"},
    )
    assert r.status_code == 404
    assert "error" in r.get_json()

    assert _event_photo_caption(app, "party", party_photo_id) == before


def test_update_event_photo_caption_requires_auth(app, client):
    photo_id = _event_photo_id(app, "party", "e-bbbb.jpg")
    before = _event_photo_caption(app, "party", photo_id)

    r = client.patch(
        f"/api/events/party/photos/{photo_id}", json={"caption": "sneaky"}
    )
    assert r.status_code == 401

    assert _event_photo_caption(app, "party", photo_id) == before
