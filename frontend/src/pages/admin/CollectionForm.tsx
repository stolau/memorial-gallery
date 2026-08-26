import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { AuthError } from "../../api/auth";
import { getCollection } from "../../api/client";
import {
  createCollection,
  updateCollection,
  deleteCollectionPhoto,
  uploadCollectionPhotos,
  updateCollectionPhotoCaption,
  reorderCollectionPhotos,
  setCollectionPhotoFolder,
  createCollectionFolder,
  deleteCollectionFolder,
  reorderCollectionFolders,
} from "../../api/admin";
import type {
  Folder,
  Photo,
  CollectionCreate,
  CollectionUpdate,
} from "../../api/types";
import { useAuth } from "../../auth/AuthContext";
import AdminLayout from "../../components/AdminLayout";
import AdminPhotoGrid from "../../components/AdminPhotoGrid";
import { useT } from "../../i18n/LangContext";

function CollectionForm() {
  const t = useT();
  const { slug } = useParams();
  const navigate = useNavigate();
  const { clearAuth } = useAuth();
  const isEdit = slug !== undefined;

  const [name, setName] = useState("");
  const [info, setInfo] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    getCollection(slug)
      .then((detail) => {
        const c = detail.collection;
        setName(c.name);
        setInfo(c.info ?? "");
        setPhotos(detail.photos);
        setFolders(detail.folders);
      })
      // Client read errors carry no .status: treat as generic.
      .catch(() => setError(t("admin.error.generic")));
  }, [slug]);

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

  const refetchPhotos = () => {
    if (!slug) return;
    getCollection(slug)
      .then((detail) => {
        setPhotos(detail.photos);
        setFolders(detail.folders);
      })
      .catch(() => setError(t("admin.error.generic")));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (trimmedName === "") {
      setError(t("admin.error.nameRequired"));
      return;
    }

    const toNullable = (raw: string): string | null => {
      const v = raw.trim();
      return v === "" ? null : v;
    };

    const payload: CollectionCreate & CollectionUpdate = {
      name: trimmedName,
      info: toNullable(info),
    };

    try {
      if (isEdit && slug) {
        await updateCollection(slug, payload);
        const detail = await getCollection(slug);
        const c = detail.collection;
        setName(c.name);
        setInfo(c.info ?? "");
        setPhotos(detail.photos);
        setFolders(detail.folders);
      } else {
        const created = await createCollection(payload);
        navigate(`/admin/collections/${created.slug}/edit`);
      }
    } catch (err) {
      handleMutationError(err);
    }
  };

  return (
    <AdminLayout>
      <form className="admin-form" onSubmit={handleSubmit}>
        <label>
          {t("admin.field.name")}
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          {t("admin.field.info")}
          <textarea value={info} onChange={(e) => setInfo(e.target.value)} />
        </label>
        <button type="submit">{t("admin.action.save")}</button>
        {error && <p role="alert">{error}</p>}
      </form>
      {isEdit && slug && (
        <AdminPhotoGrid
          slug={slug}
          photos={photos}
          onDeletePhoto={deleteCollectionPhoto}
          onUpload={uploadCollectionPhotos}
          onUpdateCaption={updateCollectionPhotoCaption}
          onChanged={refetchPhotos}
          onReorder={reorderCollectionPhotos}
          folders={folders}
          onAssignFolder={setCollectionPhotoFolder}
          onCreateFolder={createCollectionFolder}
          onDeleteFolder={deleteCollectionFolder}
          onReorderFolders={reorderCollectionFolders}
        />
      )}
    </AdminLayout>
  );
}

export default CollectionForm;
