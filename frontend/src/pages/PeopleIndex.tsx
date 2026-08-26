import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getPeople, getEvents, getFamilyLines } from "../api/client";
import type { Event, FamilyLine, Person } from "../api/types";
import Layout from "../components/Layout";
import { useT } from "../i18n/LangContext";

type Tab = "timeline" | "kin";

// The events + family-lines block below the people grid: a segmented
// Timeline | Kin toggle swapping between the events grid and the
// family-lines cards.
function EventsAndKin({
  events,
  familyLines,
}: {
  events: Event[];
  familyLines: FamilyLine[];
}) {
  const t = useT();
  const [tab, setTab] = useState<Tab>("timeline");

  return (
    <section className="home-section">
      <div className="home-section-head">
        <h2 className="home-section-title">{t("eventsAndKin")}</h2>
        <div className="segmented" role="tablist" aria-label={t("eventsAndKin")}>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "timeline"}
            className="seg-btn"
            onClick={() => setTab("timeline")}
          >
            {t("timeline")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "kin"}
            className="seg-btn"
            onClick={() => setTab("kin")}
          >
            {t("kin")}
          </button>
        </div>
      </div>

      {tab === "timeline" ? (
        events.length === 0 ? (
          <p className="photo-grid-empty">{t("events.empty")}</p>
        ) : (
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
        )
      ) : familyLines.length === 0 ? (
        <p className="photo-grid-empty">{t("collections.empty")}</p>
      ) : (
        <ul className="family-grid">
          {familyLines.map((line) => (
            <li key={line.slug} className="family-card">
              <h3 className="family-name">{line.name}</h3>
              {line.year_range && (
                <p className="family-range">{line.year_range}</p>
              )}
              {line.note && <p className="family-note">{line.note}</p>}
              {line.members.length > 0 && (
                <div className="family-chips">
                  {line.members.map((m) => (
                    <Link key={m.slug} to={`/${m.slug}`} className="family-chip">
                      {m.display_name}
                    </Link>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PeopleIndex() {
  const t = useT();
  const [people, setPeople] = useState<Person[] | null>(null);
  const [events, setEvents] = useState<Event[] | null>(null);
  const [familyLines, setFamilyLines] = useState<FamilyLine[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPeople()
      .then(setPeople)
      .catch((err: Error) => setError(err.message));
    // The section below the grid loads independently; a failure there must
    // not blank out the people grid, so it only omits the section.
    getEvents()
      .then(setEvents)
      .catch(() => setEvents([]));
    getFamilyLines()
      .then(setFamilyLines)
      .catch(() => setFamilyLines([]));
  }, []);

  return (
    <Layout>
      <div className="page-head">
        <p className="page-eyebrow">{t("inMemoriam")}</p>
        <h1 className="page-title">{t("people.title")}</h1>
      </div>
      {error && <p role="alert">{error}</p>}
      {!error && people === null && <p>{t("common.loading")}</p>}
      {people && (
        <ul className="people-grid">
          {people.map((person) => (
            <li key={person.slug}>
              <Link to={`/${person.slug}`} className="person-card">
                {person.profile_image_url && (
                  <img
                    className="person-card-img"
                    src={person.profile_image_url}
                    alt={person.display_name}
                  />
                )}
                <span className="person-card-name">{person.display_name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {events !== null && familyLines !== null && (
        <EventsAndKin events={events} familyLines={familyLines} />
      )}
    </Layout>
  );
}

export default PeopleIndex;
