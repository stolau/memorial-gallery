import type { AuthError } from "./auth";
import type {
  PersonDetailData,
  Event,
  Folder,
  PersonCreate,
  PersonUpdate,
  EventCreate,
  EventUpdate,
  CollectionDetailData,
  CollectionCreate,
  CollectionUpdate,
  Contact,
  ContactCreate,
  ContactUpdate,
  FamilyLine,
  FamilyLineCreate,
  FamilyLineUpdate,
  UploadResult,
  CaptionUpdated,
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

export function updatePhotoCaption(
  slug: string,
  id: number,
  caption: string | null,
): Promise<CaptionUpdated> {
  return sendJson(
    "PATCH",
    `/api/people/${encodeURIComponent(slug)}/photos/${id}`,
    { caption },
  );
}

export function updateEventPhotoCaption(
  slug: string,
  id: number,
  caption: string | null,
): Promise<CaptionUpdated> {
  return sendJson(
    "PATCH",
    `/api/events/${encodeURIComponent(slug)}/photos/${id}`,
    { caption },
  );
}

export function setPhotoFolder(
  slug: string,
  id: number,
  folderId: number | null,
): Promise<CaptionUpdated> {
  return sendJson(
    "PATCH",
    `/api/people/${encodeURIComponent(slug)}/photos/${id}`,
    { folder_id: folderId },
  );
}

export function createFolder(slug: string, name: string): Promise<Folder> {
  return sendJson("POST", `/api/people/${encodeURIComponent(slug)}/folders`, {
    name,
  });
}

export function deleteFolder(slug: string, id: number): Promise<Deleted> {
  return sendDelete(`/api/people/${encodeURIComponent(slug)}/folders/${id}`);
}

export function reorderFolders(
  slug: string,
  ids: number[],
): Promise<CaptionUpdated> {
  return sendJson(
    "PUT",
    `/api/people/${encodeURIComponent(slug)}/folders/order`,
    { order: ids },
  );
}

export function reorderPersonPhotos(
  slug: string,
  ids: number[],
): Promise<CaptionUpdated> {
  return sendJson(
    "PUT",
    `/api/people/${encodeURIComponent(slug)}/photos/order`,
    { order: ids },
  );
}

export function reorderEventPhotos(
  slug: string,
  ids: number[],
): Promise<CaptionUpdated> {
  return sendJson(
    "PUT",
    `/api/events/${encodeURIComponent(slug)}/photos/order`,
    { order: ids },
  );
}

// --- Collections ----------------------------------------------------------

export function createCollection(
  data: CollectionCreate,
): Promise<CollectionDetailData> {
  return sendJson("POST", "/api/collections", data);
}

export function updateCollection(
  slug: string,
  data: CollectionUpdate,
): Promise<CollectionDetailData> {
  return sendJson("PUT", `/api/collections/${encodeURIComponent(slug)}`, data);
}

export function deleteCollection(slug: string): Promise<Deleted> {
  return sendDelete(`/api/collections/${encodeURIComponent(slug)}`);
}

export function uploadCollectionPhotos(
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
  return sendForm(
    "POST",
    `/api/collections/${encodeURIComponent(slug)}/photos`,
    form,
  );
}

export function deleteCollectionPhoto(slug: string, id: number): Promise<Deleted> {
  return sendDelete(`/api/collections/${encodeURIComponent(slug)}/photos/${id}`);
}

export function updateCollectionPhotoCaption(
  slug: string,
  id: number,
  caption: string | null,
): Promise<CaptionUpdated> {
  return sendJson(
    "PATCH",
    `/api/collections/${encodeURIComponent(slug)}/photos/${id}`,
    { caption },
  );
}

export function setCollectionPhotoFolder(
  slug: string,
  id: number,
  folderId: number | null,
): Promise<CaptionUpdated> {
  return sendJson(
    "PATCH",
    `/api/collections/${encodeURIComponent(slug)}/photos/${id}`,
    { folder_id: folderId },
  );
}

export function reorderCollectionPhotos(
  slug: string,
  ids: number[],
): Promise<CaptionUpdated> {
  return sendJson(
    "PUT",
    `/api/collections/${encodeURIComponent(slug)}/photos/order`,
    { order: ids },
  );
}

export function createCollectionFolder(
  slug: string,
  name: string,
): Promise<Folder> {
  return sendJson(
    "POST",
    `/api/collections/${encodeURIComponent(slug)}/folders`,
    { name },
  );
}

export function deleteCollectionFolder(
  slug: string,
  id: number,
): Promise<Deleted> {
  return sendDelete(`/api/collections/${encodeURIComponent(slug)}/folders/${id}`);
}

export function reorderCollectionFolders(
  slug: string,
  ids: number[],
): Promise<CaptionUpdated> {
  return sendJson(
    "PUT",
    `/api/collections/${encodeURIComponent(slug)}/folders/order`,
    { order: ids },
  );
}

// --- Contacts -------------------------------------------------------------

export function createContact(data: ContactCreate): Promise<Contact> {
  return sendJson("POST", "/api/contacts", data);
}

export function updateContact(id: number, data: ContactUpdate): Promise<Contact> {
  return sendJson("PUT", `/api/contacts/${id}`, data);
}

export function deleteContact(id: number): Promise<Deleted> {
  return sendDelete(`/api/contacts/${id}`);
}

export function reorderContacts(ids: number[]): Promise<CaptionUpdated> {
  return sendJson("PUT", "/api/contacts/order", { order: ids });
}

// --- Family lines ---------------------------------------------------------

export function createFamilyLine(data: FamilyLineCreate): Promise<FamilyLine> {
  return sendJson("POST", "/api/family-lines", data);
}

export function updateFamilyLine(
  slug: string,
  data: FamilyLineUpdate,
): Promise<FamilyLine> {
  return sendJson("PUT", `/api/family-lines/${encodeURIComponent(slug)}`, data);
}

export function deleteFamilyLine(slug: string): Promise<Deleted> {
  return sendDelete(`/api/family-lines/${encodeURIComponent(slug)}`);
}

export function addFamilyLineMember(
  slug: string,
  personSlug: string,
): Promise<FamilyLine> {
  return sendJson(
    "POST",
    `/api/family-lines/${encodeURIComponent(slug)}/members`,
    { person_slug: personSlug },
  );
}

export function removeFamilyLineMember(
  slug: string,
  personId: number,
): Promise<FamilyLine> {
  return sendDelete(
    `/api/family-lines/${encodeURIComponent(slug)}/members/${personId}`,
  );
}

export function reorderFamilyLineMembers(
  slug: string,
  personIds: number[],
): Promise<FamilyLine> {
  return sendJson(
    "PUT",
    `/api/family-lines/${encodeURIComponent(slug)}/members/order`,
    { order: personIds },
  );
}
