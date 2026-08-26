import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getEvent } from "../api/client";
import type { EventDetail } from "../api/types";
import Layout from "../components/Layout";
import Paragraphs from "../components/Paragraphs";
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
          <Link to="/events" className="back-link">
            ← {t("events.title")}
          </Link>
          <div className="detail-head">
            {detail.event.kind && (
              <p className="page-eyebrow">{t(`kinds.${detail.event.kind}`)}</p>
            )}
            <h1 className="detail-name">{detail.event.name}</h1>
            {(() => {
              const meta = [detail.event.event_time, detail.event.place]
                .filter(Boolean)
                .join(" · ");
              return meta ? <p className="detail-meta">{meta}</p> : null;
            })()}
            {detail.event.description && (
              <div className="detail-desc">
                <Paragraphs text={detail.event.description} />
              </div>
            )}
          </div>
          <PhotoGrid photos={detail.photos} />
        </>
      )}
    </Layout>
  );
}

export default EventPage;
