import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getCollections } from "../api/client";
import type { Collection } from "../api/types";
import Layout from "../components/Layout";
import { useT } from "../i18n/LangContext";

function CollectionsIndex() {
  const t = useT();
  const [collections, setCollections] = useState<Collection[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCollections()
      .then(setCollections)
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <Layout>
      <h1>{t("collections.title")}</h1>
      {error && <p role="alert">{error}</p>}
      {!error && collections === null && <p>{t("common.loading")}</p>}
      {collections && collections.length === 0 && (
        <p>{t("collections.empty")}</p>
      )}
      {collections && collections.length > 0 && (
        <ul className="collections-grid">
          {collections.map((collection) => (
            <li key={collection.slug}>
              <Link
                to={`/collections/${collection.slug}`}
                className="collection-card"
              >
                {collection.cover_url && (
                  <img
                    className="collection-card-img"
                    src={collection.cover_url}
                    alt={collection.name}
                  />
                )}
                <span className="collection-card-name">{collection.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Layout>
  );
}

export default CollectionsIndex;
