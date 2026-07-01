import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { getPerson } from "../api/client";
import type { PersonDetail } from "../api/types";
import Layout from "../components/Layout";
import PhotoGrid from "../components/PhotoGrid";
import PortraitDialog from "../components/PortraitDialog";
import { useT } from "../i18n/LangContext";

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
          <PhotoGrid photos={detail.photos} />
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
