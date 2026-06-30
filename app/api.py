from flask import Blueprint, abort, jsonify

from . import models
from .storage import get_storage

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
        ph["url"] = get_storage().person_photo_url(slug, ph["filename"])
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
        ph["url"] = get_storage().event_photo_url(slug, ph["filename"])
    return jsonify({"event": e, "photos": photos})
