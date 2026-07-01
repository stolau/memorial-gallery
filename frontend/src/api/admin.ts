import type { AuthError } from "./auth";
import type {
  PersonDetailData,
  Event,
  PersonCreate,
  PersonUpdate,
  EventCreate,
  EventUpdate,
  UploadResult,
} from "./types";

interface Deleted {
  deleted: boolean;
}

function failure(path: string, res: Response): AuthError {
  const err = new Error(
    `Request to ${path} failed: ${res.status} ${res.statusText}`,
  ) as AuthError;
  err.status = res.status;
  return err;
}

async function sendJson<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    throw failure(path, res);
  }
  return res.json() as Promise<T>;
}

async function sendForm<T>(method: string, path: string, form: FormData): Promise<T> {
  // No Content-Type header: the browser sets multipart boundary automatically.
  const res = await fetch(path, { method, credentials: "include", body: form });
  if (!res.ok) {
    throw failure(path, res);
  }
  return res.json() as Promise<T>;
}

async function sendDelete<T>(path: string): Promise<T> {
  const res = await fetch(path, { method: "DELETE", credentials: "include" });
  if (!res.ok) {
    throw failure(path, res);
  }
  return res.json() as Promise<T>;
}

export function createPerson(data: PersonCreate): Promise<PersonDetailData> {
  return sendJson("POST", "/api/people", data);
}

export function updatePerson(slug: string, data: PersonUpdate): Promise<PersonDetailData> {
  return sendJson("PUT", `/api/people/${encodeURIComponent(slug)}`, data);
}

export function deletePerson(slug: string): Promise<Deleted> {
  return sendDelete(`/api/people/${encodeURIComponent(slug)}`);
}

export function createEvent(data: EventCreate): Promise<Event> {
  return sendJson("POST", "/api/events", data);
}

export function updateEvent(slug: string, data: EventUpdate): Promise<Event> {
  return sendJson("PUT", `/api/events/${encodeURIComponent(slug)}`, data);
}

export function deleteEvent(slug: string): Promise<Deleted> {
  return sendDelete(`/api/events/${encodeURIComponent(slug)}`);
}

export function uploadPersonPhotos(
  slug: string,
  files: File[],
  caption?: string,
): Promise<UploadResult> {
  const form = new FormData();
  for (const file of files) {
    form.append("photos", file);
  }
  if (caption !== undefined) {
    form.append("caption", caption);
  }
  return sendForm("POST", `/api/people/${encodeURIComponent(slug)}/photos`, form);
}

export function uploadEventPhotos(
  slug: string,
  files: File[],
  caption?: string,
): Promise<UploadResult> {
  const form = new FormData();
  for (const file of files) {
    form.append("photos", file);
  }
  if (caption !== undefined) {
    form.append("caption", caption);
  }
  return sendForm("POST", `/api/events/${encodeURIComponent(slug)}/photos`, form);
}

export function setPersonProfileImage(slug: string, file: File): Promise<PersonDetailData> {
  const form = new FormData();
  form.append("profile_image", file);
  return sendForm("PUT", `/api/people/${encodeURIComponent(slug)}/profile-image`, form);
}

export function removePersonProfileImage(slug: string): Promise<PersonDetailData> {
  const form = new FormData();
  form.append("remove", "true");
  return sendForm("PUT", `/api/people/${encodeURIComponent(slug)}/profile-image`, form);
}

export function deletePersonPhoto(slug: string, id: number): Promise<Deleted> {
  return sendDelete(`/api/people/${encodeURIComponent(slug)}/photos/${id}`);
}

export function deleteEventPhoto(slug: string, id: number): Promise<Deleted> {
  return sendDelete(`/api/events/${encodeURIComponent(slug)}/photos/${id}`);
}
