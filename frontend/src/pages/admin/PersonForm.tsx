import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { AuthError } from "../../api/auth";
import { getPerson } from "../../api/client";
import {
  createPerson,
  updatePerson,
  setPersonProfileImage,
  removePersonProfileImage,
  deletePersonPhoto,
  uploadPersonPhotos,
  updatePhotoCaption,
  createFolder,
  deleteFolder,
  setPhotoFolder,
  reorderPersonPhotos,
} from "../../api/admin";
import type { Folder, Photo, PersonCreate, PersonUpdate } from "../../api/types";
import { useAuth } from "../../auth/AuthContext";
import AdminLayout from "../../components/AdminLayout";
import AdminPhotoGrid from "../../components/AdminPhotoGrid";
import FolderManager from "../../components/FolderManager";
import { useT } from "../../i18n/LangContext";

function PersonForm() {
  const t = useT();
  const { slug } = useParams();
  const navigate = useNavigate();
  const { clearAuth } = useAuth();
  const isEdit = slug !== undefined;

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [deathDate, setDeathDate] = useState("");
  const [birthplace, setBirthplace] = useState("");
  const [profession, setProfession] = useState("");
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    getPerson(slug)
      .then((detail) => {
        const p = detail.person;
        setDisplayName(p.display_name);
        setBio(p.bio ?? "");
        setBirthDate(p.birth_date ?? "");
        setDeathDate(p.death_date ?? "");
        setBirthplace(p.birthplace ?? "");
        setProfession(p.profession ?? "");
        setProfileImageUrl(p.profile_image_url);
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
    getPerson(slug)
      .then((detail) => {
        setPhotos(detail.photos);
        setFolders(detail.folders);
      })
      .catch(() => setError(t("admin.error.generic")));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const name = displayName.trim();
    if (name === "") {
      setError(t("admin.error.nameRequired"));
      return;
    }

    const toNullable = (raw: string): string | null => {
      const v = raw.trim();
      return v === "" ? null : v;
    };

    const payload: PersonCreate & PersonUpdate = {
      display_name: name,
      bio: toNullable(bio),
      birth_date: toNullable(birthDate),
      death_date: toNullable(deathDate),
      birthplace: toNullable(birthplace),
      profession: toNullable(profession),
    };

    try {
      if (isEdit && slug) {
        await updatePerson(slug, payload);
        if (profileFile) {
          await setPersonProfileImage(slug, profileFile);
        } else if (removeImage) {
          await removePersonProfileImage(slug);
        }
        const detail = await getPerson(slug);
        const p = detail.person;
        setDisplayName(p.display_name);
        setBio(p.bio ?? "");
        setBirthDate(p.birth_date ?? "");
        setDeathDate(p.death_date ?? "");
        setBirthplace(p.birthplace ?? "");
        setProfession(p.profession ?? "");
        setProfileImageUrl(p.profile_image_url);
        setPhotos(detail.photos);
        setProfileFile(null);
        setRemoveImage(false);
      } else {
        const created = await createPerson(payload);
        if (profileFile) {
          await setPersonProfileImage(created.slug, profileFile);
        }
        navigate(`/admin/people/${created.slug}/edit`);
      }
    } catch (err) {
      handleMutationError(err);
    }
  };

  return (
    <AdminLayout>
      <form className="admin-form" onSubmit={handleSubmit}>
        <label>
          {t("admin.field.displayName")}
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </label>
        <label>
          {t("admin.field.bio")}
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} />
        </label>
        <label>
          {t("admin.field.birthDate")}
          <input
            type="text"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
          />
        </label>
        <label>
          {t("admin.field.deathDate")}
          <input
            type="text"
            value={deathDate}
            onChange={(e) => setDeathDate(e.target.value)}
          />
        </label>
        <label>
          {t("admin.field.birthplace")}
          <input
            type="text"
            value={birthplace}
            onChange={(e) => setBirthplace(e.target.value)}
          />
        </label>
        <label>
          {t("admin.field.profession")}
          <input
            type="text"
            value={profession}
            onChange={(e) => setProfession(e.target.value)}
          />
        </label>
        {profileImageUrl && (
          <img
            className="profile-img"
            src={profileImageUrl}
            alt={displayName}
          />
        )}
        <label>
          {t("admin.field.profileImage")}
          <input
            type="file"
            onChange={(e) =>
              setProfileFile(e.target.files?.[0] ?? null)
            }
          />
        </label>
        {isEdit && (
          <label className="admin-check">
            {t("admin.field.removeImage")}
            <input
              type="checkbox"
              checked={removeImage}
              onChange={(e) => setRemoveImage(e.target.checked)}
            />
          </label>
        )}
        <button type="submit">{t("admin.action.save")}</button>
        {error && <p role="alert">{error}</p>}
      </form>
      {isEdit && slug && (
        <>
          <FolderManager
            slug={slug}
            folders={folders}
            onCreateFolder={createFolder}
            onDeleteFolder={deleteFolder}
            onChanged={refetchPhotos}
          />
          <AdminPhotoGrid
            slug={slug}
            photos={photos}
            onDeletePhoto={deletePersonPhoto}
            onUpload={uploadPersonPhotos}
            onUpdateCaption={updatePhotoCaption}
            onChanged={refetchPhotos}
            onReorder={reorderPersonPhotos}
            folders={folders}
            onAssignFolder={setPhotoFolder}
          />
        </>
      )}
    </AdminLayout>
  );
}

export default PersonForm;
