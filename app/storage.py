"""Pluggable storage backends for media (gallery photos + profile pictures).

Selected at startup via STORAGE_BACKEND:
  - "local" (default): files under MEDIA_ROOT on the filesystem (legacy behaviour).
  - "s3":              files in an S3-compatible bucket (UpCloud Object Storage,
                       AWS S3, MinIO, ...).

Both backends expose the same methods so views/admin/templates stay
storage-agnostic.

Key scheme (same in both backends, just rooted differently). Every entity's
files live under an optional prefix, then the slug:
    <slug>/<filename>                 -- a person's gallery photo (prefix "")
    <slug>/profile/<filename>         -- a person's profile picture (prefix "")
    events/<slug>/<filename>          -- an event's gallery photo (prefix "events")
    collections/<slug>/<filename>     -- a collection's gallery photo (prefix "collections")
"""

from __future__ import annotations

import mimetypes
import shutil
from pathlib import Path
from typing import Any

from flask import current_app, url_for

# Prefix -> media-serving endpoint for local URL building. Person files sit at
# the root (prefix ""), events/collections under a static path segment.
_MEDIA_ENDPOINTS = {
    "": "media.person",
    "events": "media.event",
    "collections": "media.collection",
}


def _key(prefix: str, slug: str, filename: str) -> str:
    return f"{prefix}/{slug}/{filename}" if prefix else f"{slug}/{filename}"


def get_storage():
    return current_app.extensions["storage"]


class LocalStorage:
    """Backs media with the local filesystem under a single root directory."""

    def __init__(self, root: Path | str) -> None:
        self.root = Path(root)

    def _dir(self, prefix: str, slug: str) -> Path:
        return self.root / prefix / slug if prefix else self.root / slug

    # --- prefix-parameterized helpers (all entities go through these) ------

    def save_photo(self, prefix: str, slug: str, filename: str, file_obj: Any) -> None:
        dest = self._dir(prefix, slug) / filename
        dest.parent.mkdir(parents=True, exist_ok=True)
        file_obj.save(dest)

    def delete_file(self, prefix: str, slug: str, filename: str) -> None:
        (self._dir(prefix, slug) / filename).unlink(missing_ok=True)

    def delete_all(self, prefix: str, slug: str) -> None:
        shutil.rmtree(self._dir(prefix, slug), ignore_errors=True)

    def photo_url(self, prefix: str, slug: str, filename: str) -> str:
        return url_for(_MEDIA_ENDPOINTS[prefix], slug=slug, filename=filename)

    # --- thin per-entity wrappers (person prefix "", event "events") -------

    def save_person_photo(self, slug: str, filename: str, file_obj: Any) -> None:
        self.save_photo("", slug, filename, file_obj)

    def save_event_photo(self, slug: str, filename: str, file_obj: Any) -> None:
        self.save_photo("events", slug, filename, file_obj)

    def delete_person_file(self, slug: str, filename: str) -> None:
        self.delete_file("", slug, filename)

    def delete_event_file(self, slug: str, filename: str) -> None:
        self.delete_file("events", slug, filename)

    def delete_person_all(self, slug: str) -> None:
        self.delete_all("", slug)

    def delete_event_all(self, slug: str) -> None:
        self.delete_all("events", slug)

    def person_photo_url(self, slug: str, filename: str) -> str:
        return self.photo_url("", slug, filename)

    def event_photo_url(self, slug: str, filename: str) -> str:
        return self.photo_url("events", slug, filename)


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
        from botocore.config import Config

        self.bucket = bucket
        self.public_base = public_base.rstrip("/")
        self.client = boto3.client(
            "s3",
            endpoint_url=endpoint,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name=region or "us-east-1",
            config=Config(
                # UpCloud (and most S3-compatible providers) serve buckets in
                # the URL path, not as a host subdomain. Without this, boto3
                # signs requests for <bucket>.<endpoint> and the server rejects
                # them with SignatureDoesNotMatch.
                s3={"addressing_style": "path"},
                # botocore >= 1.36 adds default data-integrity checksums via
                # aws-chunked encoding, which UpCloud rejects with
                # XAmzContentSHA256Mismatch. Only send checksums when the
                # operation actually requires them (pre-1.36 behaviour).
                request_checksum_calculation="when_required",
                response_checksum_validation="when_required",
            ),
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

    # --- prefix-parameterized helpers (all entities go through these) ------

    def save_photo(self, prefix: str, slug: str, filename: str, file_obj: Any) -> None:
        self._put(_key(prefix, slug, filename), file_obj)

    def delete_file(self, prefix: str, slug: str, filename: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=_key(prefix, slug, filename))

    def delete_all(self, prefix: str, slug: str) -> None:
        self._delete_prefix(f"{prefix}/{slug}/" if prefix else f"{slug}/")

    def photo_url(self, prefix: str, slug: str, filename: str) -> str:
        return f"{self.public_base}/{_key(prefix, slug, filename)}"

    # --- thin per-entity wrappers (person prefix "", event "events") -------

    def save_person_photo(self, slug: str, filename: str, file_obj: Any) -> None:
        self.save_photo("", slug, filename, file_obj)

    def save_event_photo(self, slug: str, filename: str, file_obj: Any) -> None:
        self.save_photo("events", slug, filename, file_obj)

    def delete_person_file(self, slug: str, filename: str) -> None:
        self.delete_file("", slug, filename)

    def delete_event_file(self, slug: str, filename: str) -> None:
        self.delete_file("events", slug, filename)

    def delete_person_all(self, slug: str) -> None:
        self.delete_all("", slug)

    def delete_event_all(self, slug: str) -> None:
        self.delete_all("events", slug)

    def person_photo_url(self, slug: str, filename: str) -> str:
        return self.photo_url("", slug, filename)

    def event_photo_url(self, slug: str, filename: str) -> str:
        return self.photo_url("events", slug, filename)
