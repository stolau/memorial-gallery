from flask import Blueprint, abort, jsonify, url_for

from . import models

bp = Blueprint("api", __name__, url_prefix="/api")


@bp.route("/people")
def people():
    return jsonify(models.list_people())


@bp.route("/people/<slug>")
def person(slug: str):
    p = models.get_person(slug)
    if not p:
        abort(404)
    photos = models.list_photos(p["id"])
    for ph in photos:
        ph["url"] = url_for("views.media", slug=slug, filename=ph["filename"], _external=False)
    return jsonify({"person": p, "photos": photos})


@bp.route("/events")
def events():
    return jsonify(models.list_events())


@bp.route("/events/<slug>")
def event(slug: str):
    e = models.get_event(slug)
    if not e:
        abort(404)
    photos = models.list_event_photos(e["id"])
    for ph in photos:
        ph["url"] = url_for("views.event_media", slug=slug, filename=ph["filename"], _external=False)
    return jsonify({"event": e, "photos": photos})
