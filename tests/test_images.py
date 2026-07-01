"""Real proofs for the cap-only image feature (app/images.py + seams + CLI).

Every image here is a genuine, Pillow-decodable file built in-memory; every
assertion re-opens the RESULT with Pillow (or inspects real bytes on the tmp
MEDIA_ROOT) so nothing is faked. The upload/profile/backfill cases drive the
actual admin_api blueprint and the real `flask backfill-images` CLI against the
same isolated tmp dirs the rest of the suite uses (see tests/conftest.py).
"""

from __future__ import annotations

import io

from PIL import Image

from app import models
from app.images import cap


# --- helpers --------------------------------------------------------------


def _jpeg(w: int, h: int, color=(200, 30, 30)) -> bytes:
    """A real, decodable RGB JPEG of exactly w x h."""
    buf = io.BytesIO()
    Image.new("RGB", (w, h), color).save(buf, "JPEG", quality=90)
    return buf.getvalue()


def _gif(w: int, h: int) -> bytes:
    buf = io.BytesIO()
    Image.new("P", (w, h), 0).save(buf, "GIF")
    return buf.getvalue()


def _open(data_or_bio):
    raw = data_or_bio.getvalue() if hasattr(data_or_bio, "getvalue") else data_or_bio
    return Image.open(io.BytesIO(raw))


# ==========================================================================
# 1-5: pure cap() behavior
# ==========================================================================


def test_cap_downscales_oversized_and_preserves_aspect():
    src = _jpeg(3000, 1000)
    out = cap(io.BytesIO(src), max_px=2000)
    im = _open(out)
    w, h = im.size
    assert max(w, h) <= 2000
    # 3:1 aspect preserved: longest side pinned to 2000, short side ~667.
    assert w == 2000
    assert 660 <= h <= 672
    assert im.format == "JPEG"


def test_cap_leaves_small_image_within_bounds_valid():
    src = _jpeg(100, 100)
    out = cap(io.BytesIO(src), max_px=2000)
    im = _open(out)
    im.load()  # genuinely decodable
    assert max(im.size) <= 2000
    assert im.size == (100, 100)


def test_cap_passes_gif_through_byte_identical():
    gif_bytes = _gif(3000, 1000)  # oversized on purpose; must NOT be touched
    # sanity: it really is a GIF
    assert _open(gif_bytes).format == "GIF"
    out = cap(io.BytesIO(gif_bytes), max_px=2000)
    assert out.getvalue() == gif_bytes


def test_cap_bakes_exif_orientation():
    # Build a 100(w) x 50(h) JPEG carrying EXIF orientation=6 (rotate).
    img = Image.new("RGB", (100, 50), (10, 120, 200))
    exif = img.getexif()
    exif[0x0112] = 6
    buf = io.BytesIO()
    img.save(buf, "JPEG", exif=exif)
    src = buf.getvalue()

    # Prove the pre-cap image genuinely decodes 100x50 WITH the orientation tag,
    # so the test actually exercises exif_transpose rather than a no-op.
    pre = _open(src)
    assert pre.size == (100, 50)
    assert pre.getexif().get(0x0112) == 6

    out = cap(io.BytesIO(src), max_px=2000)
    post = _open(out)
    # Orientation baked in -> pixels transposed to 50(w) x 100(h).
    assert post.size == (50, 100)


def test_cap_passes_corrupt_bytes_through_unchanged():
    junk = b"not an image"
    out = cap(io.BytesIO(junk), max_px=2000)
    assert out.getvalue() == junk


# ==========================================================================
# 6: person-photos upload seam caps
# ==========================================================================


def test_upload_person_photo_is_capped_on_disk(app, authed_client):
    media_root = app.config["MEDIA_ROOT_PATH"]
    src = _jpeg(3000, 1000)

    r = authed_client.post(
        "/api/people/kalevi/photos",
        data={"photos": [(io.BytesIO(src), "huge.jpg")]},
        content_type="multipart/form-data",
    )
    assert r.status_code == 200
    assert r.get_json() == {"saved": 1, "skipped": 0}

    with app.app_context():
        kalevi_id = models.get_person("kalevi")["id"]
        names = [p["filename"] for p in models.list_photos(kalevi_id)]
    new_names = [n for n in names if n != "p-aaaa.jpg"]
    assert len(new_names) == 1
    stored = media_root / "kalevi" / new_names[0]
    assert stored.exists()
    im = Image.open(stored)
    assert max(im.size) <= 2000
    assert im.size[0] == 2000  # downscaled, not the original 3000


# ==========================================================================
# 7: profile-image seam caps
# ==========================================================================


def test_set_profile_image_is_capped_on_disk(app, authed_client):
    media_root = app.config["MEDIA_ROOT_PATH"]
    src = _jpeg(3000, 1000)

    r = authed_client.put(
        "/api/people/kalevi/profile-image",
        data={"profile_image": (io.BytesIO(src), "face.jpg")},
        content_type="multipart/form-data",
    )
    assert r.status_code == 200
    key = r.get_json()["profile_image"]
    assert key and key.startswith("profile/") and key.endswith(".jpg")

    stored = media_root / "kalevi" / key
    assert stored.exists()
    im = Image.open(stored)
    assert max(im.size) <= 2000
    assert im.size[0] == 2000


# ==========================================================================
# 8: backfill-images CLI is effective AND idempotent
# ==========================================================================


def test_backfill_caps_in_place_and_is_idempotent(app):
    media_root = app.config["MEDIA_ROOT_PATH"]
    target = media_root / "kalevi" / "oversized.jpg"
    target.write_bytes(_jpeg(3000, 1000))

    runner = app.test_cli_runner()

    # The real `flask` entrypoint (FlaskGroup) runs commands inside an app
    # context; test_cli_runner does not push one for plainly-registered
    # commands, so we push it explicitly to mirror the real invocation.

    # First run: our oversized file must be processed and capped in place.
    with app.app_context():
        r1 = runner.invoke(args=["backfill-images"])
    assert r1.exit_code == 0, r1.output
    assert "Backfill: processed" in r1.output
    # exactly the one oversized file is processed (all seed files are 1x1).
    assert "processed 1," in r1.output

    im = Image.open(target)
    assert max(im.size) <= 2000
    assert im.size[0] == 2000
    after_first = target.read_bytes()

    # Second run: nothing left to do -> no-op, byte-identical file.
    with app.app_context():
        r2 = runner.invoke(args=["backfill-images"])
    assert r2.exit_code == 0, r2.output
    assert "processed 0," in r2.output
    assert target.read_bytes() == after_first
