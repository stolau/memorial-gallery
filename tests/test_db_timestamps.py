"""Proofs that reading sqlite TIMESTAMP columns is warning-clean and still
returns real ``datetime`` objects.

Python 3.12 deprecated sqlite3's default timestamp converter. When the DB layer
registers an explicit ``timestamp`` converter, reading ``uploaded_at`` must (a)
emit no ``DeprecationWarning`` and (b) keep round-tripping the column as a
``datetime.datetime`` (behavior preserved, not silently downgraded to a str).

These run against the REAL app fixture and REAL seeded DB (person 'kalevi' with
photo 'p-aaaa.jpg', event 'party' with photo 'e-bbbb.jpg'); nothing is mocked.
"""

from __future__ import annotations

import datetime
import warnings

from app import models


def test_timestamp_read_emits_no_deprecation_warning(app):
    # Resolve the seeded person id exactly as test_photo_count_and_list_shape.
    with app.app_context():
        kalevi_id = models.get_person("kalevi")["id"]
        party_id = models.get_event("party")["id"]

        # Any DeprecationWarning raised while reading the TIMESTAMP column is
        # promoted to an exception, so a clean return is the proof. On current
        # main the default converter trips this filter and the test FAILS; once
        # an explicit `timestamp` converter is registered it PASSES.
        with warnings.catch_warnings():
            warnings.simplefilter("error", DeprecationWarning)
            photos = models.list_photos(kalevi_id)
            event_photos = models.list_event_photos(party_id)

    assert isinstance(photos, list)
    assert len(photos) > 0
    assert isinstance(event_photos, list)
    assert len(event_photos) > 0


def test_uploaded_at_round_trips_as_datetime(app):
    with app.app_context():
        kalevi_id = models.get_person("kalevi")["id"]
        photos = models.list_photos(kalevi_id)

    assert len(photos) > 0
    assert isinstance(photos[0]["uploaded_at"], datetime.datetime)
