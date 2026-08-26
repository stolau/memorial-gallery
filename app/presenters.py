"""Presenters: enrich model rows with storage-derived media URLs for the API.

Plain functions over get_storage(); each mutates and returns the row in-place,
matching the style of app/api.py.
"""

from __future__ import annotations

from .storage import get_storage


def attach_profile_url(person: dict) -> dict:
    key = person.get("profile_image")
    person["profile_image_url"] = (
        get_storage().person_photo_url(person["slug"], key) if key else None
    )
    return person


def attach_cover_url(row: dict, *, prefix: str = "events") -> dict:
    fn = row.get("cover_filename")
    row["cover_url"] = (
        get_storage().photo_url(prefix, row["slug"], fn) if fn else None
    )
    return row


def attach_photo_urls(slug: str, photos: list[dict], *, prefix: str = "") -> list[dict]:
    storage = get_storage()
    for ph in photos:
        ph["url"] = storage.photo_url(prefix, slug, ph["filename"])
    return photos
