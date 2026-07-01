from flask import Blueprint, current_app, jsonify, request, session
from flask_babel import gettext

from . import models
from .admin_logic import (
    UNCHANGED,
    _int_or_none,
    _save_uploaded_photos,
    _slugify,
    _str_or_none,
    _unique_slug,
    resolve_profile_image,
)
from .auth import _is_authed, api_login_required
from .presenters import attach_cover_url, attach_profile_url
from .storage import get_storage

bp = Blueprint("admin_api", __name__, url_prefix="/api")


@bp.route("/login", methods=("POST",))
def login():
    if not request.is_json:
        return jsonify(error=gettext("JSON request expected.")), 415
    data = request.get_json(silent=True) or {}
    if data.get("password") == current_app.config["UPLOAD_PASSWORD"]:
        session["authed"] = True
        return jsonify(authed=True), 200
    return jsonify(error=gettext("Wrong password.")), 401


@bp.route("/logout", methods=("POST",))
def logout():
    session.pop("authed", None)
    return jsonify(authed=False), 200


@bp.route("/me")
def me():
    return jsonify(authed=_is_authed()), 200


# --- Field coercion -------------------------------------------------------


def _person_fields(data: dict) -> dict:
    fields: dict = {}
    for key in ("display_name", "bio", "birthplace", "profession"):
        if key in data:
            fields[key] = _str_or_none(data.get(key))
    for key in ("birth_year", "death_year"):
        if key in data:
            fields[key] = _int_or_none(str(data[key]))
    return fields


def _event_fields(data: dict) -> dict:
    fields: dict = {}
    for key in ("name", "description", "event_time", "place"):
        if key in data:
            fields[key] = _str_or_none(data.get(key))
    return fields


# --- People ---------------------------------------------------------------


@bp.route("/people", methods=("POST",))
@api_login_required
def create_person():
    data = request.get_json(silent=True) or {}
    display_name = _str_or_none(data.get("display_name"))
    if not display_name:
        return jsonify(error=gettext("Name is required.")), 400
    base = _slugify(data.get("slug") or display_name)
    if not base:
        return jsonify(error=gettext("Enter a valid slug (letters and numbers only).")), 400
    slug = _unique_slug(base, models.get_person)
    fields = _person_fields(data)
    fields.pop("display_name", None)
    models.create_person(slug, display_name, **fields)
    return jsonify(attach_profile_url(models.get_person(slug))), 201


@bp.route("/people/<slug>", methods=("PUT",))
@api_login_required
def update_person(slug: str):
    if not models.get_person(slug):
        return jsonify(error=gettext("Not found.")), 404
    data = request.get_json(silent=True) or {}
    models.update_person(slug, **_person_fields(data))
    return jsonify(attach_profile_url(models.get_person(slug))), 200


@bp.route("/people/<slug>", methods=("DELETE",))
@api_login_required
def delete_person(slug: str):
    p = models.get_person(slug)
    if not p:
        return jsonify(error=gettext("Not found.")), 404
    models.delete_person(p["id"])
    get_storage().delete_person_all(slug)
    return jsonify(deleted=True), 200


# --- Events ---------------------------------------------------------------


@bp.route("/events", methods=("POST",))
@api_login_required
def create_event():
    data = request.get_json(silent=True) or {}
    name = _str_or_none(data.get("name"))
    if not name:
        return jsonify(error=gettext("Name is required.")), 400
    base = _slugify(data.get("slug") or name)
    if not base:
        return jsonify(error=gettext("Enter a valid slug (letters and numbers only).")), 400
    slug = _unique_slug(base, models.get_event)
    fields = _event_fields(data)
    fields.pop("name", None)
    models.create_event(slug, name, **fields)
    return jsonify(attach_cover_url(models.get_event(slug))), 201


@bp.route("/events/<slug>", methods=("PUT",))
@api_login_required
def update_event(slug: str):
    if not models.get_event(slug):
        return jsonify(error=gettext("Not found.")), 404
    data = request.get_json(silent=True) or {}
    models.update_event(slug, **_event_fields(data))
    return jsonify(attach_cover_url(models.get_event(slug))), 200


@bp.route("/events/<slug>", methods=("DELETE",))
@api_login_required
def delete_event(slug: str):
    e = models.get_event(slug)
    if not e:
        return jsonify(error=gettext("Not found.")), 404
    models.delete_event(e["id"])
    get_storage().delete_event_all(slug)
    return jsonify(deleted=True), 200


# --- Photo uploads --------------------------------------------------------


@bp.route("/people/<slug>/photos", methods=("POST",))
@api_login_required
def upload_person_photos(slug: str):
    p = models.get_person(slug)
    if not p:
        return jsonify(error=gettext("Not found.")), 404
    storage = get_storage()
    caption = request.form.get("caption") or None
    saved, skipped = _save_uploaded_photos(
        request.files.getlist("photos"),
        lambda name, fobj: storage.save_person_photo(slug, name, fobj),
        caption,
        lambda name: models.add_photo(p["id"], name, caption),
    )
    return jsonify(saved=saved, skipped=skipped), 200


@bp.route("/events/<slug>/photos", methods=("POST",))
@api_login_required
def upload_event_photos(slug: str):
    e = models.get_event(slug)
    if not e:
        return jsonify(error=gettext("Not found.")), 404
    storage = get_storage()
    caption = request.form.get("caption") or None
    saved, skipped = _save_uploaded_photos(
        request.files.getlist("photos"),
        lambda name, fobj: storage.save_event_photo(slug, name, fobj),
        caption,
        lambda name: models.add_event_photo(e["id"], name, caption),
    )
    return jsonify(saved=saved, skipped=skipped), 200


@bp.route("/people/<slug>/profile-image", methods=("PUT",))
@api_login_required
def set_person_profile_image(slug: str):
    p = models.get_person(slug)
    if not p:
        return jsonify(error=gettext("Not found.")), 404
    storage = get_storage()
    file = request.files.get("profile_image")
    remove = request.form.get("remove") == "true"
    result = resolve_profile_image(storage, slug, p["profile_image"], file, remove)
    if result is not UNCHANGED:
        models.update_person(slug, profile_image=result)
    return jsonify(attach_profile_url(models.get_person(slug))), 200


@bp.route("/people/<slug>/photos/<int:photo_id>", methods=("DELETE",))
@api_login_required
def delete_person_photo(slug: str, photo_id: int):
    filename = models.delete_photo(photo_id, slug)
    if filename is None:
        return jsonify(error=gettext("Not found.")), 404
    get_storage().delete_person_file(slug, filename)
    return jsonify(deleted=True), 200


@bp.route("/events/<slug>/photos/<int:photo_id>", methods=("DELETE",))
@api_login_required
def delete_event_photo(slug: str, photo_id: int):
    filename = models.delete_event_photo(photo_id, slug)
    if filename is None:
        return jsonify(error=gettext("Not found.")), 404
    get_storage().delete_event_file(slug, filename)
    return jsonify(deleted=True), 200
