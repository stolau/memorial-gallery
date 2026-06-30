import secrets
from pathlib import Path

from flask import Blueprint, abort, current_app, flash, redirect, request, render_template, session, url_for
from flask_babel import gettext, ngettext
from werkzeug.utils import secure_filename

from . import models
from .auth import login_required
from .storage import get_storage

bp = Blueprint("views", __name__)

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}


@bp.route("/lang/<code>")
def set_language(code: str):
    if code in current_app.config["LANGUAGES"]:
        session["lang"] = code
    return redirect(request.referrer or url_for("views.index"))


@bp.route("/")
def index():
    return render_template(
        "index.html", people=models.list_people(), events=models.list_events()
    )


@bp.route("/<slug>")
def person(slug: str):
    p = models.get_person(slug)
    if not p:
        abort(404)
    photos = models.list_photos(p["id"])
    storage = get_storage()
    photos_json = [
        {
            "url": storage.person_photo_url(slug, ph["filename"]),
            "caption": ph["caption"] or "",
        }
        for ph in photos
    ]
    show_info = request.args.get("showinfo", "").lower() in ("1", "true", "yes")
    return render_template(
        "person.html", person=p, photos=photos, photos_json=photos_json, show_info=show_info
    )


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


@bp.route("/<slug>/edit", methods=("GET", "POST"))
@login_required
def edit(slug: str):
    p = models.get_person(slug)
    if not p:
        abort(404)

    if request.method == "POST":
        display_name = (request.form.get("display_name") or "").strip() or p["display_name"]
        update_kwargs = dict(
            display_name=display_name,
            bio=_str_or_none(request.form.get("bio")),
            birth_year=_int_or_none(request.form.get("birth_year")),
            death_year=_int_or_none(request.form.get("death_year")),
            birthplace=_str_or_none(request.form.get("birthplace")),
            profession=_str_or_none(request.form.get("profession")),
        )

        storage = get_storage()
        profile_file = request.files.get("profile_image")
        remove_profile = request.form.get("remove_profile_image") == "on"

        if profile_file and profile_file.filename:
            ext = Path(profile_file.filename).suffix.lower()
            if ext in ALLOWED_EXTENSIONS:
                safe_base = secure_filename(Path(profile_file.filename).stem) or "profile"
                final_name = f"{safe_base}-{secrets.token_hex(4)}{ext}"
                new_key = f"profile/{final_name}"
                storage.save_person_photo(slug, new_key, profile_file)
                if p["profile_image"]:
                    storage.delete_person_file(slug, p["profile_image"])
                update_kwargs["profile_image"] = new_key
        elif remove_profile and p["profile_image"]:
            storage.delete_person_file(slug, p["profile_image"])
            update_kwargs["profile_image"] = None

        models.update_person(slug, **update_kwargs)
        flash(gettext("Details updated."))
        return redirect(url_for("views.person", slug=slug))

    return render_template("edit_person.html", person=p)


def _save_uploaded_photos(files, save_fn, caption: str | None, register) -> tuple[int, int]:
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
        save_fn(final_name, f)
        register(final_name)
        saved += 1
    return saved, skipped


def _flash_upload_result(saved: int, skipped: int) -> None:
    if saved:
        flash(ngettext("Uploaded %(num)d photo.", "Uploaded %(num)d photos.", saved))
    if skipped:
        flash(gettext(
            "Skipped %(num)d file(s) in an unsupported format (supported: JPG, PNG, GIF, WEBP).",
            num=skipped,
        ))
    if not saved and not skipped:
        flash(gettext("No photos selected."))


@bp.route("/<slug>/upload", methods=("GET", "POST"))
@login_required
def upload(slug: str):
    p = models.get_person(slug)
    if not p:
        abort(404)

    if request.method == "POST":
        storage = get_storage()
        caption = request.form.get("caption") or None
        saved, skipped = _save_uploaded_photos(
            request.files.getlist("photos"),
            lambda name, fobj: storage.save_person_photo(slug, name, fobj),
            caption,
            lambda name: models.add_photo(p["id"], name, caption),
        )
        _flash_upload_result(saved, skipped)
        return redirect(url_for("views.person", slug=slug))

    return render_template("upload.html", person=p)


# --- Events ---------------------------------------------------------------


@bp.route("/event/<slug>")
def event(slug: str):
    e = models.get_event(slug)
    if not e:
        abort(404)
    photos = models.list_event_photos(e["id"])
    storage = get_storage()
    photos_json = [
        {
            "url": storage.event_photo_url(slug, ph["filename"]),
            "caption": ph["caption"] or "",
        }
        for ph in photos
    ]
    return render_template("event.html", event=e, photos=photos, photos_json=photos_json)


@bp.route("/event/<slug>/edit", methods=("GET", "POST"))
@login_required
def event_edit(slug: str):
    e = models.get_event(slug)
    if not e:
        abort(404)

    if request.method == "POST":
        name = (request.form.get("name") or "").strip() or e["name"]
        models.update_event(
            slug,
            name=name,
            description=_str_or_none(request.form.get("description")),
            event_time=_str_or_none(request.form.get("event_time")),
            place=_str_or_none(request.form.get("place")),
        )
        flash(gettext("Details updated."))
        return redirect(url_for("views.event", slug=slug))

    return render_template("event_edit.html", event=e)


@bp.route("/event/<slug>/upload", methods=("GET", "POST"))
@login_required
def event_upload(slug: str):
    e = models.get_event(slug)
    if not e:
        abort(404)

    if request.method == "POST":
        storage = get_storage()
        caption = request.form.get("caption") or None
        saved, skipped = _save_uploaded_photos(
            request.files.getlist("photos"),
            lambda name, fobj: storage.save_event_photo(slug, name, fobj),
            caption,
            lambda name: models.add_event_photo(e["id"], name, caption),
        )
        _flash_upload_result(saved, skipped)
        return redirect(url_for("views.event", slug=slug))

    return render_template("event_upload.html", event=e)
