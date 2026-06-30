"""Unit proofs for the pure admin helper functions (no app context needed)."""

from __future__ import annotations

import pytest

from app.admin import _int_or_none, _slugify, _str_or_none, _unique_slug


# --- _slugify -------------------------------------------------------------

def test_slugify_accented():
    assert _slugify("Äiti Öö Åå") == "aiti-oo-aa"


def test_slugify_strips_and_punctuation():
    assert _slugify("  Kalevi!  ") == "kalevi"
    assert _slugify("a@@@b") == "a-b"


def test_slugify_all_punctuation_empty():
    assert _slugify("###") == ""


def test_slugify_collapses_runs():
    assert _slugify("foo   bar--baz") == "foo-bar-baz"


# --- _unique_slug ---------------------------------------------------------

def test_unique_slug_base_unchanged_when_free():
    assert _unique_slug("kalevi", lambda s: False) == "kalevi"


def test_unique_slug_appends_two():
    taken = {"kalevi"}
    assert _unique_slug("kalevi", lambda s: s in taken) == "kalevi-2"


def test_unique_slug_appends_three():
    taken = {"kalevi", "kalevi-2"}
    assert _unique_slug("kalevi", lambda s: s in taken) == "kalevi-3"


# --- _int_or_none ---------------------------------------------------------

@pytest.mark.parametrize(
    "raw,expected",
    [
        (None, None),
        ("", None),
        ("  ", None),
        ("abc", None),
        ("1.5", None),
        ("12", 12),
        (" 7 ", 7),
        ("-3", -3),
    ],
)
def test_int_or_none(raw, expected):
    assert _int_or_none(raw) == expected


# --- _str_or_none ---------------------------------------------------------

@pytest.mark.parametrize(
    "raw,expected",
    [
        (None, None),
        ("", None),
        ("   ", None),
        ("  hi  ", "hi"),
    ],
)
def test_str_or_none(raw, expected):
    assert _str_or_none(raw) == expected
