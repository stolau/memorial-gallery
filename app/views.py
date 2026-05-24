import secrets
from pathlib import Path

from flask import Blueprint, abort, current_app, flash, redirect, render_template, request, send_from_directory, url_for
from werkzeug.utils import secure_filename

from . import models
from .auth import login_required

bp = Blueprint("views", __name__)

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}


@bp.route("/")
def index():
    return render_template("index.html", people=models.list_people())


@bp.route("/<slug>")
def person(slug: str):
    p = models.get_person(slug)
    if not p:
        abort(404)
    photos = models.list_photos(p["id"])
    photos_json = [
        {
            "url": url_for("views.media", slug=slug, filename=ph["filename"]),
            "caption": ph["caption"] or "",
        }
        for ph in photos
    ]
    return render_template("person.html", person=p, photos=photos, photos_json=photos_json)


def _int_or_none(raw: str | None) -> int | None:
    raw = (raw or "").strip()
    if not raw:
        return None
    try:
        return int(raw)
    except ValueError:
        return None


def _str_or_none(raw: str | None) -> str | None:
    raw = (raw or "").strip()
    return raw or None


@bp.route("/<slug>/edit", methods=("GET", "POST"))
@login_required
def edit(slug: str):
    p = models.get_person(slug)
    if not p:
        abort(404)

    if request.method == "POST":
        display_name = (request.form.get("display_name") or "").strip() or p["display_name"]
        update_kwargs = dict(
            display_name=display_name,
            bio=_str_or_none(request.form.get("bio")),
            birth_year=_int_or_none(request.form.get("birth_year")),
            death_year=_int_or_none(request.form.get("death_year")),
            birthplace=_str_or_none(request.form.get("birthplace")),
            profession=_str_or_none(request.form.get("profession")),
        )

        media_root = Path(current_app.config["MEDIA_ROOT"])
        profile_file = request.files.get("profile_image")
        remove_profile = request.form.get("remove_profile_image") == "on"

        if profile_file and profile_file.filename:
            ext = Path(profile_file.filename).suffix.lower()
            if ext in ALLOWED_EXTENSIONS:
                safe_base = secure_filename(Path(profile_file.filename).stem) or "profile"
                final_name = f"{safe_base}-{secrets.token_hex(4)}{ext}"
                dest_dir = media_root / slug / "profile"
                dest_dir.mkdir(parents=True, exist_ok=True)
                profile_file.save(dest_dir / final_name)
                if p["profile_image"]:
                    (media_root / slug / p["profile_image"]).unlink(missing_ok=True)
                update_kwargs["profile_image"] = f"profile/{final_name}"
        elif remove_profile and p["profile_image"]:
            (media_root / slug / p["profile_image"]).unlink(missing_ok=True)
            update_kwargs["profile_image"] = None

        models.update_person(slug, **update_kwargs)
        flash("Tiedot päivitetty.")
        return redirect(url_for("views.person", slug=slug))

    return render_template("edit_person.html", person=p)


@bp.route("/<slug>/upload", methods=("GET", "POST"))
@login_required
def upload(slug: str):
    p = models.get_person(slug)
    if not p:
        abort(404)

    if request.method == "POST":
        files = request.files.getlist("photos")
        saved = 0
        skipped = 0
        for f in files:
            if not f or not f.filename:
                continue
            ext = Path(f.filename).suffix.lower()
            if ext not in ALLOWED_EXTENSIONS:
                skipped += 1
                continue
            safe_base = secure_filename(Path(f.filename).stem) or "photo"
            final_name = f"{safe_base}-{secrets.token_hex(4)}{ext}"
            dest_dir = Path(current_app.config["MEDIA_ROOT"]) / slug
            dest_dir.mkdir(parents=True, exist_ok=True)
            f.save(dest_dir / final_name)
            models.add_photo(p["id"], final_name, request.form.get("caption") or None)
            saved += 1

        if saved:
            flash("Ladattiin 1 kuva." if saved == 1 else f"Ladattiin {saved} kuvaa.")
        if skipped:
            flash(f"Ohitettiin {skipped} tiedostoa, joiden muotoa ei tueta (tuetut: JPG, PNG, GIF, WEBP).")
        if not saved and not skipped:
            flash("Ei valittuja kuvia.")
        return redirect(url_for("views.person", slug=slug))

    return render_template("upload.html", person=p)


@bp.route("/media/<slug>/<path:filename>")
def media(slug: str, filename: str):
    directory = Path(current_app.config["MEDIA_ROOT"]) / slug
    return send_from_directory(directory, filename)
