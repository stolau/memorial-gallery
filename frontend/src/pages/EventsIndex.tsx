import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getEvents } from "../api/client";
import type { Event } from "../api/types";
import Layout from "../components/Layout";
import { useT } from "../i18n/LangContext";

function EventsIndex() {
  const t = useT();
  const [events, setEvents] = useState<Event[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getEvents()
      .then(setEvents)
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <Layout>
      <div className="page-head">
        <p className="page-eyebrow">{t("inMemoriam")}</p>
        <h1 className="page-title">{t("events.title")}</h1>
      </div>
      {error && <p role="alert">{error}</p>}
      {!error && events === null && <p>{t("common.loading")}</p>}
      {events && events.length === 0 && <p>{t("events.empty")}</p>}
      {events && events.length > 0 && (
        <ul className="events-grid">
          {events.map((event) => {
            const meta = [event.event_time, event.place]
              .filter(Boolean)
              .join(" · ");
            return (
              <li key={event.slug}>
                <Link to={`/events/${event.slug}`} className="event-card">
                  {event.cover_url && (
                    <img
                      className="event-card-img"
                      src={event.cover_url}
                      alt={event.name}
                    />
                  )}
                  {event.kind && (
                    <span className="kind-eyebrow">
                      {t(`kinds.${event.kind}`)}
                    </span>
                  )}
                  <span className="event-card-name">{event.name}</span>
                  {meta && <span className="event-card-meta">{meta}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Layout>
  );
}

export default EventsIndex;
