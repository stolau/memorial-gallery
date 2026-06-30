import os
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, current_app, flash, jsonify, redirect, request, session
from flask_babel import Babel, get_locale, gettext
from werkzeug.exceptions import RequestEntityTooLarge
from werkzeug.middleware.proxy_fix import ProxyFix

from . import db
from .storage import LocalStorage, S3Storage

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
        UPLOAD_PASSWORD=os.environ.get("UPLOAD_PASSWORD", "changeme"),
        DATABASE=str(Path(app.instance_path) / "gallery.db"),
        MEDIA_ROOT=str(Path(app.root_path).parent / "media"),
        SPA_DIST=os.environ.get("SPA_DIST") or str(Path(app.root_path).parent / "frontend" / "dist"),
        MAX_UPLOAD_MB=max_upload_mb,
        MAX_CONTENT_LENGTH=max_upload_mb * 1024 * 1024,
        LANGUAGES=LANGUAGES,
        DEFAULT_LANG=default_lang,
        BABEL_DEFAULT_LOCALE=default_lang,
        STORAGE_BACKEND=os.environ.get("STORAGE_BACKEND", "local").lower(),
        S3_ENDPOINT=os.environ.get("S3_ENDPOINT", ""),
        S3_BUCKET=os.environ.get("S3_BUCKET", ""),
        S3_ACCESS_KEY=os.environ.get("S3_ACCESS_KEY", ""),
        S3_SECRET_KEY=os.environ.get("S3_SECRET_KEY", ""),
        S3_PUBLIC_BASE=os.environ.get("S3_PUBLIC_BASE", ""),
        S3_REGION=os.environ.get("S3_REGION", ""),
        SESSION_COOKIE_SAMESITE="Lax",
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SECURE=os.environ.get("SESSION_COOKIE_SECURE", os.environ.get("BEHIND_PROXY", "")).lower() in ("1", "true", "yes"),
    )

    Path(app.instance_path).mkdir(parents=True, exist_ok=True)
    Path(app.config["MEDIA_ROOT"]).mkdir(parents=True, exist_ok=True)

    if app.config["STORAGE_BACKEND"] == "s3":
        required = ("S3_ENDPOINT", "S3_BUCKET", "S3_ACCESS_KEY", "S3_SECRET_KEY", "S3_PUBLIC_BASE")
        missing = [k for k in required if not app.config[k]]
        if missing:
            raise RuntimeError(
                "STORAGE_BACKEND=s3 requires these env vars: " + ", ".join(missing)
            )
        app.extensions["storage"] = S3Storage(
            endpoint=app.config["S3_ENDPOINT"],
            bucket=app.config["S3_BUCKET"],
            access_key=app.config["S3_ACCESS_KEY"],
            secret_key=app.config["S3_SECRET_KEY"],
            public_base=app.config["S3_PUBLIC_BASE"],
            region=app.config["S3_REGION"] or None,
        )
    else:
        app.extensions["storage"] = LocalStorage(app.config["MEDIA_ROOT"])

    # Behind a reverse proxy (e.g. Caddy/nginx) trust its forwarded headers so the
    # app sees the real https scheme and host. Enabled via BEHIND_PROXY in production.
    if os.environ.get("BEHIND_PROXY", "").lower() in ("1", "true", "yes"):
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)

    babel.init_app(app, locale_selector=_select_locale)

    @app.context_processor
    def _inject_i18n():
        loc = get_locale()
        return {
            "current_lang": str(loc) if loc else app.config["DEFAULT_LANG"],
            "languages": app.config["LANGUAGES"],
        }

    @app.context_processor
    def _inject_media_helpers():
        storage = app.extensions["storage"]
        return {
            "person_photo_url": storage.person_photo_url,
            "event_photo_url": storage.event_photo_url,
        }

    @app.errorhandler(RequestEntityTooLarge)
    def too_large(_e):
        limit = app.config["MAX_UPLOAD_MB"]
        if request.path.startswith("/api"):
            return jsonify(error=gettext("Upload too large (limit %(limit)s MB).", limit=limit)), 413
        flash(gettext(
            "The upload is too large (limit %(limit)s MB). Choose fewer or smaller photos.",
            limit=limit,
        ))
        return redirect(request.referrer or "/"), 303

    db.init_app(app)

    from . import admin, admin_api, api, auth, media, spa, views

    app.register_blueprint(views.bp)
    app.register_blueprint(auth.bp)
    app.register_blueprint(admin.bp)
    app.register_blueprint(api.bp)
    app.register_blueprint(admin_api.bp)
    app.register_blueprint(media.bp)
    app.register_blueprint(spa.bp)

    return app
