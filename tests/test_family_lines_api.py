"""Real proofs for the family-lines JSON API (app/api.py + app/admin_api.py).

Family lines group existing PEOPLE (they are not galleries). Assertions read
REAL DB rows back through app.models inside an app context. Nothing is mocked.
Seeded people (tests/conftest.py::_seed): 'kalevi', 'aino', 'events'.
"""

from __future__ import annotations

from app import models


def _create(authed_client, **payload):
    return authed_client.post("/api/family-lines", json=payload)


# ==========================================================================
# PUBLIC LIST
# ==========================================================================


def test_family_lines_list_starts_empty(client):
    r = client.get("/api/family-lines")
    assert r.status_code == 200
    assert r.get_json() == []


def test_family_lines_public_shape_includes_members(app, authed_client, client):
    _create(authed_client, name="Kaijankosken suku", year_range="1850–", note="Päälinja")
    authed_client.post("/api/family-lines/kaijankosken-suku/members", json={"person_slug": "kalevi"})

    body = client.get("/api/family-lines").get_json()
    assert len(body) == 1
    line = body[0]
    assert line["slug"] == "kaijankosken-suku"
    assert line["name"] == "Kaijankosken suku"
    assert line["year_range"] == "1850–"
    assert line["note"] == "Päälinja"
    assert line["members"] == [{"slug": "kalevi", "display_name": "Kalevi"}]


# ==========================================================================
# CRUD
# ==========================================================================


def test_create_family_line_returns_created_slug(app, authed_client):
    r = _create(authed_client, name="Kaijankosken suku")
    assert r.status_code == 201
    body = r.get_json()
    assert body["slug"] == "kaijankosken-suku"
    assert body["members"] == []
    with app.app_context():
        assert models.get_family_line("kaijankosken-suku") is not None


def test_create_family_line_collision_auto_suffixes(app, authed_client):
    assert _create(authed_client, name="Branch").get_json()["slug"] == "branch"
    assert _create(authed_client, name="Branch").get_json()["slug"] == "branch-2"


def test_create_family_line_missing_name_is_400(app, authed_client):
    assert _create(authed_client, name="  ").status_code == 400


def test_update_family_line_applies_whitelist(app, authed_client):
    _create(authed_client, name="Suku")
    r = authed_client.put(
        "/api/family-lines/suku",
        json={"note": "Muistiinpano", "id": 42, "slug": "hacked"},
    )
    assert r.status_code == 200
    body = r.get_json()
    assert body["note"] == "Muistiinpano"
    assert body["slug"] == "suku"
    with app.app_context():
        assert models.get_family_line("hacked") is None
        assert models.get_family_line("suku")["note"] == "Muistiinpano"


def test_update_family_line_unknown_slug_is_404(app, authed_client):
    assert authed_client.put("/api/family-lines/nope", json={"note": "x"}).status_code == 404


def test_delete_family_line_removes_row(app, authed_client):
    _create(authed_client, name="Suku")
    r = authed_client.delete("/api/family-lines/suku")
    assert r.status_code == 200
    assert r.get_json() == {"deleted": True}
    with app.app_context():
        assert models.get_family_line("suku") is None


def test_delete_family_line_unknown_is_404(app, authed_client):
    assert authed_client.delete("/api/family-lines/nope").status_code == 404


# ==========================================================================
# MEMBERS
# ==========================================================================


def test_add_member_by_slug_and_by_id(app, authed_client):
    _create(authed_client, name="Suku")
    with app.app_context():
        aino_id = models.get_person("aino")["id"]

    by_slug = authed_client.post(
        "/api/family-lines/suku/members", json={"person_slug": "kalevi"}
    )
    assert by_slug.status_code == 200
    by_id = authed_client.post(
        "/api/family-lines/suku/members", json={"person_id": aino_id}
    )
    assert by_id.status_code == 200

    members = by_id.get_json()["members"]
    assert {m["slug"] for m in members} == {"kalevi", "aino"}


def test_add_member_unknown_person_is_404(app, authed_client):
    _create(authed_client, name="Suku")
    r = authed_client.post(
        "/api/family-lines/suku/members", json={"person_slug": "ghost"}
    )
    assert r.status_code == 404


def test_add_member_unknown_family_line_is_404(app, authed_client):
    r = authed_client.post(
        "/api/family-lines/nope/members", json={"person_slug": "kalevi"}
    )
    assert r.status_code == 404


def test_remove_member(app, authed_client):
    _create(authed_client, name="Suku")
    authed_client.post("/api/family-lines/suku/members", json={"person_slug": "kalevi"})
    with app.app_context():
        kalevi_id = models.get_person("kalevi")["id"]

    r = authed_client.delete(f"/api/family-lines/suku/members/{kalevi_id}")
    assert r.status_code == 200
    assert r.get_json()["members"] == []


def test_remove_member_not_in_line_is_404(app, authed_client):
    _create(authed_client, name="Suku")
    with app.app_context():
        kalevi_id = models.get_person("kalevi")["id"]
    assert authed_client.delete(
        f"/api/family-lines/suku/members/{kalevi_id}"
    ).status_code == 404


def test_reorder_members_persists_given_order(app, authed_client):
    _create(authed_client, name="Suku")
    with app.app_context():
        kalevi_id = models.get_person("kalevi")["id"]
        aino_id = models.get_person("aino")["id"]
    authed_client.post("/api/family-lines/suku/members", json={"person_slug": "kalevi"})
    authed_client.post("/api/family-lines/suku/members", json={"person_slug": "aino"})

    r = authed_client.put(
        "/api/family-lines/suku/members/order", json={"order": [aino_id, kalevi_id]}
    )
    assert r.status_code == 200
    assert [m["slug"] for m in r.get_json()["members"]] == ["aino", "kalevi"]


def test_reorder_members_rejects_non_permutation(app, authed_client):
    _create(authed_client, name="Suku")
    with app.app_context():
        kalevi_id = models.get_person("kalevi")["id"]
    authed_client.post("/api/family-lines/suku/members", json={"person_slug": "kalevi"})
    # Foreign / partial id sets are rejected.
    assert authed_client.put(
        "/api/family-lines/suku/members/order", json={"order": [kalevi_id, 999999]}
    ).status_code == 400
    assert authed_client.put(
        "/api/family-lines/suku/members/order", json={"order": "nope"}
    ).status_code == 400


def test_deleting_person_cascades_out_of_family_line(app, authed_client):
    _create(authed_client, name="Suku")
    authed_client.post("/api/family-lines/suku/members", json={"person_slug": "kalevi"})
    authed_client.delete("/api/people/kalevi")
    body = authed_client.get("/api/family-lines").get_json()
    assert body[0]["members"] == []


# ==========================================================================
# AUTH
# ==========================================================================


def test_family_line_writes_require_auth(app, client, authed_client):
    _create(authed_client, name="Suku")
    with app.app_context():
        kalevi_id = models.get_person("kalevi")["id"]
    assert client.post("/api/family-lines", json={"name": "X"}).status_code == 401
    assert client.put("/api/family-lines/suku", json={"note": "x"}).status_code == 401
    assert client.delete("/api/family-lines/suku").status_code == 401
    assert client.post(
        "/api/family-lines/suku/members", json={"person_slug": "kalevi"}
    ).status_code == 401
    assert client.delete(
        f"/api/family-lines/suku/members/{kalevi_id}"
    ).status_code == 401
    assert client.put(
        "/api/family-lines/suku/members/order", json={"order": [kalevi_id]}
    ).status_code == 401
    with app.app_context():
        assert models.get_family_line("suku") is not None
