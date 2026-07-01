"""Cap-only image processing: downscale oversized uploads, bake in EXIF
orientation, and re-encode. Failure-safe -- any error returns the original
bytes so an upload is never lost. GIFs pass through byte-identically.
"""

from io import BytesIO

from PIL import Image, ImageOps


def cap(file_obj, max_px=2000) -> BytesIO:
    """Return a BytesIO of the image capped to max_px on its longest side.

    Reads bytes via file_obj.stream when present (falling back to file_obj),
    so werkzeug FileStorage and bare byte streams both work. On any decode or
    encode failure the original bytes are returned unchanged.
    """
    stream = getattr(file_obj, "stream", file_obj)
    try:
        stream.seek(0)
    except Exception:
        pass
    data = stream.read()

    try:
        img = Image.open(BytesIO(data))
        img.load()
        fmt = img.format
    except Exception:
        return BytesIO(data)

    # Capture format before exif_transpose (which drops .format), and pass GIFs
    # through untouched so animated frames survive.
    if fmt == "GIF":
        return BytesIO(data)

    save_kwargs = {"quality": 85} if fmt == "JPEG" else {}
    out = BytesIO()
    try:
        img = ImageOps.exif_transpose(img)

        if max(img.size) > max_px:
            img.thumbnail((max_px, max_px))

        img.save(out, format=fmt, **save_kwargs)
    except Exception:
        return BytesIO(data)
    out.seek(0)
    return out
