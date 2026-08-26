"""Real proofs for the multi-contact JSON API (app/api.py + app/admin_api.py).

Mirrors tests/test_collections_write_api.py: assertions read REAL DB rows back
through app.models inside an app context. Nothing is mocked. The contacts table
starts empty (no seed), so each test creates what it needs.
"""

from __future__ import annotations

from app import models


def _create(authed_client, **payload):
    return authed_client.post("/api/contacts", json=payload)


# ==========================================================================
# PUBLIC LIST
# ==========================================================================


def test_contacts_list_starts_empty(client):
    r = client.get("/api/contacts")
    assert r.status_code == 200
    assert r.get_json() == []


def test_contacts_list_is_ordered_by_position(app, authed_client):
    _create(authed_client, name="First")
    _create(authed_client, name="Second")
    body = authed_client.get("/api/contacts").get_json()
    assert [c["name"] for c in body] == ["First", "Second"]
    assert [c["position"] for c in body] == sorted(c["position"] for c in body)


# ==========================================================================
# CRUD
# ==========================================================================


def test_create_contact_persists_all_fields(app, authed_client):
    r = _create(
        authed_client,
        name="Anssi",
        role="Ylläpitäjä",
        phone="+358 40 123 4567",
        email="anssi@example.com",
    )
    assert r.status_code == 201
    body = r.get_json()
    assert body["name"] == "Anssi"
    assert body["role"] == "Ylläpitäjä"
    assert body["phone"] == "+358 40 123 4567"
    assert body["email"] == "anssi@example.com"
    with app.app_context():
        rows = models.list_contacts()
    assert len(rows) == 1
    assert rows[0]["email"] == "anssi@example.com"


def test_create_contact_missing_name_is_400(app, authed_client):
    assert _create(authed_client, name="  ").status_code == 400
    assert _create(authed_client, role="x").status_code == 400


def test_update_contact_changes_fields(app, authed_client):
    cid = _create(authed_client, name="Anssi").get_json()["id"]
    r = authed_client.put(
        f"/api/contacts/{cid}", json={"role": "Sukututkija", "phone": "12345"}
    )
    assert r.status_code == 200
    body = r.get_json()
    assert body["role"] == "Sukututkija"
    assert body["phone"] == "12345"
    assert body["name"] == "Anssi"  # untouched


def test_update_contact_blank_name_is_400(app, authed_client):
    cid = _create(authed_client, name="Anssi").get_json()["id"]
    r = authed_client.put(f"/api/contacts/{cid}", json={"name": "   "})
    assert r.status_code == 400
    with app.app_context():
        assert models.get_contact(cid)["name"] == "Anssi"


def test_update_contact_unknown_id_is_404(app, authed_client):
    assert authed_client.put("/api/contacts/999999", json={"role": "x"}).status_code == 404


def test_delete_contact_removes_row(app, authed_client):
    cid = _create(authed_client, name="Anssi").get_json()["id"]
    r = authed_client.delete(f"/api/contacts/{cid}")
    assert r.status_code == 200
    assert r.get_json() == {"deleted": True}
    with app.app_context():
        assert models.get_contact(cid) is None


def test_delete_contact_unknown_id_is_404(app, authed_client):
    assert authed_client.delete("/api/contacts/999999").status_code == 404


# ==========================================================================
# ORDERING
# ==========================================================================


def test_reorder_contacts_persists_given_order(app, authed_client):
    a = _create(authed_client, name="A").get_json()["id"]
    b = _create(authed_client, name="B").get_json()["id"]
    c = _create(authed_client, name="C").get_json()["id"]

    r = authed_client.put("/api/contacts/order", json={"order": [c, a, b]})
    assert r.status_code == 200
    assert r.get_json() == {"ok": True}

    names = [x["name"] for x in authed_client.get("/api/contacts").get_json()]
    assert names == ["C", "A", "B"]


def test_reorder_contacts_rejects_non_permutation(app, authed_client):
    a = _create(authed_client, name="A").get_json()["id"]
    _create(authed_client, name="B")
    # Missing one id -> not a permutation.
    assert authed_client.put(
        "/api/contacts/order", json={"order": [a]}
    ).status_code == 400
    # Malformed payloads.
    assert authed_client.put(
        "/api/contacts/order", json={"order": "nope"}
    ).status_code == 400
    assert authed_client.put("/api/contacts/order", json={}).status_code == 400


# ==========================================================================
# AUTH
# ==========================================================================


def test_contact_writes_require_auth(app, client, authed_client):
    cid = _create(authed_client, name="A").get_json()["id"]
    assert client.post("/api/contacts", json={"name": "X"}).status_code == 401
    assert client.put(f"/api/contacts/{cid}", json={"role": "x"}).status_code == 401
    assert client.delete(f"/api/contacts/{cid}").status_code == 401
    assert client.put("/api/contacts/order", json={"order": [cid]}).status_code == 401
    with app.app_context():
        assert models.get_contact(cid) is not None
