import { useRef, useState } from "react";
import type { AuthError } from "../api/auth";
import type { Photo, UploadResult } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { useT } from "../i18n/LangContext";

interface AdminPhotoGridProps {
  slug: string;
  photos: Photo[];
  onDeletePhoto: (slug: string, id: number) => Promise<{ deleted: boolean }>;
  onUpload: (
    slug: string,
    files: File[],
    caption?: string,
  ) => Promise<UploadResult>;
  onUpdateCaption: (
    slug: string,
    id: number,
    caption: string | null,
  ) => Promise<{ ok: boolean }>;
  onChanged: () => void;
}

function AdminPhotoGrid({
  slug,
  photos,
  onDeletePhoto,
  onUpload,
  onUpdateCaption,
  onChanged,
}: AdminPhotoGridProps) {
  const t = useT();
  const { clearAuth } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleDelete = async (id: number) => {
    if (!window.confirm(t("admin.action.delete"))) return;
    setError(null);
    try {
      await onDeletePhoto(slug, id);
      onChanged();
    } catch (err) {
      handleMutationError(err);
    }
  };

  const handleSaveCaption = async (id: number) => {
    setError(null);
    try {
      await onUpdateCaption(slug, id, draft.trim() || null);
      setEditingId(null);
      onChanged();
    } catch (err) {
      handleMutationError(err);
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setError(null);
    try {
      await onUpload(slug, files, caption.trim() || undefined);
      setFiles([]);
      setCaption("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      onChanged();
    } catch (err) {
      handleMutationError(err);
    }
  };

  return (
    <div>
      <div className="photo-grid">
        {photos.map((p) => (
          <figure key={p.id}>
            <img
              src={p.url}
              alt={p.caption ?? ""}
              loading="lazy"
              decoding="async"
              width={640}
              height={480}
              style={{ aspectRatio: "4 / 3", width: "100%", height: "auto" }}
            />
            {p.caption && <figcaption>{p.caption}</figcaption>}
            {editingId === p.id ? (
              <>
                <input
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
                <button type="button" onClick={() => handleSaveCaption(p.id)}>
                  {t("admin.action.save")}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setEditingId(p.id);
                  setDraft(p.caption ?? "");
                }}
              >
                {t("admin.action.edit")}
              </button>
            )}
            <button type="button" onClick={() => handleDelete(p.id)}>
              {t("admin.action.delete")}
            </button>
          </figure>
        ))}
      </div>
      <div className="photo-upload">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={(e) =>
            setFiles(e.target.files ? Array.from(e.target.files) : [])
          }
        />
        <label>
          {t("admin.field.description")}
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
        </label>
        <button type="button" onClick={handleUpload}>
          {t("admin.action.upload")}
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

export default AdminPhotoGrid;
