from flask import Blueprint, current_app, redirect, request, session

bp = Blueprint("views", __name__)


@bp.route("/lang/<code>")
def set_language(code: str):
    if code in current_app.config["LANGUAGES"]:
        session["lang"] = code
    return redirect(request.referrer or "/")
