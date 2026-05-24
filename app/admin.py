import re
import shutil
import unicodedata
from pathlib import Path

from flask import Blueprint, abort, current_app, flash, redirect, render_template, request, url_for

from . import models
from .auth import login_required

bp = Blueprint("admin", __name__, url_prefix="/admin")


def _slugify(value: str) -> str:
    value = value.lower().strip()
    for a, b in (("ä", "a"), ("ö", "o"), ("å", "a")):
        value = value.replace(a, b)
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-")


def _unique_slug(base: str) -> str:
    slug = base
    n = 2
    while models.get_person(slug):
        slug = f"{base}-{n}"
        n += 1
    return slug


@bp.route("/")
@login_required
def index():
    people = models.list_people()
    for p in people:
        p["photo_count"] = models.count_photos(p["id"])
    return render_template("admin.html", people=people)


@bp.route("/people", methods=("POST",))
@login_required
def create():
    display_name = (request.form.get("display_name") or "").strip()
    if not display_name:
        flash("Nimi on pakollinen.")
        return redirect(url_for("admin.index"))

    base = _slugify(request.form.get("slug") or display_name)
    if not base:
        flash("Anna kelvollinen tunnus (vain kirjaimia ja numeroita).")
        return redirect(url_for("admin.index"))

    slug = _unique_slug(base)
    models.create_person(slug, display_name)
    flash(f'Henkilö "{display_name}" lisätty. Täydennä tiedot ja lisää kuvia.')
    return redirect(url_for("views.edit", slug=slug))


@bp.route("/people/<slug>/delete", methods=("POST",))
@login_required
def delete(slug: str):
    p = models.get_person(slug)
    if not p:
        abort(404)
    models.delete_person(p["id"])
    media_dir = Path(current_app.config["MEDIA_ROOT"]) / slug
    if media_dir.exists():
        shutil.rmtree(media_dir, ignore_errors=True)
    flash(f'Henkilö "{p["display_name"]}" ja kaikki kuvat poistettu.')
    return redirect(url_for("admin.index"))
