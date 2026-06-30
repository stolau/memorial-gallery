"""Proofs for the model layer against the seeded function-scoped temp DB.

All model functions need an app context (they call get_db()); we wrap each
operation in ``with app.app_context():``.
"""

from __future__ import annotations

from app import models


# --- update_person --------------------------------------------------------

def test_update_person_ignores_non_editable_fields(app):
    # NOTE: `slug` is the first POSITIONAL parameter of update_person(slug, **fields),
    # so it can never arrive as a kwarg and is structurally unspoofable. `id` IS a
    # non-editable field that reaches **fields, so it is the real proof that the
    # EDITABLE_PERSON_FIELDS filter drops non-editable keys.
    with app.app_context():
        original_id = models.get_person("kalevi")["id"]
        models.update_person("kalevi", display_name="Updated", id=999)

        updated = models.get_person("kalevi")
        assert updated["display_name"] == "Updated"
        assert updated["id"] == original_id
        assert updated["id"] != 999
        # slug is untouched -> the person is still reachable under its real slug
        # and no row exists under a spoofed slug.
        assert models.get_person("kalevi")["slug"] == "kalevi"
        assert models.get_person("hacked") is None


def test_update_person_noop_when_all_filtered(app):
    with app.app_context():
        before = models.get_person("kalevi")
        models.update_person("kalevi", id=12345)  # only non-editable -> filtered empty -> noop
        after = models.get_person("kalevi")
        assert after == before


# --- update_event ---------------------------------------------------------

def test_update_event_ignores_non_editable_fields(app):
    # As with update_person, `slug` is positional and unspoofable; `id` is the
    # non-editable key that reaches **fields and must be filtered out.
    with app.app_context():
        models.update_event("party", name="Renamed", id=42)
        renamed = models.get_event("party")
        assert renamed["name"] == "Renamed"
        assert renamed["id"] != 42
        assert models.get_event("party")["slug"] == "party"
        assert models.get_event("hacked") is None


# --- delete ---------------------------------------------------------------

def test_delete_person(app):
    with app.app_context():
        pid = models.get_person("aino")["id"]
        models.delete_person(pid)
        assert models.get_person("aino") is None


def test_delete_event(app):
    with app.app_context():
        eid = models.get_event("party")["id"]
        models.delete_event(eid)
        assert models.get_event("party") is None


# --- listing / counting shapes -------------------------------------------

def test_list_people_shape(app):
    with app.app_context():
        people = models.list_people()
    assert isinstance(people, list)
    required = {"id", "slug", "display_name", "bio", "profile_image"}
    for p in people:
        assert isinstance(p, dict)
        assert required.issubset(p.keys())
    slugs = {p["slug"] for p in people}
    assert {"kalevi", "aino", "events"}.issubset(slugs)


def test_photo_count_and_list_shape(app):
    with app.app_context():
        kalevi_id = models.get_person("kalevi")["id"]
        assert models.count_photos(kalevi_id) == 1
        photos = models.list_photos(kalevi_id)
        required = {"id", "filename", "caption", "uploaded_at"}
        assert required.issubset(photos[0].keys())
        assert photos[0]["filename"] == "p-aaaa.jpg"


def test_list_events_cover_filename(app):
    with app.app_context():
        events = models.list_events()
    party = next(e for e in events if e["slug"] == "party")
    assert "cover_filename" in party
    assert party["cover_filename"] == "e-bbbb.jpg"


def test_count_event_photos(app):
    with app.app_context():
        party_id = models.get_event("party")["id"]
        assert models.count_event_photos(party_id) == 1
