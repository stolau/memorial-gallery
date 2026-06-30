"""Pluggable storage backends for media (gallery photos + profile pictures).

Selected at startup via STORAGE_BACKEND:
  - "local" (default): files under MEDIA_ROOT on the filesystem (legacy behaviour).
  - "s3":              files in an S3-compatible bucket (UpCloud Object Storage,
                       AWS S3, MinIO, ...).

Both backends expose the same seven methods so views/admin/templates stay
storage-agnostic.

Key scheme (same in both backends, just rooted differently):
    <slug>/<filename>            -- a person's gallery photo
    <slug>/profile/<filename>    -- a person's profile picture
    events/<slug>/<filename>     -- an event's gallery photo
"""

from __future__ import annotations

import mimetypes
import shutil
from pathlib import Path
from typing import Any

from flask import current_app, url_for


def get_storage():
    return current_app.extensions["storage"]


class LocalStorage:
    """Backs media with the local filesystem under a single root directory."""

    def __init__(self, root: Path | str) -> None:
        self.root = Path(root)

    def save_person_photo(self, slug: str, filename: str, file_obj: Any) -> None:
        dest = self.root / slug / filename
        dest.parent.mkdir(parents=True, exist_ok=True)
        file_obj.save(dest)

    def save_event_photo(self, slug: str, filename: str, file_obj: Any) -> None:
        dest = self.root / "events" / slug / filename
        dest.parent.mkdir(parents=True, exist_ok=True)
        file_obj.save(dest)

    def delete_person_file(self, slug: str, filename: str) -> None:
        (self.root / slug / filename).unlink(missing_ok=True)

    def delete_person_all(self, slug: str) -> None:
        shutil.rmtree(self.root / slug, ignore_errors=True)

    def delete_event_all(self, slug: str) -> None:
        shutil.rmtree(self.root / "events" / slug, ignore_errors=True)

    def person_photo_url(self, slug: str, filename: str) -> str:
        return url_for("views.media", slug=slug, filename=filename)

    def event_photo_url(self, slug: str, filename: str) -> str:
        return url_for("views.event_media", slug=slug, filename=filename)


class S3Storage:
    """Backs media with an S3-compatible bucket. Assumes public-read bucket policy."""

    def __init__(
        self,
        endpoint: str,
        bucket: str,
        access_key: str,
        secret_key: str,
        public_base: str,
        region: str | None = None,
    ) -> None:
        import boto3  # lazy so local-mode installs don't need the dep at import time

        self.bucket = bucket
        self.public_base = public_base.rstrip("/")
        self.client = boto3.client(
            "s3",
            endpoint_url=endpoint,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name=region or "us-east-1",
        )

    def _put(self, key: str, file_obj: Any) -> None:
        body = getattr(file_obj, "stream", file_obj)
        if hasattr(body, "seek"):
            try:
                body.seek(0)
            except (OSError, ValueError):
                pass
        content_type = (
            getattr(file_obj, "mimetype", None)
            or mimetypes.guess_type(key)[0]
            or "application/octet-stream"
        )
        self.client.put_object(
            Bucket=self.bucket, Key=key, Body=body, ContentType=content_type
        )

    def _delete_prefix(self, prefix: str) -> None:
        paginator = self.client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=self.bucket, Prefix=prefix):
            objs = [{"Key": o["Key"]} for o in page.get("Contents", [])]
            if objs:
                self.client.delete_objects(
                    Bucket=self.bucket, Delete={"Objects": objs}
                )

    def save_person_photo(self, slug: str, filename: str, file_obj: Any) -> None:
        self._put(f"{slug}/{filename}", file_obj)

    def save_event_photo(self, slug: str, filename: str, file_obj: Any) -> None:
        self._put(f"events/{slug}/{filename}", file_obj)

    def delete_person_file(self, slug: str, filename: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=f"{slug}/{filename}")

    def delete_person_all(self, slug: str) -> None:
        self._delete_prefix(f"{slug}/")

    def delete_event_all(self, slug: str) -> None:
        self._delete_prefix(f"events/{slug}/")

    def person_photo_url(self, slug: str, filename: str) -> str:
        return f"{self.public_base}/{slug}/{filename}"

    def event_photo_url(self, slug: str, filename: str) -> str:
        return f"{self.public_base}/events/{slug}/{filename}"
