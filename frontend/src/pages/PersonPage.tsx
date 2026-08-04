import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { getPerson } from "../api/client";
import type { Folder, PersonDetail, Photo } from "../api/types";
import Layout from "../components/Layout";
import PhotoGrid from "../components/PhotoGrid";
import PortraitDialog from "../components/PortraitDialog";
import { useT } from "../i18n/LangContext";

function FolderIcon() {
  return (
    <svg
      width="44"
      height="36"
      viewBox="0 0 24 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M1 3a2 2 0 0 1 2-2h5.5l2 2.5H21a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V3z" />
    </svg>
  );
}

/* Folders render as distinct cards in a row above the photos; clicking one
   shows only that folder's photos (?folder=<id>, so back/deep links work).
   Photos without a folder stay below the cards. No folders -> flat grid. */
function FolderedPhotos({
  photos,
  folders,
}: {
  photos: Photo[];
  folders: Folder[];
}) {
  const t = useT();
  const [searchParams, setSearchParams] = useSearchParams();
  if (folders.length === 0 || photos.length === 0) {
    return <PhotoGrid photos={photos} />;
  }

  const inFolder = (id: number) => photos.filter((p) => p.folder_id === id);
  const selected = folders.find(
    (f) => String(f.id) === searchParams.get("folder"),
  );

  if (selected) {
    return (
      <section>
        <div className="folder-bar">
          <button
            type="button"
            className="folder-back"
            onClick={() => {
              searchParams.delete("folder");
              setSearchParams(searchParams);
            }}
          >
            ← {t("folder.back")}
          </button>
          <h2 className="folder-heading">{selected.name}</h2>
        </div>
        <PhotoGrid photos={inFolder(selected.id)} />
      </section>
    );
  }

  const unsorted = photos.filter((p) => p.folder_id == null);
  const nonEmpty = folders.filter((f) => inFolder(f.id).length > 0);
  return (
    <>
      {nonEmpty.length > 0 && (
        <div className="folder-grid">
          {nonEmpty.map((f) => (
            <button
              key={f.id}
              type="button"
              className="folder-card"
              onClick={() => {
                searchParams.set("folder", String(f.id));
                setSearchParams(searchParams);
              }}
            >
              <FolderIcon />
              <span className="folder-name" title={f.name}>
                {f.name}
              </span>
              <span className="folder-count">{inFolder(f.id).length}</span>
            </button>
          ))}
        </div>
      )}
      {unsorted.length > 0 && <PhotoGrid photos={unsorted} />}
    </>
  );
}

function PersonPage() {
  const t = useT();
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const [detail, setDetail] = useState<PersonDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [portraitOpen, setPortraitOpen] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setDetail(null);
    setError(null);
    getPerson(slug)
      .then(setDetail)
      .catch((err: Error) => setError(err.message));
  }, [slug]);

  useEffect(() => {
    if (detail && searchParams.get("showinfo") === "1") {
      setPortraitOpen(true);
    }
  }, [detail, searchParams]);

  return (
    <Layout>
      {error && <p role="alert">{error}</p>}
      {!error && detail === null && <p>{t("common.loading")}</p>}
      {detail && (
        <>
          <h1>{detail.person.display_name}</h1>
          <button type="button" onClick={() => setPortraitOpen(true)}>
            {t("person.portrait")}
          </button>
          <FolderedPhotos photos={detail.photos} folders={detail.folders} />
        </>
      )}
      {detail && portraitOpen && (
        <PortraitDialog
          person={detail.person}
          onClose={() => setPortraitOpen(false)}
        />
      )}
    </Layout>
  );
}

export default PersonPage;
