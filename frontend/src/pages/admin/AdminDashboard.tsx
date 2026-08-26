import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { AuthError } from "../../api/auth";
import { getPeople, getEvents, getCollections, getContact } from "../../api/client";
import { deletePerson, deleteEvent, deleteCollection } from "../../api/admin";
import type { Person, Event, Collection, Contact } from "../../api/types";
import { useAuth } from "../../auth/AuthContext";
import AdminLayout from "../../components/AdminLayout";
import ContactForm from "./ContactForm";
import { useT } from "../../i18n/LangContext";

function AdminDashboard() {
  const t = useT();
  const { clearAuth } = useAuth();
  const [people, setPeople] = useState<Person[] | null>(null);
  const [events, setEvents] = useState<Event[] | null>(null);
  const [collections, setCollections] = useState<Collection[] | null>(null);
  const [contact, setContact] = useState<Contact | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getPeople(), getEvents(), getCollections(), getContact()])
      .then(([p, e, c, ct]) => {
        setPeople(p);
        setEvents(e);
        setCollections(c);
        setContact(ct);
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

  const handleDeleteCollection = async (slug: string) => {
    if (!window.confirm(t("admin.action.delete"))) return;
    setError(null);
    try {
      await deleteCollection(slug);
      setCollections(await getCollections());
    } catch (err) {
      handleMutationError(err);
    }
  };

  return (
    <AdminLayout>
      {loadError && <p role="alert">{loadError}</p>}
      {!loadError &&
        (people === null ||
          events === null ||
          collections === null ||
          contact === null) && <p>{t("common.loading")}</p>}
      {people && events && collections && contact && (
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
          <section className="admin-section">
            <h2>{t("admin.collections.title")}</h2>
            <ul className="admin-list">
              {collections.map((collection) => (
                <li key={collection.slug}>
                  <span>{collection.name}</span>
                  <span className="admin-row-actions">
                    <Link to={`/admin/collections/${collection.slug}/edit`}>
                      {t("admin.action.edit")}
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDeleteCollection(collection.slug)}
                    >
                      {t("admin.action.delete")}
                    </button>
                  </span>
                </li>
              ))}
            </ul>
            <Link className="admin-new" to="/admin/collections/new">
              {t("admin.action.new")}
            </Link>
          </section>
          <section className="admin-section">
            <h2>{t("admin.contact.title")}</h2>
            <ContactForm initial={contact} onError={handleMutationError} />
          </section>
        </>
      )}
    </AdminLayout>
  );
}

export default AdminDashboard;
