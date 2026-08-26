"""Proofs for collection media serving + API URL enrichment.

Mirrors tests/test_media_api.py + tests/test_api_enrich.py for the collections
surface: the public API emits relative ``/media/collections/...`` URLs and the
media blueprint serves the seeded bytes (local) or redirects (s3). Seeded
(tests/conftest.py::_seed): collection 'suku' with photo 'c-dddd.jpg'.
"""

from __future__ import annotations

from tests.conftest import JPEG_BYTES


# --- API URL enrichment ----------------------------------------------------

def test_api_collections_index_attaches_cover_url(client):
    resp = client.get("/api/collections")
    assert resp.status_code == 200, resp.get_data(as_text=True)
    suku = next(c for c in resp.get_json() if c["slug"] == "suku")
    assert suku["cover_url"] == "/media/collections/suku/c-dddd.jpg"


def test_api_collection_detail_shape_and_urls(client):
    resp = client.get("/api/collections/suku")
    assert resp.status_code == 200, resp.get_data(as_text=True)
    data = resp.get_json()
    assert set(data.keys()) == {"collection", "photos", "folders"}
    assert data["collection"]["profile_image_url"] is None
    assert data["photos"][0]["url"] == "/media/collections/suku/c-dddd.jpg"
    assert data["folders"] == []


def test_api_collection_unknown_slug_is_404(client):
    assert client.get("/api/collections/nope").status_code == 404


# --- Serving ---------------------------------------------------------------

def test_media_collection_serves_seeded_bytes(client):
    resp = client.get("/media/collections/suku/c-dddd.jpg")
    assert resp.status_code == 200
    assert resp.get_data() == JPEG_BYTES


# --- Route overlap: static `collections` segment out-prioritizes <slug> ----

def test_route_overlap_collection_vs_person(app):
    adapter = app.url_map.bind("localhost")
    assert adapter.match("/media/collections/suku/c-dddd.jpg")[0] == "media.collection"
    assert adapter.match("/media/kalevi/p-aaaa.jpg")[0] == "media.person"


# --- S3 redirect branch ----------------------------------------------------

def test_s3_backend_redirects_collection(s3_app):
    class _Stub:
        def photo_url(self, prefix, slug, filename):
            assert prefix == "collections"
            return "https://cdn.example/coll.jpg"

    s3_app.extensions["storage"] = _Stub()
    resp = s3_app.test_client().get("/media/collections/suku/c-dddd.jpg")
    assert resp.status_code == 302
    assert resp.headers["Location"] == "https://cdn.example/coll.jpg"
