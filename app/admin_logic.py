"""Pure, return-based admin helpers shared by the Jinja admin and the JSON API.

No Flask flash / request coupling here: callers pass plain values and decide how
to surface results. The Jinja admin (app/admin.py) re-exports these names.
"""

import re
import secrets
import unicodedata
from pathlib import Path

from werkzeug.datastructures import FileStorage
from werkzeug.utils import secure_filename

from .images import cap

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}


def _capped(f, max_px):
    bio = cap(f, max_px=max_px)
    return FileStorage(stream=bio, filename=f.filename, content_type=getattr(f, "mimetype", None))


def _slugify(value: str) -> str:
    value = value.lower().strip()
    for a, b in (("ä", "a"), ("ö", "o"), ("å", "a")):
        value = value.replace(a, b)
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-")


def _unique_slug(base: str, exists) -> str:
    slug = base
    n = 2
    while exists(slug):
        slug = f"{base}-{n}"
        n += 1
    return slug


def _int_or_none(raw: str | None) -> int | None:
    raw = (raw or "").strip()
    if not raw:
        return None
    try:
        return int(raw)
    except ValueError:
        return None


def _str_or_none(raw: str | None) -> str | None:
    raw = (raw or "").strip()
    return raw or None


def _save_uploaded_photos(files, save_fn, caption: str | None, register, max_px=2000) -> tuple[int, int]:
    """Save valid image uploads via save_fn(filename, file_obj); call register(filename) for each."""
    saved = 0
    skipped = 0
    for f in files:
        if not f or not f.filename:
            continue
        ext = Path(f.filename).suffix.lower()
        if ext not in ALLOWED_EXTENSIONS:
            skipped += 1
            continue
        safe_base = secure_filename(Path(f.filename).stem) or "photo"
        final_name = f"{safe_base}-{secrets.token_hex(4)}{ext}"
        save_fn(final_name, _capped(f, max_px))
        register(final_name)
        saved += 1
    return saved, skipped


UNCHANGED = object()  # sentinel: "leave profile_image as-is"


def resolve_profile_image(storage, slug, current_key, file, remove, max_px=2000):
    """Resolve a profile-image change request.

    Returns the new key (str) to set, None to clear, or UNCHANGED to leave as-is.
    Mirrors the inline edit block in app/admin.py exactly:
      - valid-ext file -> save new profile/<base>-<token>.<ext>, delete current_key
        if set, return the new key;
      - invalid-ext file -> UNCHANGED;
      - remove=True AND current_key -> delete current_key, return None;
      - otherwise -> UNCHANGED.
    """
    if file and file.filename:
        ext = Path(file.filename).suffix.lower()
        if ext in ALLOWED_EXTENSIONS:
            safe_base = secure_filename(Path(file.filename).stem) or "profile"
            final_name = f"{safe_base}-{secrets.token_hex(4)}{ext}"
            new_key = f"profile/{final_name}"
            storage.save_person_photo(slug, new_key, _capped(file, max_px))
            if current_key:
                storage.delete_person_file(slug, current_key)
            return new_key
    elif remove and current_key:
        storage.delete_person_file(slug, current_key)
        return None
    return UNCHANGED
