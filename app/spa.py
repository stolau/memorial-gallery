from pathlib import Path

from flask import Blueprint, current_app, redirect, send_from_directory

bp = Blueprint("spa", __name__)


def _dist() -> Path:
    return Path(current_app.config["SPA_DIST"])


def _serve_index():
    dist = _dist()
    if not (dist / "index.html").is_file():
        return ("SPA not built — run `npm run build` in frontend/", 503)
    return send_from_directory(dist, "index.html")


@bp.route("/")
def index():
    return _serve_index()


@bp.route("/assets/<path:filename>")
def assets(filename: str):
    return send_from_directory(_dist() / "assets", filename)


@bp.route("/favicon.svg")
def favicon():
    return send_from_directory(_dist(), "favicon.svg")


@bp.route("/icons.svg")
def icons():
    return send_from_directory(_dist(), "icons.svg")


@bp.route("/event/<slug>")
def event_redirect(slug: str):
    return redirect("/events/" + slug, code=301)


@bp.route("/<path:path>")
def catch_all(path: str):
    return _serve_index()
