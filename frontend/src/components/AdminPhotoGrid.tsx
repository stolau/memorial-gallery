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
  onCreateFolder?: (slug: string, name: string) => Promise<Folder>;
  onDeleteFolder?: (slug: string, id: number) => Promise<{ deleted: boolean }>;
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
  onCreateFolder,
  onDeleteFolder,
}: AdminPhotoGridProps) {
  const t = useT();
  const { clearAuth } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [dragId, setDragId] = useState<number | null>(null);
  // Folder id or "back" while a dragged photo hovers that drop target.
  const [overTarget, setOverTarget] = useState<number | "back" | null>(null);
  const [openFolderId, setOpenFolderId] = useState<number | null>(null);
  const [addingFolder, setAddingFolder] = useState(false);
  const [folderName, setFolderName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const folderUi = folders !== undefined && !!onAssignFolder;
  // Guards against a stale id after the open folder was deleted elsewhere.
  const openFolder = folderUi
    ? folders!.find((f) => f.id === openFolderId)
    : undefined;

  // File-manager view: root shows unfoldered photos, an open folder its own.
  const shown = !folderUi
    ? photos
    : openFolder
      ? photos.filter((p) => p.folder_id === openFolder.id)
      : photos.filter((p) => p.folder_id == null);

  const countIn = (folderId: number) =>
    photos.filter((p) => p.folder_id === folderId).length;

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

  const handleDropOnPhoto = async (targetId: number) => {
    const src = dragId;
    setDragId(null);
    if (src === null || !onReorder || src === targetId) return;
    // Reorder within the visible subset, then merge back into the full
    // list so photos outside this view keep their positions.
    const visibleIds = shown.map((p) => p.id);
    const from = visibleIds.indexOf(src);
    const to = visibleIds.indexOf(targetId);
    if (from < 0 || to < 0) return;
    const reordered = [...visibleIds];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    let vi = 0;
    const ids = photos.map((p) =>
      visibleIds.includes(p.id) ? reordered[vi++] : p.id,
    );
    setError(null);
    try {
      await onReorder(slug, ids);
      onChanged();
    } catch (err) {
      handleMutationError(err);
    }
  };

  const handleDropOnFolder = async (folderId: number | null) => {
    setOverTarget(null);
    const src = dragId;
    setDragId(null);
    if (src === null || !onAssignFolder) return;
    const photo = photos.find((p) => p.id === src);
    if (!photo || (photo.folder_id ?? null) === folderId) return;
    setError(null);
    try {
      await onAssignFolder(slug, photo.id, folderId);
      onChanged();
    } catch (err) {
      handleMutationError(err);
    }
  };

  const handleCreateFolder = async () => {
    if (!onCreateFolder) return;
    const name = folderName.trim();
    if (name === "") return;
    setError(null);
    try {
      await onCreateFolder(slug, name);
      setFolderName("");
      setAddingFolder(false);
      onChanged();
    } catch (err) {
      handleMutationError(err);
    }
  };

  const handleDeleteFolder = async (id: number) => {
    if (!onDeleteFolder) return;
    if (!window.confirm(t("admin.action.delete"))) return;
    setError(null);
    try {
      await onDeleteFolder(slug, id);
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

  // Handlers that make an element accept a dragged photo.
  const dropTarget = (key: number | "back", folderId: number | null) => ({
    onDragOver: (e: React.DragEvent) => {
      if (dragId === null) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
      setOverTarget(key);
    },
    onDragLeave: () => setOverTarget(null),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      handleDropOnFolder(folderId);
    },
  });

  return (
    <div>
      {folderUi && !openFolder && (
        <div className="folder-grid">
          {folders!.map((f) => (
            <div
              key={f.id}
              role="button"
              tabIndex={0}
              className={
                "folder-card folder-drop" +
                (overTarget === f.id ? " drop-active" : "")
              }
              onClick={() => setOpenFolderId(f.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setOpenFolderId(f.id);
              }}
              {...dropTarget(f.id, f.id)}
            >
              {onDeleteFolder && (
                <button
                  type="button"
                  className="folder-delete"
                  aria-label={`${t("admin.action.delete")} ${f.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteFolder(f.id);
                  }}
                >
                  ×
                </button>
              )}
              <span className="folder-name">{f.name}</span>
              <span className="folder-count">{countIn(f.id)}</span>
            </div>
          ))}
          {onCreateFolder &&
            (addingFolder ? (
              <div className="folder-card folder-add">
                <input
                  type="text"
                  aria-label={t("admin.folders.name")}
                  value={folderName}
                  autoFocus
                  onChange={(e) => setFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateFolder();
                    if (e.key === "Escape") setAddingFolder(false);
                  }}
                />
                <button type="button" onClick={handleCreateFolder}>
                  {t("admin.action.create")}
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="folder-card folder-add"
                aria-label={t("admin.folders.new")}
                onClick={() => setAddingFolder(true)}
              >
                <span className="folder-plus">+</span>
              </button>
            ))}
        </div>
      )}
      {folderUi && openFolder && (
        <div className="folder-grid">
          <div
            role="button"
            tabIndex={0}
            className={
              "folder-card folder-unsort" +
              (overTarget === "back" ? " drop-active" : "")
            }
            onClick={() => setOpenFolderId(null)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setOpenFolderId(null);
            }}
            {...dropTarget("back", null)}
          >
            <span className="folder-name">← {t("folder.back")}</span>
          </div>
          <div className="folder-card folder-drop">
            <span className="folder-name">{openFolder.name}</span>
            <span className="folder-count">{countIn(openFolder.id)}</span>
          </div>
        </div>
      )}
      {onReorder && shown.length > 1 && (
        <p className="drag-hint">{t("admin.photos.dragHint")}</p>
      )}
      <div className="photo-grid">
        {shown.map((p) => (
          <figure
            key={p.id}
            draggable={!!onReorder || folderUi}
            className={dragId === p.id ? "dragging" : undefined}
            onDragStart={(e) => {
              // Firefox refuses to start a drag without data attached.
              e.dataTransfer?.setData("text/plain", String(p.id));
              if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
              setDragId(p.id);
            }}
            onDragEnd={() => setDragId(null)}
            onDragOver={(e) => {
              if (onReorder && dragId !== null) {
                e.preventDefault();
                if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              handleDropOnPhoto(p.id);
            }}
          >
            <img
              src={p.url}
              alt={p.caption ?? ""}
              loading="lazy"
              decoding="async"
              width={600}
              height={400}
              // The figure is the drag source; a draggable img would hijack
              // the gesture with the browser's native image drag.
              draggable={false}
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
