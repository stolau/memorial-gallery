CREATE TABLE IF NOT EXISTS people (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    slug           TEXT NOT NULL UNIQUE,
    display_name   TEXT NOT NULL,
    bio            TEXT,
    birth_year     INTEGER,
    death_year     INTEGER,
    birthplace     TEXT,
    profession     TEXT,
    profile_image  TEXT,
    cover_photo_id INTEGER,
    created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS photos (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    person_id    INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    filename     TEXT NOT NULL,
    caption      TEXT,
    uploaded_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_photos_person ON photos(person_id, uploaded_at DESC);
