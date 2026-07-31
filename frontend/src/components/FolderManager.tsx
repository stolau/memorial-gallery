import { useState } from "react";
import type { AuthError } from "../api/auth";
import type { Folder } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { useT } from "../i18n/LangContext";

interface FolderManagerProps {
  slug: string;
  folders: Folder[];
  onCreateFolder: (slug: string, name: string) => Promise<Folder>;
  onDeleteFolder: (slug: string, id: number) => Promise<{ deleted: boolean }>;
  onChanged: () => void;
}

function FolderManager({
  slug,
  folders,
  onCreateFolder,
  onDeleteFolder,
  onChanged,
}: FolderManagerProps) {
  const t = useT();
  const { clearAuth } = useAuth();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

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

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (trimmed === "") return;
    setError(null);
    try {
      await onCreateFolder(slug, trimmed);
      setName("");
      onChanged();
    } catch (err) {
      handleMutationError(err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm(t("admin.action.delete"))) return;
    setError(null);
    try {
      await onDeleteFolder(slug, id);
      onChanged();
    } catch (err) {
      handleMutationError(err);
    }
  };

  return (
    <section className="admin-section">
      <h2>{t("admin.folders.title")}</h2>
      {folders.length === 0 ? (
        <p>{t("admin.folders.empty")}</p>
      ) : (
        <ul className="admin-list">
          {folders.map((f) => (
            <li key={f.id}>
              <span>{f.name}</span>
              <div className="admin-row-actions">
                <button type="button" onClick={() => handleDelete(f.id)}>
                  {t("admin.action.delete")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="photo-upload">
        <label>
          {t("admin.folders.name")}
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <button type="button" onClick={handleCreate}>
          {t("admin.action.create")}
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}

export default FolderManager;
