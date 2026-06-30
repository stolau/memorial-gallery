from flask import Blueprint, abort, jsonify

from . import models
from .presenters import attach_cover_url, attach_photo_urls, attach_profile_url

bp = Blueprint("api", __name__, url_prefix="/api")


@bp.route("/people")
def people():
    return jsonify([attach_profile_url(p) for p in models.list_people()])


@bp.route("/people/<slug>")
def person(slug: str):
    p = models.get_person(slug)
    if not p:
        abort(404)
    attach_profile_url(p)
    photos = attach_photo_urls(slug, models.list_photos(p["id"]))
    return jsonify({"person": p, "photos": photos})


@bp.route("/events")
def events():
    return jsonify([attach_cover_url(e) for e in models.list_events()])


@bp.route("/events/<slug>")
def event(slug: str):
    e = models.get_event(slug)
    if not e:
        abort(404)
    photos = attach_photo_urls(slug, models.list_event_photos(e["id"]), event=True)
    return jsonify({"event": e, "photos": photos})
