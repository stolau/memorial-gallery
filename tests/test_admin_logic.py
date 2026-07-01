"""Unit proofs for app.admin_logic.resolve_profile_image.

No app context, no real storage: a tiny recording fake storage observes exactly
which save/delete calls the pure logic makes. The function is pure (return-based)
so this is the right level to pin its six branches.
"""

from __future__ import annotations

import io

from app.admin_logic import UNCHANGED, resolve_profile_image


class _RecordingStorage:
    def __init__(self) -> None:
        self.saved: list[tuple[str, str]] = []   # (slug, key)
        self.deleted: list[tuple[str, str]] = []  # (slug, key)

    def save_person_photo(self, slug, filename, file_obj):
        self.saved.append((slug, filename))

    def delete_person_file(self, slug, filename):
        self.deleted.append((slug, filename))


class _FakeFile:
    """Mimics a Werkzeug FileStorage enough for resolve_profile_image."""

    def __init__(self, filename: str) -> None:
        self.filename = filename
        self.stream = io.BytesIO(b"bytes")

    def save(self, dest):  # never reached via the fake storage, but here for parity
        pass


def test_valid_file_no_current_key_saves_and_returns_new_key():
    storage = _RecordingStorage()
    result = resolve_profile_image(storage, "kalevi", None, _FakeFile("face.jpg"), False)

    assert result is not UNCHANGED
    assert isinstance(result, str)
    assert result.startswith("profile/") and result.endswith(".jpg")
    assert storage.saved == [("kalevi", result)]
    assert storage.deleted == []  # nothing to delete when there is no current key


def test_valid_file_with_current_key_saves_new_and_deletes_old():
    storage = _RecordingStorage()
    result = resolve_profile_image(
        storage, "kalevi", "profile/old.jpg", _FakeFile("face.png"), False
    )

    assert isinstance(result, str)
    assert result.startswith("profile/") and result.endswith(".png")
    assert storage.saved == [("kalevi", result)]
    # The previous key is deleted.
    assert storage.deleted == [("kalevi", "profile/old.jpg")]


def test_invalid_ext_file_is_unchanged_nothing_touched():
    storage = _RecordingStorage()
    result = resolve_profile_image(
        storage, "kalevi", "profile/old.jpg", _FakeFile("evil.txt"), False
    )

    assert result is UNCHANGED
    assert storage.saved == []
    assert storage.deleted == []


def test_remove_true_with_current_key_returns_none_and_deletes():
    storage = _RecordingStorage()
    result = resolve_profile_image(storage, "kalevi", "profile/old.jpg", None, True)

    assert result is None
    assert storage.saved == []
    assert storage.deleted == [("kalevi", "profile/old.jpg")]


def test_remove_true_with_no_current_key_is_unchanged():
    storage = _RecordingStorage()
    result = resolve_profile_image(storage, "kalevi", None, None, True)

    assert result is UNCHANGED
    assert storage.saved == []
    assert storage.deleted == []


def test_neither_file_nor_remove_is_unchanged():
    storage = _RecordingStorage()
    result = resolve_profile_image(storage, "kalevi", "profile/old.jpg", None, False)

    assert result is UNCHANGED
    assert storage.saved == []
    assert storage.deleted == []
