import os
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, current_app, flash, jsonify, redirect, request, session, url_for
from flask_babel import Babel, get_locale, gettext
from werkzeug.exceptions import RequestEntityTooLarge

from . import db

LANGUAGES = ("fi", "en")

babel = Babel()


def _select_locale() -> str:
    lang = session.get("lang")
    if lang in current_app.config["LANGUAGES"]:
        return lang
    return current_app.config["DEFAULT_LANG"]


def create_app() -> Flask:
    load_dotenv()

    app = Flask(__name__, instance_relative_config=True)

    default_lang = os.environ.get("DEFAULT_LANG", "fi").lower()
    if default_lang not in LANGUAGES:
        default_lang = "fi"

    max_upload_mb = int(os.environ.get("MAX_UPLOAD_MB", "100"))
    app.config.update(
        SECRET_KEY=os.environ.get("SECRET_KEY", "dev-only-change-me"),
        APP_MODE=os.environ.get("APP_MODE", "fullstack").lower(),
        UPLOAD_PASSWORD=os.environ.get("UPLOAD_PASSWORD", "changeme"),
        DATABASE=str(Path(app.instance_path) / "gallery.db"),
        MEDIA_ROOT=str(Path(app.root_path).parent / "media"),
        MAX_UPLOAD_MB=max_upload_mb,
        MAX_CONTENT_LENGTH=max_upload_mb * 1024 * 1024,
        LANGUAGES=LANGUAGES,
        DEFAULT_LANG=default_lang,
        BABEL_DEFAULT_LOCALE=default_lang,
    )

    Path(app.instance_path).mkdir(parents=True, exist_ok=True)
    Path(app.config["MEDIA_ROOT"]).mkdir(parents=True, exist_ok=True)

    babel.init_app(app, locale_selector=_select_locale)

    @app.context_processor
    def _inject_i18n():
        loc = get_locale()
        return {
            "current_lang": str(loc) if loc else app.config["DEFAULT_LANG"],
            "languages": app.config["LANGUAGES"],
        }

    @app.errorhandler(RequestEntityTooLarge)
    def too_large(_e):
        limit = app.config["MAX_UPLOAD_MB"]
        if app.config["APP_MODE"] == "api":
            return jsonify(error=gettext("Upload too large (limit %(limit)s MB).", limit=limit)), 413
        flash(gettext(
            "The upload is too large (limit %(limit)s MB). Choose fewer or smaller photos.",
            limit=limit,
        ))
        return redirect(request.referrer or url_for("views.index")), 303

    db.init_app(app)

    if app.config["APP_MODE"] == "api":
        from . import api

        app.register_blueprint(api.bp)
    else:
        from . import admin, auth, views

        app.register_blueprint(views.bp)
        app.register_blueprint(auth.bp)
        app.register_blueprint(admin.bp)

    return app
