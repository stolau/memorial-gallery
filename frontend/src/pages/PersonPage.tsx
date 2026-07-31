import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { getPerson } from "../api/client";
import type { Folder, PersonDetail, Photo } from "../api/types";
import Layout from "../components/Layout";
import PhotoGrid from "../components/PhotoGrid";
import PortraitDialog from "../components/PortraitDialog";
import { useT } from "../i18n/LangContext";

/* One gallery section per folder; photos without a folder come first under
   their own heading. With no folders at all, the flat grid stays as-is. */
function FolderedPhotos({
  photos,
  folders,
}: {
  photos: Photo[];
  folders: Folder[];
}) {
  const t = useT();
  if (folders.length === 0 || photos.length === 0) {
    return <PhotoGrid photos={photos} />;
  }
  const unsorted = photos.filter((p) => p.folder_id == null);
  return (
    <>
      {unsorted.length > 0 && (
        <section>
          <h2 className="folder-heading">{t("photos.unsorted")}</h2>
          <PhotoGrid photos={unsorted} />
        </section>
      )}
      {folders.map((f) => {
        const inFolder = photos.filter((p) => p.folder_id === f.id);
        if (inFolder.length === 0) return null;
        return (
          <section key={f.id}>
            <h2 className="folder-heading">{f.name}</h2>
            <PhotoGrid photos={inFolder} />
          </section>
        );
      })}
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
