import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { AuthError } from "../../api/auth";
import { getPeople, getEvents } from "../../api/client";
import { deletePerson, deleteEvent } from "../../api/admin";
import type { Person, Event } from "../../api/types";
import { useAuth } from "../../auth/AuthContext";
import AdminLayout from "../../components/AdminLayout";
import { useT } from "../../i18n/LangContext";

function AdminDashboard() {
  const t = useT();
  const { clearAuth } = useAuth();
  const [people, setPeople] = useState<Person[] | null>(null);
  const [events, setEvents] = useState<Event[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getPeople(), getEvents()])
      .then(([p, e]) => {
        setPeople(p);
        setEvents(e);
      })
      .catch((err: Error) => setLoadError(err.message));
  }, []);

  function handleMutationError(err: unknown) {
    const s = (err as AuthError).status;
    if (s === 401) {
      clearAuth();
      return;
    }
    if (s === 404) {
      setError(t("admin.error.notFound"));
    } else {
      setError(t("admin.error.generic"));
    }
  }

  const handleDeletePerson = async (slug: string) => {
    if (!window.confirm(t("admin.action.delete"))) return;
    setError(null);
    try {
      await deletePerson(slug);
      setPeople(await getPeople());
    } catch (err) {
      handleMutationError(err);
    }
  };

  const handleDeleteEvent = async (slug: string) => {
    if (!window.confirm(t("admin.action.delete"))) return;
    setError(null);
    try {
      await deleteEvent(slug);
      setEvents(await getEvents());
    } catch (err) {
      handleMutationError(err);
    }
  };

  return (
    <AdminLayout>
      {loadError && <p role="alert">{loadError}</p>}
      {!loadError && (people === null || events === null) && (
        <p>{t("common.loading")}</p>
      )}
      {people && events && (
        <>
          {error && <p role="alert">{error}</p>}
          <section className="admin-section">
            <h2>{t("admin.people.title")}</h2>
            <ul className="admin-list">
              {people.map((person) => (
                <li key={person.slug}>
                  <span>{person.display_name}</span>
                  <span className="admin-row-actions">
                    <Link to={`/admin/people/${person.slug}/edit`}>
                      {t("admin.action.edit")}
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDeletePerson(person.slug)}
                    >
                      {t("admin.action.delete")}
                    </button>
                  </span>
                </li>
              ))}
            </ul>
            <Link className="admin-new" to="/admin/people/new">
              {t("admin.action.new")}
            </Link>
          </section>
          <section className="admin-section">
            <h2>{t("admin.events.title")}</h2>
            <ul className="admin-list">
              {events.map((event) => (
                <li key={event.slug}>
                  <span>{event.name}</span>
                  <span className="admin-row-actions">
                    <Link to={`/admin/events/${event.slug}/edit`}>
                      {t("admin.action.edit")}
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDeleteEvent(event.slug)}
                    >
                      {t("admin.action.delete")}
                    </button>
                  </span>
                </li>
              ))}
            </ul>
            <Link className="admin-new" to="/admin/events/new">
              {t("admin.action.new")}
            </Link>
          </section>
        </>
      )}
    </AdminLayout>
  );
}

export default AdminDashboard;
