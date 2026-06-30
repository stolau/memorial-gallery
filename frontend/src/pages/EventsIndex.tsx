import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getEvents } from "../api/client";
import type { Event } from "../api/types";
import Layout from "../components/Layout";

function EventsIndex() {
  const [events, setEvents] = useState<Event[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getEvents()
      .then(setEvents)
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <Layout>
      <h1>Events</h1>
      {error && <p role="alert">{error}</p>}
      {!error && events === null && <p>Loading…</p>}
      {events && events.length === 0 && <p>No events yet.</p>}
      {events && events.length > 0 && (
        <ul className="events-grid">
          {events.map((event) => (
            <li key={event.slug}>
              <Link to={`/events/${event.slug}`} className="event-card">
                {event.cover_url && (
                  <img
                    className="event-card-img"
                    src={event.cover_url}
                    alt={event.name}
                  />
                )}
                <span className="event-card-name">{event.name}</span>
                {event.place && (
                  <span className="event-card-meta">{event.place}</span>
                )}
                {event.event_time && (
                  <span className="event-card-meta">{event.event_time}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Layout>
  );
}

export default EventsIndex;
