"""Proof of the in-handler ``abort(404)`` branches for unknown slugs in the API.

After the SPA migration the old Jinja views are gone: an unknown person slug like
``/ghost-person`` now resolves to the SPA index (200) and ``/event/<slug>`` is a
301 redirect, so neither is a 404 anymore. The genuine handler ``abort(404)``
branches that remain live on the API blueprint:

  * ``api.person``    -- ``/api/people/<slug>`` -> ``abort(404)`` (app/api.py).
  * ``api.event``     -- ``/api/events/<slug>`` -> ``abort(404)`` (app/api.py).

The slugs used here (``ghost-person``, ``no-such-event``) are deliberately NOT
among the seeded slugs (persons kalevi/aino/events, event party) so each request
exercises the real "not found" path. Everything drives the REAL app/client
fixtures from conftest.py against the REAL model seeding; nothing is mocked.
"""

from __future__ import annotations


def test_unknown_slugs_return_404(client):
    assert client.get("/api/people/ghost-person").status_code == 404, (
        "api.person (/api/people/<slug>) should abort(404) for an unknown person slug"
    )
    assert client.get("/api/events/no-such-event").status_code == 404, (
        "api.event (/api/events/<slug>) should abort(404) for an unknown event slug"
    )
