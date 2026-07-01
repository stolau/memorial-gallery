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
