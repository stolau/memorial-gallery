"""Proof of the in-handler ``abort(404)`` branches for unknown slugs.

These are genuine handler branches, not Werkzeug "no matching route" 404s:

  * ``views.person``  -- ``@bp.route("/<slug>")`` is a catch-all, so an unknown
    person slug like ``/ghost-person`` DOES match the route and reaches
    ``models.get_person(...) -> None -> abort(404)`` (app/views.py).
  * ``views.event``   -- ``/event/<slug>`` reaches ``abort(404)`` for an unknown
    event slug (app/views.py).
  * ``api.person``    -- ``/api/people/<slug>`` -> ``abort(404)`` (app/api.py).
  * ``api.event``     -- ``/api/events/<slug>`` -> ``abort(404)`` (app/api.py).

The slugs used here (``ghost-person``, ``no-such-event``) are deliberately NOT
among the seeded slugs (persons kalevi/aino/events, event party) so each request
exercises the real "not found" path. Everything drives the REAL app/client
fixtures from conftest.py against the REAL model seeding; nothing is mocked.
"""

from __future__ import annotations


def test_unknown_slugs_return_404(client):
    assert client.get("/ghost-person").status_code == 404, (
        "views.person (/<slug> catch-all) should abort(404) for an unknown person slug"
    )
    assert client.get("/event/no-such-event").status_code == 404, (
        "views.event (/event/<slug>) should abort(404) for an unknown event slug"
    )
    assert client.get("/api/people/ghost-person").status_code == 404, (
        "api.person (/api/people/<slug>) should abort(404) for an unknown person slug"
    )
    assert client.get("/api/events/no-such-event").status_code == 404, (
        "api.event (/api/events/<slug>) should abort(404) for an unknown event slug"
    )
