from flask import Blueprint, current_app, jsonify, request, session
from flask_babel import gettext

from .auth import _is_authed, api_login_required

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


@bp.route("/admin/ping")
@api_login_required
def ping():
    return jsonify(ok=True), 200
