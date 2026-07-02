# Deploying to a VPS

Target: an Ubuntu/Debian VPS reachable over SSH as the `deploy` user (created by the
cloud-init script), serving the app at **https://example.com** via Caddy
(automatic HTTPS) in front of gunicorn.

Placeholders: replace `SERVER_IP` with your VPS IP and `example.com` with your domain.

---

## 1. Point DNS at the server (do this first)

HTTPS certificates can't be issued until the domain resolves to the VPS. In
your registrar's / DNS provider's management for `example.com`, create:

| Type | Name  | Value        |
|------|-------|--------------|
| A    | `@`   | `SERVER_IP`  |
| A    | `www` | `SERVER_IP`  |

(If the VPS has an IPv6 address, add matching `AAAA` records.)

Wait until it resolves (check from your laptop):

```bash
dig +short example.com      # should print SERVER_IP
```

## 2. Copy the app + data to the server

From your **local machine**, in the parent of the project folder:

```bash
rsync -av --delete \
  --exclude='.venv' --exclude='__pycache__' --exclude='*.pyc' \
  --exclude='.git' --exclude='.env' --exclude='messages.pot' \
  ~/git/photo-gallery/ deploy@SERVER_IP:/home/deploy/photo-gallery/
```

This includes `instance/gallery.db`, `media/`, and the compiled `translations/*.mo`,
so your existing people, events, and photos come along. (`.env` is excluded on
purpose — you create a production one on the server in step 4.)

## 3. Create the virtualenv and install dependencies

SSH in (`ssh -i ~/.ssh/id_deploy deploy@SERVER_IP`), then:

```bash
cd /home/deploy/photo-gallery
python3 -m venv .venv
.venv/bin/pip install --upgrade pip
.venv/bin/pip install -r requirements.txt
.venv/bin/pip install gunicorn          # production WSGI server
```

## 3b. Build the frontend SPA

The React frontend (Vite + TypeScript) is served single-origin by the Flask `spa`
blueprint out of `frontend/dist/`. That directory is gitignored, so build it on the
server (needs Node 18+):

```bash
cd /home/deploy/photo-gallery/frontend
npm ci
npm run build                           # produces frontend/dist/
```

Flask serves `frontend/dist/index.html` and `frontend/dist/assets/*` through the
existing Caddy reverse proxy, so **no Caddy change is needed**. Vite's `base` is the
default `/`, which is correct for serving from the site root.

## 4. Production environment file

```bash
cd /home/deploy/photo-gallery
cp .env.example .env
# generate a strong secret key:
python3 -c "import secrets; print(secrets.token_hex(32))"
nano .env
```

Set in `.env`:

```
SECRET_KEY=<paste the generated value>
UPLOAD_PASSWORD=<a strong password you choose>
MAX_UPLOAD_MB=100
DEFAULT_LANG=fi
BEHIND_PROXY=1
STORAGE_BACKEND=local          # set to "s3" + fill S3_* below if using object storage
```

If serving photos from an S3-compatible bucket instead of the VM disk, also set
`S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_PUBLIC_BASE`
(see README → Storage backends). After flipping `STORAGE_BACKEND=s3`, run
`flask --app app migrate-media-to-s3` once to copy existing photos into the
bucket.

If you did **not** copy an existing database in step 2, initialize one:

```bash
.venv/bin/flask --app app init-db
.venv/bin/flask --app app seed-kalevi   # optional starter person
```

## 5. Run gunicorn as a systemd service

Create the unit (needs sudo):

```bash
sudo tee /etc/systemd/system/gallery.service >/dev/null <<'UNIT'
[Unit]
Description=Photo gallery (gunicorn)
After=network.target

[Service]
User=deploy
Group=deploy
WorkingDirectory=/home/deploy/photo-gallery
ExecStart=/home/deploy/photo-gallery/.venv/bin/gunicorn "app:create_app()" \
    --bind 127.0.0.1:8000 --workers 3 --timeout 120
Restart=always

[Install]
WantedBy=multi-user.target
UNIT

sudo systemctl daemon-reload
sudo systemctl enable --now gallery
systemctl status gallery --no-pager      # should be "active (running)"
curl -s http://127.0.0.1:8000/ | head        # should print HTML
```

The app reads `.env` from `WorkingDirectory`, so no secrets live in the unit file.

## 6. Install Caddy (reverse proxy + automatic HTTPS)

```bash
sudo apt update
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

Write the site config:

```bash
sudo tee /etc/caddy/Caddyfile >/dev/null <<'CADDY'
example.com {
    reverse_proxy 127.0.0.1:8000
}

www.example.com {
    redir https://example.com{uri}
}
CADDY

sudo systemctl reload caddy
```

Caddy now fetches Let's Encrypt certificates for both names (DNS from step 1 must be
live). Watch it happen:

```bash
journalctl -u caddy -f      # Ctrl-C to stop; look for "certificate obtained"
```

## 7. Verify

Open **https://example.com** — you should see the site over HTTPS, with
`http://` and `www.` both redirecting to it. Log in (top-right) with `UPLOAD_PASSWORD`
to confirm admin/upload work.

## 8. Backups (irreplaceable photos!)

```bash
mkdir -p /home/deploy/backups
crontab -e
```

Add a daily backup of the database + media, keeping 14 days:

```
0 3 * * * tar czf /home/deploy/backups/gallery-$(date +\%F).tar.gz -C /home/deploy/photo-gallery instance media && find /home/deploy/backups -name '*.tar.gz' -mtime +14 -delete
```

If `STORAGE_BACKEND=s3`, drop `media` from the tar — photos live in the bucket
(which has its own redundancy; enable bucket versioning for delete protection):

```
0 3 * * * tar czf /home/deploy/backups/gallery-$(date +\%F).tar.gz -C /home/deploy/photo-gallery instance && find /home/deploy/backups -name '*.tar.gz' -mtime +14 -delete
```

Also enable your VPS provider's snapshots if available, and occasionally copy a backup
off the server (e.g. `scp` to your laptop).

---

## Updating the site later

```bash
# from your laptop — push code changes (data on the server is preserved):
rsync -av --exclude='.venv' --exclude='__pycache__' --exclude='*.pyc' \
  --exclude='.git' --exclude='.env' --exclude='instance' --exclude='media' \
  --exclude='messages.pot' \
  ~/git/photo-gallery/ deploy@SERVER_IP:/home/deploy/photo-gallery/

# on the server, if dependencies changed:
cd /home/deploy/photo-gallery && .venv/bin/pip install -r requirements.txt
# if the frontend changed, rebuild the SPA (frontend/dist is gitignored, built on the server):
cd /home/deploy/photo-gallery/frontend && npm ci && npm run build
# restart the app:
sudo systemctl restart gallery
```

(Note: this update command excludes `instance` and `media` so live data is never
overwritten. The initial deploy in step 2 includes them.)

## Troubleshooting

- **502 from Caddy** → gunicorn isn't running: `systemctl status gallery`, `journalctl -u gallery -e`.
- **Cert errors** → DNS not pointing at the server yet, or ports 80/443 blocked. Recheck `dig` and `sudo ufw status`.
- **Uploads fail with 413** → raise `MAX_UPLOAD_MB` in `.env`, then `sudo systemctl restart gallery`.
- **Photos/DB missing** → confirm `instance/gallery.db` and `media/` were copied and are owned by `deploy` (`ls -la`, `chown -R deploy:deploy`).
</content>
