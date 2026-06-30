import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getPeople } from "../api/client";
import type { Person } from "../api/types";
import Layout from "../components/Layout";

function PeopleIndex() {
  const [people, setPeople] = useState<Person[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPeople()
      .then(setPeople)
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <Layout>
      <h1>People</h1>
      {error && <p role="alert">{error}</p>}
      {!error && people === null && <p>Loading…</p>}
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
    </Layout>
  );
}

export default PeopleIndex;
