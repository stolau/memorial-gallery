# Kaijankoski — Memorial Gallery

A small Flask web app for hosting a family memorial photo gallery. Each person gets
their own page (`/<name>`) with a photo gallery and a details card (bio, birth/death
years, birthplace, profession, optional portrait). Built to grow from one person to
a whole family.

The UI is in Finnish.

## Features

- **Per-person pages** at `/<slug>` (e.g. `/kalevi`) with an interactive gallery:
  a large featured photo, previous/next navigation, and a clickable thumbnail strip.
- **Details card** — a pop-up modal showing the person's portrait, bio, and facts.
  Opens on demand via the *Tiedot* button, or automatically when the page is visited
  with `?showinfo=true`.
- **Admin panel** at `/admin` (login required) — add, edit, and delete people from one
  place. New people get a URL slug auto-generated from their name (Finnish characters
  transliterated, e.g. `Väinö Öström` → `vaino-ostrom`), with automatic de-duplication.
- **Password-protected editing** — the admin panel, adding photos, and editing details
  all require login behind a single shared password. Edit/upload controls are hidden
  from logged-out visitors.
- **Two run modes** via the `APP_MODE` env var:
  - `fullstack` (default) — server-rendered pages (Jinja2 + Bootstrap 5).
  - `api` — JSON endpoints only, intended for a future separate frontend (e.g. Node.js).
- **SQLite** storage with a tiny built-in migration step; no database server needed.

## Requirements

- Python 3.11+ (developed on 3.12)
- See [`requirements.txt`](requirements.txt) — Flask and python-dotenv.

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

# 3. Initialize the database and seed the first person
flask --app app init-db
flask --app app seed-kalevi
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
| `APP_MODE`        | `fullstack`   | `fullstack` (HTML pages) or `api` (JSON only).           |
| `SECRET_KEY`      | `dev-only-…`  | Flask session signing key. **Set a long random value.**  |
| `UPLOAD_PASSWORD` | `changeme`    | Shared password for login (editing & uploads).           |
| `MAX_UPLOAD_MB`   | `100`         | Max total size of a single upload request, in megabytes. |

## CLI commands

```bash
flask --app app init-db      # create tables; also applies column migrations
flask --app app seed-kalevi  # insert the initial "kalevi" person if missing
```

Re-running `init-db` is safe — tables use `CREATE TABLE IF NOT EXISTS` and new
columns are added idempotently.

## Routes

### Full-stack mode (`APP_MODE=fullstack`)

| Method   | Path                          | Description                                       |
|----------|-------------------------------|---------------------------------------------------|
| GET      | `/`                           | Landing page, list of people (with portraits).    |
| GET      | `/<slug>`                     | A person's gallery. Add `?showinfo=true` to open the details modal automatically. |
| GET/POST | `/<slug>/edit`                | Edit person details (login).                      |
| GET/POST | `/<slug>/upload`              | Upload photos (login).                            |
| GET      | `/media/<slug>/<file>`        | Serve an uploaded image.                          |
| GET      | `/admin/`                     | Admin panel: list/manage people (login).          |
| POST     | `/admin/people`               | Create a new person (login).                      |
| POST     | `/admin/people/<slug>/delete` | Delete a person and all their media (login).      |
| GET/POST | `/login`                      | Login form.                                       |
| POST     | `/logout`                     | Log out.                                           |

### API mode (`APP_MODE=api`)

| Method | Path                  | Description                          |
|--------|-----------------------|--------------------------------------|
| GET    | `/api/people`         | List of people (JSON).               |
| GET    | `/api/people/<slug>`  | A person plus their photos (JSON).   |

## Project layout

```
app/
  __init__.py        # app factory, config, APP_MODE switch, error handlers
  db.py              # SQLite connection, schema init/migrations, CLI commands
  schema.sql         # table definitions
  models.py          # data-access layer (shared by both modes)
  views.py           # full-stack routes (HTML)
  api.py             # API routes (JSON)
  auth.py            # login/logout + @login_required
  admin.py           # admin panel: add / delete people
  templates/         # Jinja2 templates (base, index, person, edit, upload, login, admin)
  static/css/        # styles
instance/            # SQLite database (gitignored, created at runtime)
media/<slug>/        # uploaded photos; portraits under media/<slug>/profile/ (gitignored)
```

## Notes

- Uploaded images live on disk under `media/`, with only their metadata in the
  database. Both `media/` and `instance/` are gitignored and recreated on startup.
- Supported image formats: JPG, PNG, GIF, WEBP.
- The Flask dev server is for local use only; run behind a production WSGI server
  (e.g. gunicorn) for any real deployment.
