import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getPerson } from "../api/client";
import type { PersonDetail } from "../api/types";
import Layout from "../components/Layout";
import PhotoGrid from "../components/PhotoGrid";

function PersonPage() {
  const { slug } = useParams();
  const [detail, setDetail] = useState<PersonDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    setDetail(null);
    setError(null);
    getPerson(slug)
      .then(setDetail)
      .catch((err: Error) => setError(err.message));
  }, [slug]);

  return (
    <Layout>
      {error && <p role="alert">{error}</p>}
      {!error && detail === null && <p>Loading…</p>}
      {detail && (
        <>
          <h1>{detail.person.display_name}</h1>
          {detail.person.profile_image_url && (
            <img
              className="profile-img"
              src={detail.person.profile_image_url}
              alt={detail.person.display_name}
            />
          )}
          {detail.person.bio && <p>{detail.person.bio}</p>}
          <ul>
            {detail.person.birth_year !== null && (
              <li>Born: {detail.person.birth_year}</li>
            )}
            {detail.person.death_year !== null && (
              <li>Died: {detail.person.death_year}</li>
            )}
            {detail.person.birthplace && (
              <li>Birthplace: {detail.person.birthplace}</li>
            )}
            {detail.person.profession && (
              <li>Profession: {detail.person.profession}</li>
            )}
          </ul>
          <PhotoGrid photos={detail.photos} />
        </>
      )}
    </Layout>
  );
}

export default PersonPage;
