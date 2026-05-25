from functools import wraps

from flask import Blueprint, current_app, flash, redirect, render_template, request, session, url_for
from flask_babel import gettext

bp = Blueprint("auth", __name__)


def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if not session.get("authed"):
            return redirect(url_for("auth.login", next=request.path))
        return view(*args, **kwargs)

    return wrapped


@bp.route("/login", methods=("GET", "POST"))
def login():
    if request.method == "POST":
        if request.form.get("password") == current_app.config["UPLOAD_PASSWORD"]:
            session["authed"] = True
            return redirect(request.args.get("next") or url_for("views.index"))
        flash(gettext("Wrong password."))
    return render_template("login.html")


@bp.route("/logout", methods=("POST",))
def logout():
    session.pop("authed", None)
    return redirect(url_for("views.index"))
