import os
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, flash, jsonify, redirect, request, url_for
from werkzeug.exceptions import RequestEntityTooLarge

from . import db


def create_app() -> Flask:
    load_dotenv()

    app = Flask(__name__, instance_relative_config=True)

    max_upload_mb = int(os.environ.get("MAX_UPLOAD_MB", "100"))
    app.config.update(
        SECRET_KEY=os.environ.get("SECRET_KEY", "dev-only-change-me"),
        APP_MODE=os.environ.get("APP_MODE", "fullstack").lower(),
        UPLOAD_PASSWORD=os.environ.get("UPLOAD_PASSWORD", "changeme"),
        DATABASE=str(Path(app.instance_path) / "gallery.db"),
        MEDIA_ROOT=str(Path(app.root_path).parent / "media"),
        MAX_UPLOAD_MB=max_upload_mb,
        MAX_CONTENT_LENGTH=max_upload_mb * 1024 * 1024,
    )

    Path(app.instance_path).mkdir(parents=True, exist_ok=True)
    Path(app.config["MEDIA_ROOT"]).mkdir(parents=True, exist_ok=True)

    @app.errorhandler(RequestEntityTooLarge)
    def too_large(_e):
        limit = app.config["MAX_UPLOAD_MB"]
        if app.config["APP_MODE"] == "api":
            return jsonify(error=f"Liian suuri lähetys (yläraja {limit} MB)."), 413
        flash(f"Lähetys on liian suuri (yläraja {limit} MB). Valitse vähemmän tai pienempiä kuvia.")
        return redirect(request.referrer or url_for("views.index")), 303

    db.init_app(app)

    if app.config["APP_MODE"] == "api":
        from . import api

        app.register_blueprint(api.bp)
    else:
        from . import auth, views

        app.register_blueprint(views.bp)
        app.register_blueprint(auth.bp)

    return app
