from flask import Blueprint, abort, flash, redirect, render_template, request, url_for
from flask_babel import gettext, ngettext

from . import models
from .admin_logic import (
    ALLOWED_EXTENSIONS,
    UNCHANGED,
    _int_or_none,
    _save_uploaded_photos,
    _slugify,
    _str_or_none,
    _unique_slug,
    resolve_profile_image,
)
from .auth import login_required
from .storage import get_storage

bp = Blueprint("admin", __name__, url_prefix="/admin")


@bp.route("/")
@login_required
def index():
    people = models.list_people()
    for p in people:
        p["photo_count"] = models.count_photos(p["id"])
    events = models.list_events()
    for e in events:
        e["photo_count"] = models.count_event_photos(e["id"])
    return render_template("admin.html", people=people, events=events)


@bp.route("/people", methods=("POST",))
@login_required
def create():
    display_name = (request.form.get("display_name") or "").strip()
    if not display_name:
        flash(gettext("Name is required."))
        return redirect(url_for("admin.index"))

    base = _slugify(request.form.get("slug") or display_name)
    if not base:
        flash(gettext("Enter a valid slug (letters and numbers only)."))
        return redirect(url_for("admin.index"))

    slug = _unique_slug(base, models.get_person)
    models.create_person(slug, display_name)
    flash(gettext('Person "%(name)s" added. Fill in the details and add photos.', name=display_name))
    return redirect(url_for("admin.edit", slug=slug))


@bp.route("/people/<slug>/delete", methods=("POST",))
@login_required
def delete(slug: str):
    p = models.get_person(slug)
    if not p:
        abort(404)
    models.delete_person(p["id"])
    get_storage().delete_person_all(slug)
    flash(gettext('Person "%(name)s" and all photos deleted.', name=p["display_name"]))
    return redirect(url_for("admin.index"))


@bp.route("/events", methods=("POST",))
@login_required
def create_event():
    name = (request.form.get("display_name") or "").strip()
    if not name:
        flash(gettext("Name is required."))
        return redirect(url_for("admin.index"))

    base = _slugify(request.form.get("slug") or name)
    if not base:
        flash(gettext("Enter a valid slug (letters and numbers only)."))
        return redirect(url_for("admin.index"))

    slug = _unique_slug(base, models.get_event)
    models.create_event(slug, name)
    flash(gettext('Event "%(name)s" added. Fill in the details and add photos.', name=name))
    return redirect(url_for("admin.event_edit", slug=slug))


@bp.route("/events/<slug>/delete", methods=("POST",))
@login_required
def delete_event(slug: str):
    e = models.get_event(slug)
    if not e:
        abort(404)
    models.delete_event(e["id"])
    get_storage().delete_event_all(slug)
    flash(gettext('Event "%(name)s" and all photos deleted.', name=e["name"]))
    return redirect(url_for("admin.index"))


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

        result = resolve_profile_image(
            storage, slug, p["profile_image"], profile_file, remove_profile
        )
        if result is not UNCHANGED:
            update_kwargs["profile_image"] = result

        models.update_person(slug, **update_kwargs)
        flash(gettext("Details updated."))
        return redirect("/" + slug)

    return render_template("edit_person.html", person=p)


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
        return redirect("/" + slug)

    return render_template("upload.html", person=p)


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
        return redirect("/events/" + slug)

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
        return redirect("/events/" + slug)

    return render_template("event_upload.html", event=e)
