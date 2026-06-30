from flask import Blueprint, abort, current_app, redirect, request, render_template, session, url_for

from . import models
from .storage import get_storage

bp = Blueprint("views", __name__)


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
