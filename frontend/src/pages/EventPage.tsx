import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getEvent } from "../api/client";
import type { EventDetail } from "../api/types";
import Layout from "../components/Layout";
import PhotoGrid from "../components/PhotoGrid";
import { useT } from "../i18n/LangContext";

function EventPage() {
  const t = useT();
  const { slug } = useParams();
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    setDetail(null);
    setError(null);
    getEvent(slug)
      .then(setDetail)
      .catch((err: Error) => setError(err.message));
  }, [slug]);

  return (
    <Layout>
      {error && <p role="alert">{error}</p>}
      {!error && detail === null && <p>{t("common.loading")}</p>}
      {detail && (
        <>
          <h1>{detail.event.name}</h1>
          {detail.event.description && <p>{detail.event.description}</p>}
          <ul>
            {detail.event.event_time && (
              <li>{t("event.time")}: {detail.event.event_time}</li>
            )}
            {detail.event.place && <li>{t("event.place")}: {detail.event.place}</li>}
          </ul>
          <PhotoGrid photos={detail.photos} />
        </>
      )}
    </Layout>
  );
}

export default EventPage;
