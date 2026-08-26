import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { AuthError } from "../../api/auth";
import { getEvent } from "../../api/client";
import {
  createEvent,
  updateEvent,
  deleteEventPhoto,
  uploadEventPhotos,
  updateEventPhotoCaption,
  reorderEventPhotos,
} from "../../api/admin";
import type { Photo, EventCreate, EventUpdate, EventKind } from "../../api/types";
import { useAuth } from "../../auth/AuthContext";
import AdminLayout from "../../components/AdminLayout";
import AdminPhotoGrid from "../../components/AdminPhotoGrid";
import { useT } from "../../i18n/LangContext";

const EVENT_KINDS: EventKind[] = [
  "wedding",
  "christening",
  "funeral",
  "gathering",
];

function EventForm() {
  const t = useT();
  const { slug } = useParams();
  const navigate = useNavigate();
  const { clearAuth } = useAuth();
  const isEdit = slug !== undefined;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [place, setPlace] = useState("");
  const [kind, setKind] = useState<EventKind | "">("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    getEvent(slug)
      .then((detail) => {
        const ev = detail.event;
        setName(ev.name);
        setDescription(ev.description ?? "");
        setEventTime(ev.event_time ?? "");
        setPlace(ev.place ?? "");
        setKind(ev.kind ?? "");
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
    getEvent(slug)
      .then((detail) => setPhotos(detail.photos))
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

    const payload: EventCreate & EventUpdate = {
      name: trimmedName,
      description: toNullable(description),
      event_time: toNullable(eventTime),
      place: toNullable(place),
      kind: kind === "" ? null : kind,
    };

    try {
      if (isEdit && slug) {
        await updateEvent(slug, payload);
        const detail = await getEvent(slug);
        const ev = detail.event;
        setName(ev.name);
        setDescription(ev.description ?? "");
        setEventTime(ev.event_time ?? "");
        setPlace(ev.place ?? "");
        setKind(ev.kind ?? "");
        setPhotos(detail.photos);
      } else {
        const created = await createEvent(payload);
        navigate(`/admin/events/${created.slug}/edit`);
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
          {t("admin.field.description")}
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label>
          {t("admin.field.eventTime")}
          <input
            type="text"
            value={eventTime}
            onChange={(e) => setEventTime(e.target.value)}
          />
        </label>
        <label>
          {t("admin.field.place")}
          <input
            type="text"
            value={place}
            onChange={(e) => setPlace(e.target.value)}
          />
        </label>
        <label>
          {t("admin.field.eventKind")}
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as EventKind | "")}
          >
            <option value="">{t("admin.field.eventKindNone")}</option>
            {EVENT_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`kinds.${k}`)}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">{t("admin.action.save")}</button>
        {error && <p role="alert">{error}</p>}
      </form>
      {isEdit && slug && (
        <AdminPhotoGrid
          slug={slug}
          photos={photos}
          onDeletePhoto={deleteEventPhoto}
          onUpload={uploadEventPhotos}
          onUpdateCaption={updateEventPhotoCaption}
          onChanged={refetchPhotos}
          onReorder={reorderEventPhotos}
        />
      )}
    </AdminLayout>
  );
}

export default EventForm;
