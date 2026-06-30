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


def attach_cover_url(event: dict) -> dict:
    fn = event.get("cover_filename")
    event["cover_url"] = (
        get_storage().event_photo_url(event["slug"], fn) if fn else None
    )
    return event


def attach_photo_urls(slug: str, photos: list[dict], *, event: bool = False) -> list[dict]:
    storage = get_storage()
    photo_url = storage.event_photo_url if event else storage.person_photo_url
    for ph in photos:
        ph["url"] = photo_url(slug, ph["filename"])
    return photos
