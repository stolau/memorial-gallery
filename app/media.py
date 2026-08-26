from pathlib import Path

from flask import Blueprint, current_app, redirect, send_from_directory

from .storage import get_storage

bp = Blueprint("media", __name__)


@bp.route("/media/<slug>/<path:filename>")
def person(slug: str, filename: str):
    if current_app.config["STORAGE_BACKEND"] == "s3":
        return redirect(get_storage().person_photo_url(slug, filename), code=302)
    directory = Path(current_app.config["MEDIA_ROOT"]) / slug
    return send_from_directory(directory, filename)


@bp.route("/media/events/<slug>/<path:filename>")
def event(slug: str, filename: str):
    if current_app.config["STORAGE_BACKEND"] == "s3":
        return redirect(get_storage().event_photo_url(slug, filename), code=302)
    directory = Path(current_app.config["MEDIA_ROOT"]) / "events" / slug
    return send_from_directory(directory, filename)


@bp.route("/media/collections/<slug>/<path:filename>")
def collection(slug: str, filename: str):
    if current_app.config["STORAGE_BACKEND"] == "s3":
        return redirect(get_storage().photo_url("collections", slug, filename), code=302)
    directory = Path(current_app.config["MEDIA_ROOT"]) / "collections" / slug
    return send_from_directory(directory, filename)
