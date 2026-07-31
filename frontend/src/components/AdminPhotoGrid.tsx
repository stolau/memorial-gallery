import { useRef, useState } from "react";
import type { AuthError } from "../api/auth";
import type { Folder, Photo, UploadResult } from "../api/types";
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
  onReorder?: (slug: string, ids: number[]) => Promise<{ ok: boolean }>;
  folders?: Folder[];
  onAssignFolder?: (
    slug: string,
    id: number,
    folderId: number | null,
  ) => Promise<{ ok: boolean }>;
}

function AdminPhotoGrid({
  slug,
  photos,
  onDeletePhoto,
  onUpload,
  onUpdateCaption,
  onChanged,
  onReorder,
  folders,
  onAssignFolder,
}: AdminPhotoGridProps) {
  const t = useT();
  const { clearAuth } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
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

  const handleDrop = async (targetIndex: number) => {
    if (dragIndex === null) return;
    const from = dragIndex;
    setDragIndex(null);
    if (!onReorder || from === targetIndex) return;
    const ids = photos.map((p) => p.id);
    const [moved] = ids.splice(from, 1);
    ids.splice(targetIndex, 0, moved);
    setError(null);
    try {
      await onReorder(slug, ids);
      onChanged();
    } catch (err) {
      handleMutationError(err);
    }
  };

  const handleAssignFolder = async (id: number, raw: string) => {
    if (!onAssignFolder) return;
    setError(null);
    try {
      await onAssignFolder(slug, id, raw === "" ? null : Number(raw));
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
      {onReorder && photos.length > 1 && (
        <p className="drag-hint">{t("admin.photos.dragHint")}</p>
      )}
      <div className="photo-grid">
        {photos.map((p, i) => (
          <figure
            key={p.id}
            draggable={!!onReorder}
            className={dragIndex === i ? "dragging" : undefined}
            onDragStart={(e) => {
              // Firefox refuses to start a drag without data attached.
              e.dataTransfer?.setData("text/plain", String(p.id));
              setDragIndex(i);
            }}
            onDragEnd={() => setDragIndex(null)}
            onDragOver={(e) => {
              if (onReorder) e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              handleDrop(i);
            }}
          >
            <img
              src={p.url}
              alt={p.caption ?? ""}
              loading="lazy"
              decoding="async"
              width={600}
              height={400}
            />
            {p.caption && <figcaption>{p.caption}</figcaption>}
            {folders && onAssignFolder && (
              <label className="folder-select">
                {t("admin.folder.label")}
                <select
                  value={p.folder_id ?? ""}
                  onChange={(e) => handleAssignFolder(p.id, e.target.value)}
                >
                  <option value="">{t("admin.folder.none")}</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
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
