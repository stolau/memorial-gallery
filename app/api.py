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
    folders = models.list_folders(p["id"])
    return jsonify({"person": p, "photos": photos, "folders": folders})


@bp.route("/events")
def events():
    return jsonify([attach_cover_url(e) for e in models.list_events()])


@bp.route("/events/<slug>")
def event(slug: str):
    e = models.get_event(slug)
    if not e:
        abort(404)
    photos = attach_photo_urls(slug, models.list_event_photos(e["id"]), prefix="events")
    return jsonify({"event": e, "photos": photos})


@bp.route("/collections")
def collections():
    return jsonify([
        attach_cover_url(c, prefix="collections") for c in models.list_collections()
    ])


@bp.route("/collections/<slug>")
def collection(slug: str):
    c = models.get_collection(slug)
    if not c:
        abort(404)
    attach_profile_url(c)
    photos = attach_photo_urls(
        slug, models.list_collection_photos(c["id"]), prefix="collections"
    )
    folders = models.list_collection_folders(c["id"])
    return jsonify({"collection": c, "photos": photos, "folders": folders})


@bp.route("/contact")
def contact():
    return jsonify(models.get_settings())
