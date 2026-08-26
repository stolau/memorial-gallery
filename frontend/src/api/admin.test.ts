import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createPerson,
  updatePerson,
  deletePerson,
  createEvent,
  updateEvent,
  deleteEvent,
  uploadPersonPhotos,
  uploadEventPhotos,
  setPersonProfileImage,
  removePersonProfileImage,
  deletePersonPhoto,
  deleteEventPhoto,
  updatePhotoCaption,
  updateEventPhotoCaption,
  createCollection,
  updateCollection,
  deleteCollection,
  uploadCollectionPhotos,
  deleteCollectionPhoto,
  updateCollectionPhotoCaption,
  setCollectionPhotoFolder,
  reorderCollectionPhotos,
  createCollectionFolder,
  deleteCollectionFolder,
  reorderCollectionFolders,
  createContact,
  updateContact,
  deleteContact,
  reorderContacts,
  createFamilyLine,
  updateFamilyLine,
  deleteFamilyLine,
  addFamilyLineMember,
  removeFamilyLineMember,
  reorderFamilyLineMembers,
} from "./admin";
import type { AuthError } from "./auth";

afterEach(() => {
  vi.restoreAllMocks();
});

function mockOk(body: unknown = {}) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: true,
    json: async () => body,
  } as Response);
}

function lastCall(fetchMock: ReturnType<typeof mockOk>) {
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [path, options] = fetchMock.mock.calls[0];
  return { path: path as string, options: options as RequestInit };
}

describe("admin api - JSON functions", () => {
  it("createPerson() POSTs JSON to /api/people with credentials:include", async () => {
    const fetchMock = mockOk({ slug: "new-guy" });
    await createPerson({ display_name: "New Guy" });

    const { path, options } = lastCall(fetchMock);
    expect(path).toBe("/api/people");
    expect(options).toMatchObject({
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    expect(options.body).toBe(JSON.stringify({ display_name: "New Guy" }));
  });

  it("updatePerson() PUTs JSON to /api/people/<slug> (slug encoded)", async () => {
    const fetchMock = mockOk({ slug: "a b" });
    await updatePerson("a b", { bio: "hi" });

    const { path, options } = lastCall(fetchMock);
    expect(path).toBe("/api/people/a%20b");
    expect(options).toMatchObject({
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    expect(options.body).toBe(JSON.stringify({ bio: "hi" }));
  });

  it("deletePerson() DELETEs /api/people/<slug> (slug encoded), no body", async () => {
    const fetchMock = mockOk({ deleted: true });
    await deletePerson("weird/slug");

    const { path, options } = lastCall(fetchMock);
    expect(path).toBe("/api/people/weird%2Fslug");
    expect(options).toMatchObject({ method: "DELETE", credentials: "include" });
    expect(options.body).toBeUndefined();
  });

  it("createEvent() POSTs JSON to /api/events", async () => {
    const fetchMock = mockOk({ slug: "gala" });
    await createEvent({ name: "Gala" });

    const { path, options } = lastCall(fetchMock);
    expect(path).toBe("/api/events");
    expect(options).toMatchObject({
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    expect(options.body).toBe(JSON.stringify({ name: "Gala" }));
  });

  it("updateEvent() PUTs JSON to /api/events/<slug> (slug encoded)", async () => {
    const fetchMock = mockOk({ slug: "p arty" });
    await updateEvent("p arty", { description: "d" });

    const { path, options } = lastCall(fetchMock);
    expect(path).toBe("/api/events/p%20arty");
    expect(options).toMatchObject({
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    expect(options.body).toBe(JSON.stringify({ description: "d" }));
  });

  it("deleteEvent() DELETEs /api/events/<slug> (slug encoded)", async () => {
    const fetchMock = mockOk({ deleted: true });
    await deleteEvent("party");

    const { path, options } = lastCall(fetchMock);
    expect(path).toBe("/api/events/party");
    expect(options).toMatchObject({ method: "DELETE", credentials: "include" });
  });

  it("deletePersonPhoto() DELETEs /api/people/<slug>/photos/<id>", async () => {
    const fetchMock = mockOk({ deleted: true });
    await deletePersonPhoto("ka levi", 7);

    const { path, options } = lastCall(fetchMock);
    expect(path).toBe("/api/people/ka%20levi/photos/7");
    expect(options).toMatchObject({ method: "DELETE", credentials: "include" });
  });

  it("deleteEventPhoto() DELETEs /api/events/<slug>/photos/<id>", async () => {
    const fetchMock = mockOk({ deleted: true });
    await deleteEventPhoto("par ty", 9);

    const { path, options } = lastCall(fetchMock);
    expect(path).toBe("/api/events/par%20ty/photos/9");
    expect(options).toMatchObject({ method: "DELETE", credentials: "include" });
  });

  it("updatePhotoCaption() PATCHes JSON to /api/people/<slug>/photos/<id> (slug encoded)", async () => {
    const fetchMock = mockOk({ ok: true });
    await updatePhotoCaption("some slug", 7, "hi");

    const { path, options } = lastCall(fetchMock);
    expect(path).toBe("/api/people/some%20slug/photos/7");
    expect(options).toMatchObject({
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    expect(options.body).toBe(JSON.stringify({ caption: "hi" }));
  });

  it("updateEventPhotoCaption() PATCHes JSON to /api/events/<slug>/photos/<id> (slug encoded)", async () => {
    const fetchMock = mockOk({ ok: true });
    await updateEventPhotoCaption("some slug", 7, "hi");

    const { path, options } = lastCall(fetchMock);
    expect(path).toBe("/api/events/some%20slug/photos/7");
    expect(options).toMatchObject({
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    expect(options.body).toBe(JSON.stringify({ caption: "hi" }));
  });
});

describe("admin api - collections + contact", () => {
  it("createCollection() POSTs JSON to /api/collections", async () => {
    const fetchMock = mockOk({ slug: "suku" });
    await createCollection({ name: "Suku", info: "hi" });

    const { path, options } = lastCall(fetchMock);
    expect(path).toBe("/api/collections");
    expect(options).toMatchObject({
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    expect(options.body).toBe(JSON.stringify({ name: "Suku", info: "hi" }));
  });

  it("updateCollection() PUTs JSON to /api/collections/<slug> (slug encoded)", async () => {
    const fetchMock = mockOk({ slug: "the suku" });
    await updateCollection("the suku", { info: "d" });

    const { path, options } = lastCall(fetchMock);
    expect(path).toBe("/api/collections/the%20suku");
    expect(options).toMatchObject({ method: "PUT", credentials: "include" });
    expect(options.body).toBe(JSON.stringify({ info: "d" }));
  });

  it("deleteCollection() DELETEs /api/collections/<slug>", async () => {
    const fetchMock = mockOk({ deleted: true });
    await deleteCollection("suku");

    const { path, options } = lastCall(fetchMock);
    expect(path).toBe("/api/collections/suku");
    expect(options).toMatchObject({ method: "DELETE", credentials: "include" });
  });

  it("deleteCollectionPhoto() DELETEs /api/collections/<slug>/photos/<id>", async () => {
    const fetchMock = mockOk({ deleted: true });
    await deleteCollectionPhoto("su ku", 7);

    const { path, options } = lastCall(fetchMock);
    expect(path).toBe("/api/collections/su%20ku/photos/7");
    expect(options).toMatchObject({ method: "DELETE", credentials: "include" });
  });

  it("updateCollectionPhotoCaption() PATCHes {caption}", async () => {
    const fetchMock = mockOk({ ok: true });
    await updateCollectionPhotoCaption("suku", 7, "hi");

    const { path, options } = lastCall(fetchMock);
    expect(path).toBe("/api/collections/suku/photos/7");
    expect(options).toMatchObject({ method: "PATCH", credentials: "include" });
    expect(options.body).toBe(JSON.stringify({ caption: "hi" }));
  });

  it("setCollectionPhotoFolder() PATCHes {folder_id}", async () => {
    const fetchMock = mockOk({ ok: true });
    await setCollectionPhotoFolder("suku", 7, 3);

    const { path, options } = lastCall(fetchMock);
    expect(path).toBe("/api/collections/suku/photos/7");
    expect(options.body).toBe(JSON.stringify({ folder_id: 3 }));
  });

  it("reorderCollectionPhotos() PUTs {order} to /photos/order", async () => {
    const fetchMock = mockOk({ ok: true });
    await reorderCollectionPhotos("suku", [3, 1, 2]);

    const { path, options } = lastCall(fetchMock);
    expect(path).toBe("/api/collections/suku/photos/order");
    expect(options.body).toBe(JSON.stringify({ order: [3, 1, 2] }));
  });

  it("createCollectionFolder() POSTs {name} to /folders", async () => {
    const fetchMock = mockOk({ id: 1, name: "Album" });
    await createCollectionFolder("suku", "Album");

    const { path, options } = lastCall(fetchMock);
    expect(path).toBe("/api/collections/suku/folders");
    expect(options.body).toBe(JSON.stringify({ name: "Album" }));
  });

  it("deleteCollectionFolder() DELETEs /folders/<id>", async () => {
    const fetchMock = mockOk({ deleted: true });
    await deleteCollectionFolder("suku", 4);

    const { path, options } = lastCall(fetchMock);
    expect(path).toBe("/api/collections/suku/folders/4");
    expect(options).toMatchObject({ method: "DELETE", credentials: "include" });
  });

  it("reorderCollectionFolders() PUTs {order} to /folders/order", async () => {
    const fetchMock = mockOk({ ok: true });
    await reorderCollectionFolders("suku", [2, 1]);

    const { path, options } = lastCall(fetchMock);
    expect(path).toBe("/api/collections/suku/folders/order");
    expect(options.body).toBe(JSON.stringify({ order: [2, 1] }));
  });

  it("createContact() POSTs JSON to /api/contacts", async () => {
    const fetchMock = mockOk({ id: 1 });
    await createContact({ name: "A", email: "a@example.com" });

    const { path, options } = lastCall(fetchMock);
    expect(path).toBe("/api/contacts");
    expect(options).toMatchObject({ method: "POST", credentials: "include" });
    expect(options.body).toBe(
      JSON.stringify({ name: "A", email: "a@example.com" }),
    );
  });

  it("updateContact() PUTs JSON to /api/contacts/<id>", async () => {
    const fetchMock = mockOk({ id: 5 });
    await updateContact(5, { role: "Admin" });

    const { path, options } = lastCall(fetchMock);
    expect(path).toBe("/api/contacts/5");
    expect(options).toMatchObject({ method: "PUT", credentials: "include" });
    expect(options.body).toBe(JSON.stringify({ role: "Admin" }));
  });

  it("deleteContact() DELETEs /api/contacts/<id>", async () => {
    const fetchMock = mockOk({ deleted: true });
    await deleteContact(5);

    const { path, options } = lastCall(fetchMock);
    expect(path).toBe("/api/contacts/5");
    expect(options).toMatchObject({ method: "DELETE", credentials: "include" });
  });

  it("reorderContacts() PUTs {order} to /api/contacts/order", async () => {
    const fetchMock = mockOk({ ok: true });
    await reorderContacts([3, 1, 2]);

    const { path, options } = lastCall(fetchMock);
    expect(path).toBe("/api/contacts/order");
    expect(options.body).toBe(JSON.stringify({ order: [3, 1, 2] }));
  });
});

describe("admin api - family lines", () => {
  it("createFamilyLine() POSTs JSON to /api/family-lines", async () => {
    const fetchMock = mockOk({ slug: "suku" });
    await createFamilyLine({ name: "Suku", year_range: "1850–" });

    const { path, options } = lastCall(fetchMock);
    expect(path).toBe("/api/family-lines");
    expect(options).toMatchObject({ method: "POST", credentials: "include" });
    expect(options.body).toBe(
      JSON.stringify({ name: "Suku", year_range: "1850–" }),
    );
  });

  it("updateFamilyLine() PUTs JSON to /api/family-lines/<slug> (slug encoded)", async () => {
    const fetchMock = mockOk({ slug: "the suku" });
    await updateFamilyLine("the suku", { note: "x" });

    const { path, options } = lastCall(fetchMock);
    expect(path).toBe("/api/family-lines/the%20suku");
    expect(options).toMatchObject({ method: "PUT", credentials: "include" });
    expect(options.body).toBe(JSON.stringify({ note: "x" }));
  });

  it("deleteFamilyLine() DELETEs /api/family-lines/<slug>", async () => {
    const fetchMock = mockOk({ deleted: true });
    await deleteFamilyLine("suku");

    const { path, options } = lastCall(fetchMock);
    expect(path).toBe("/api/family-lines/suku");
    expect(options).toMatchObject({ method: "DELETE", credentials: "include" });
  });

  it("addFamilyLineMember() POSTs {person_slug} to /members", async () => {
    const fetchMock = mockOk({ slug: "suku", members: [] });
    await addFamilyLineMember("suku", "kalevi");

    const { path, options } = lastCall(fetchMock);
    expect(path).toBe("/api/family-lines/suku/members");
    expect(options).toMatchObject({ method: "POST", credentials: "include" });
    expect(options.body).toBe(JSON.stringify({ person_slug: "kalevi" }));
  });

  it("removeFamilyLineMember() DELETEs /members/<personId>", async () => {
    const fetchMock = mockOk({ slug: "suku", members: [] });
    await removeFamilyLineMember("suku", 7);

    const { path, options } = lastCall(fetchMock);
    expect(path).toBe("/api/family-lines/suku/members/7");
    expect(options).toMatchObject({ method: "DELETE", credentials: "include" });
  });

  it("reorderFamilyLineMembers() PUTs {order} to /members/order", async () => {
    const fetchMock = mockOk({ slug: "suku", members: [] });
    await reorderFamilyLineMembers("suku", [2, 1]);

    const { path, options } = lastCall(fetchMock);
    expect(path).toBe("/api/family-lines/suku/members/order");
    expect(options.body).toBe(JSON.stringify({ order: [2, 1] }));
  });
});

describe("admin api - multipart functions", () => {
  function fakeFile(name: string): File {
    return new File([new Uint8Array([1, 2, 3])], name, { type: "image/jpeg" });
  }

  it("uploadPersonPhotos() POSTs FormData with NO Content-Type header", async () => {
    const fetchMock = mockOk({ saved: 1, skipped: 0 });
    await uploadPersonPhotos("ka levi", [fakeFile("a.jpg")], "cap");

    const { path, options } = lastCall(fetchMock);
    expect(path).toBe("/api/people/ka%20levi/photos");
    expect(options).toMatchObject({ method: "POST", credentials: "include" });
    expect(options.body).toBeInstanceOf(FormData);
    // The browser must set the multipart boundary itself -> no explicit header.
    expect(options.headers).toBeUndefined();
    const form = options.body as FormData;
    expect(form.getAll("photos").length).toBe(1);
    expect(form.get("caption")).toBe("cap");
  });

  it("uploadEventPhotos() POSTs FormData with NO Content-Type header", async () => {
    const fetchMock = mockOk({ saved: 2, skipped: 0 });
    await uploadEventPhotos("party", [fakeFile("a.jpg"), fakeFile("b.jpg")]);

    const { path, options } = lastCall(fetchMock);
    expect(path).toBe("/api/events/party/photos");
    expect(options).toMatchObject({ method: "POST", credentials: "include" });
    expect(options.body).toBeInstanceOf(FormData);
    expect(options.headers).toBeUndefined();
    const form = options.body as FormData;
    expect(form.getAll("photos").length).toBe(2);
  });

  it("uploadCollectionPhotos() POSTs FormData with NO Content-Type header", async () => {
    const fetchMock = mockOk({ saved: 1, skipped: 0 });
    await uploadCollectionPhotos("su ku", [fakeFile("a.jpg")], "cap");

    const { path, options } = lastCall(fetchMock);
    expect(path).toBe("/api/collections/su%20ku/photos");
    expect(options).toMatchObject({ method: "POST", credentials: "include" });
    expect(options.body).toBeInstanceOf(FormData);
    expect(options.headers).toBeUndefined();
    const form = options.body as FormData;
    expect(form.getAll("photos").length).toBe(1);
    expect(form.get("caption")).toBe("cap");
  });

  it("setPersonProfileImage() PUTs FormData(profile_image) with NO Content-Type", async () => {
    const fetchMock = mockOk({ slug: "kalevi" });
    await setPersonProfileImage("kalevi", fakeFile("face.jpg"));

    const { path, options } = lastCall(fetchMock);
    expect(path).toBe("/api/people/kalevi/profile-image");
    expect(options).toMatchObject({ method: "PUT", credentials: "include" });
    expect(options.body).toBeInstanceOf(FormData);
    expect(options.headers).toBeUndefined();
    expect((options.body as FormData).get("profile_image")).toBeInstanceOf(File);
  });

  it("removePersonProfileImage() PUTs FormData(remove=true) with NO Content-Type", async () => {
    const fetchMock = mockOk({ slug: "kalevi" });
    await removePersonProfileImage("kalevi");

    const { path, options } = lastCall(fetchMock);
    expect(path).toBe("/api/people/kalevi/profile-image");
    expect(options).toMatchObject({ method: "PUT", credentials: "include" });
    expect(options.body).toBeInstanceOf(FormData);
    expect(options.headers).toBeUndefined();
    expect((options.body as FormData).get("remove")).toBe("true");
  });
});

describe("admin api - error propagation", () => {
  it("a JSON function throws AuthError with .status on a non-ok response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
    } as Response);

    await expect(updatePerson("nobody", { bio: "x" })).rejects.toMatchObject({
      status: 404,
    });

    let caught: AuthError | undefined;
    try {
      await deletePerson("nobody");
    } catch (e) {
      caught = e as AuthError;
    }
    expect(caught).toBeInstanceOf(Error);
    expect(caught?.status).toBe(404);
  });

  it("a multipart function throws AuthError with .status on a non-ok response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
    } as Response);

    const file = new File([new Uint8Array([1])], "a.jpg", { type: "image/jpeg" });
    await expect(uploadPersonPhotos("kalevi", [file])).rejects.toMatchObject({
      status: 401,
    });
  });

  it("a DELETE function throws AuthError with .status on a non-ok response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
    } as Response);

    await expect(deletePersonPhoto("kalevi", 1)).rejects.toMatchObject({
      status: 401,
    });
  });
});
