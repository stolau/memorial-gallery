# Photo Gallery

A small Flask web app for hosting a photo gallery. Each person gets their own page
(`/<name>`) with a photo gallery and a details card (bio, birth/death years, birthplace,
profession, optional portrait). Built to grow from one person to many.

## Features

- **Per-person pages** at `/<slug>` (e.g. `/jane`) with an interactive gallery:
  a large featured photo, previous/next navigation, and a clickable thumbnail strip.
- **Details card** — a pop-up modal showing the person's portrait, bio, and facts.
  Opens on demand via the details button, or automatically when the page is visited
  with `?showinfo=true`.
- **Event pages** at `/event/<slug>` — a parallel entity for events (weddings, reunions,
  …) with the same interactive gallery. Details (name, description, time, place) are shown
  inline rather than in a popup. Events are listed in an events section on the main
  page, each card covered by the event's latest photo.
- **Admin panel** in the SPA (login required) — add, edit, and delete both people and
  events from one place, driven by the JSON write API. New entries get a URL slug
  auto-generated from their name (accented characters transliterated, e.g.
  `Renée Ström` → `renee-strom`), with automatic de-duplication.
- **Password-protected editing** — the admin views, adding photos, and editing details
  all go through JSON endpoints guarded by a single shared password. Edit/upload controls
  are hidden from logged-out visitors.
- **Bilingual (Finnish / English)** — UI text is translated with Flask-Babel. The
  session `lang` selects the locale for server-side JSON-API strings; `DEFAULT_LANG`
  sets the initial language. Person/event content itself is shown as authored.
- **Single-origin app** — the built single-page frontend and the JSON endpoints under
  `/api` are served from the same Flask app. The SPA catch-all serves every non-API
  path (including `/login` and the admin views), so the frontend owns all rendering.
- **SQLite** storage with a tiny built-in migration step; no database server needed.

## Requirements

- Python 3.11+ (developed on 3.12)
- See [`requirements.txt`](requirements.txt) — Flask, python-dotenv, and Flask-Babel.

## Setup

```bash
# 1. Create a virtual environment and install dependencies
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 2. Configure environment
cp .env.example .env
#    then edit .env — set a real SECRET_KEY and UPLOAD_PASSWORD
python -c "import secrets; print(secrets.token_hex(32))"   # generates a SECRET_KEY

# 3. Initialize the database (and optionally seed a sample person)
flask --app app init-db
flask --app app seed-kalevi   # optional starter person
```

## Running

```bash
flask --app app run --debug
```

Then open <http://127.0.0.1:5000/>. (Use `--port 5050` or another port if 5000 is taken.)

## Configuration

Environment variables (loaded from `.env`):

| Variable          | Default       | Description                                              |
|-------------------|---------------|----------------------------------------------------------|
| `SECRET_KEY`      | `dev-only-…`  | Flask session signing key. **Set a long random value.**  |
| `UPLOAD_PASSWORD` | `changeme`    | Shared password for login (editing & uploads).           |
| `MAX_UPLOAD_MB`   | `100`         | Max total size of a single upload request, in megabytes. |
| `DEFAULT_LANG`    | `fi`          | Initial UI language, `fi` or `en`. Visitors can still toggle. |
| `STORAGE_BACKEND` | `local`       | `local` (filesystem, default) or `s3` (S3-compatible bucket — see [Storage backends](#storage-backends)). |

## CLI commands

```bash
flask --app app init-db              # create tables; also applies column migrations
flask --app app seed-kalevi          # insert an initial sample person if missing
flask --app app migrate-media-to-s3  # one-shot upload of media/ to the configured S3 bucket
```

Re-running `init-db` is safe — tables use `CREATE TABLE IF NOT EXISTS` and new
columns are added idempotently.

## Routes

All routes below are served from the same app.

| Method   | Path                            | Description                                       |
|----------|---------------------------------|---------------------------------------------------|
| GET      | `/`                             | SPA index (landing page).                         |
| GET      | `/media/<slug>/<file>`          | Serve an uploaded person image.                   |
| GET      | `/media/events/<slug>/<file>`   | Serve an uploaded event image.                    |
| GET      | `/api/people`                   | List of people (JSON).               |
| GET      | `/api/people/<slug>`            | A person plus their photos (JSON).   |
| GET      | `/api/events`                   | List of events (JSON).               |
| GET      | `/api/events/<slug>`            | An event plus its photos (JSON).     |
| —        | *(other JSON write/auth routes)* | See `/api/*` in `admin_api.py` (login, create/edit/delete, uploads). |
| GET      | `/<path:path>`                  | SPA catch-all: any other path serves the SPA index (e.g. `/<slug>`, `/login`, admin views). |

## Project layout

```
app/
  __init__.py        # app factory, config, blueprint registration, error handlers
  db.py              # SQLite connection, schema init/migrations, CLI commands
  schema.sql         # table definitions
  models.py          # data-access layer (shared by the JSON API)
  api.py             # public read API routes (JSON)
  admin_api.py       # authenticated write API routes (JSON): login, create/edit/delete, uploads
  media.py           # photo-serving routes (local files or S3 redirect)
  auth.py            # session auth helpers (_is_authed + @api_login_required)
  spa.py             # single-page-app blueprint: serves the built frontend + catch-all
  translations/      # Flask-Babel catalog (fi/LC_MESSAGES/messages.po + .mo); English is the source
  static/css/        # styles
babel.cfg            # Babel extraction config
instance/            # SQLite database (gitignored, created at runtime)
media/<slug>/        # person photos; portraits under media/<slug>/profile/ (gitignored)
media/events/<slug>/ # event photos (gitignored)
```

## Translations

Server-side strings returned by the JSON API (error and status messages) are wrapped in
`gettext`/`_()` using **English source keys** (msgids). English needs no catalog — those
keys render as-is. Finnish lives in a compiled catalog at `app/translations/fi/`.
After adding or changing any such string:

```bash
# 1. Re-extract source strings (English keys)
pybabel extract -F babel.cfg -o messages.pot .
# 2. Merge new strings into the Finnish catalog
pybabel update -i messages.pot -d app/translations -l fi
# 3. Edit app/translations/fi/LC_MESSAGES/messages.po to translate new entries
# 4. Compile to the .mo the app loads at runtime
pybabel compile -d app/translations
```

The compiled `.mo` is committed so the app works without a build step. Because Finnish is
the default (`DEFAULT_LANG=fi`) and comes from the catalog, remember to recompile after
editing the `.po` — otherwise new strings fall back to their English keys.

## Storage backends

Photos can live either on the local filesystem (default) or in an S3-compatible
object storage bucket (e.g. AWS S3, MinIO, or any S3-compatible provider). Switching is a
one-line `.env` change followed by a one-shot migration.

**`STORAGE_BACKEND=local`** (default) — files saved under `media/<slug>/...` and
served by Flask via `send_from_directory`. Same behaviour the app has always had.

**`STORAGE_BACKEND=s3`** — files uploaded to a bucket using `boto3`; the
`/media/...` route 302-redirects to the direct bucket URL so image bytes never
pass through the VM. Set all of:

```
STORAGE_BACKEND=s3
S3_ENDPOINT=https://s3.example.com
S3_BUCKET=my-media-bucket
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_PUBLIC_BASE=https://my-media-bucket.s3.example.com
# S3_REGION=    # optional; defaults to us-east-1 which most providers ignore
```

The bucket is assumed to be publicly readable (so `S3_PUBLIC_BASE/<key>` resolves
directly in a browser). Attach a bucket policy that allows `s3:GetObject` for `*`.

If `STORAGE_BACKEND=s3` is set without all of those vars, the app refuses to
start and tells you which ones are missing.

**One-shot migration of existing photos:**

```bash
# After setting STORAGE_BACKEND=s3 and the S3_* vars in .env:
flask --app app migrate-media-to-s3
```

Walks every file under `media/` and uploads it with a matching object key
(`<slug>/<file>` for people, `<slug>/profile/<file>` for portraits,
`events/<slug>/<file>` for events). After this completes, the bucket is the
single source of truth; the local `media/` directory can be deleted.

## Notes

- Uploaded images live on disk under `media/`, with only their metadata in the
  database. Both `media/` and `instance/` are gitignored and recreated on startup.
- Supported image formats: JPG, PNG, GIF, WEBP.
- The Flask dev server is for local use only; run behind a production WSGI server
  (e.g. gunicorn) for any real deployment.
</content>
</invoke>
