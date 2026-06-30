from functools import wraps

from flask import Blueprint, current_app, flash, jsonify, redirect, render_template, request, session, url_for
from flask_babel import gettext

bp = Blueprint("auth", __name__)


def _is_authed() -> bool:
    return bool(session.get("authed"))


def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if not _is_authed():
            return redirect(url_for("auth.login", next=request.path))
        return view(*args, **kwargs)

    return wrapped


def api_login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if not _is_authed():
            return jsonify(error=gettext("Authentication required.")), 401
        return view(*args, **kwargs)

    return wrapped


@bp.route("/login", methods=("GET", "POST"))
def login():
    if request.method == "POST":
        if request.form.get("password") == current_app.config["UPLOAD_PASSWORD"]:
            session["authed"] = True
            return redirect(request.args.get("next") or "/")
        flash(gettext("Wrong password."))
    return render_template("login.html")


@bp.route("/logout", methods=("POST",))
def logout():
    session.pop("authed", None)
    return redirect("/")
