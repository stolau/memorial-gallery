import re
import unicodedata

from flask import Blueprint, abort, flash, redirect, render_template, request, url_for
from flask_babel import gettext

from . import models
from .auth import login_required
from .storage import get_storage

bp = Blueprint("admin", __name__, url_prefix="/admin")


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
    return redirect(url_for("views.edit", slug=slug))


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
    return redirect(url_for("views.event_edit", slug=slug))


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
