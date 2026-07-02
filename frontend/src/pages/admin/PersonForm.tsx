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
} from "../../api/admin";
import type { Photo, PersonCreate, PersonUpdate } from "../../api/types";
import { useAuth } from "../../auth/AuthContext";
import AdminLayout from "../../components/AdminLayout";
import AdminPhotoGrid from "../../components/AdminPhotoGrid";
import { useT } from "../../i18n/LangContext";

function PersonForm() {
  const t = useT();
  const { slug } = useParams();
  const navigate = useNavigate();
  const { clearAuth } = useAuth();
  const isEdit = slug !== undefined;

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [deathYear, setDeathYear] = useState("");
  const [birthplace, setBirthplace] = useState("");
  const [profession, setProfession] = useState("");
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    getPerson(slug)
      .then((detail) => {
        const p = detail.person;
        setDisplayName(p.display_name);
        setBio(p.bio ?? "");
        setBirthYear(p.birth_year !== null ? String(p.birth_year) : "");
        setDeathYear(p.death_year !== null ? String(p.death_year) : "");
        setBirthplace(p.birthplace ?? "");
        setProfession(p.profession ?? "");
        setProfileImageUrl(p.profile_image_url);
        setPhotos(detail.photos);
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
      .then((detail) => setPhotos(detail.photos))
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

    const toYear = (raw: string): number | null | "invalid" => {
      const v = raw.trim();
      if (v === "") return null;
      const n = Number(v);
      return Number.isNaN(n) ? "invalid" : n;
    };

    const birth = toYear(birthYear);
    const death = toYear(deathYear);
    if (birth === "invalid" || death === "invalid") {
      setError(t("admin.error.invalidYear"));
      return;
    }

    const payload: PersonCreate & PersonUpdate = {
      display_name: name,
      bio: toNullable(bio),
      birth_year: birth,
      death_year: death,
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
        setBirthYear(p.birth_year !== null ? String(p.birth_year) : "");
        setDeathYear(p.death_year !== null ? String(p.death_year) : "");
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
          {t("admin.field.birthYear")}
          <input
            type="text"
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value)}
          />
        </label>
        <label>
          {t("admin.field.deathYear")}
          <input
            type="text"
            value={deathYear}
            onChange={(e) => setDeathYear(e.target.value)}
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
        <AdminPhotoGrid
          slug={slug}
          photos={photos}
          onDeletePhoto={deletePersonPhoto}
          onUpload={uploadPersonPhotos}
          onUpdateCaption={updatePhotoCaption}
          onChanged={refetchPhotos}
        />
      )}
    </AdminLayout>
  );
}

export default PersonForm;
