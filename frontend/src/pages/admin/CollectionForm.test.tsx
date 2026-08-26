// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import CollectionForm from "./CollectionForm";
import { LangProvider } from "../../i18n/LangContext";
import { getCollection } from "../../api/client";
import {
  createCollection,
  updateCollection,
  deleteCollectionPhoto,
} from "../../api/admin";
import type { AuthError } from "../../api/auth";
import type { CollectionDetail, CollectionDetailData } from "../../api/types";

vi.mock("../../api/client", () => ({ getCollection: vi.fn() }));
vi.mock("../../api/admin", () => ({
  createCollection: vi.fn(),
  updateCollection: vi.fn(),
  deleteCollectionPhoto: vi.fn(),
  uploadCollectionPhotos: vi.fn(),
  updateCollectionPhotoCaption: vi.fn(),
  reorderCollectionPhotos: vi.fn(),
  setCollectionPhotoFolder: vi.fn(),
  createCollectionFolder: vi.fn(),
  deleteCollectionFolder: vi.fn(),
  reorderCollectionFolders: vi.fn(),
}));

const { clearAuth } = vi.hoisted(() => ({ clearAuth: vi.fn() }));
vi.mock("../../auth/AuthContext", () => ({
  useAuth: () => ({
    authed: true,
    login: vi.fn(),
    logout: vi.fn(),
    clearAuth,
  }),
}));

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigate };
});

const mockedGetCollection = vi.mocked(getCollection);
const mockedCreateCollection = vi.mocked(createCollection);
const mockedUpdateCollection = vi.mocked(updateCollection);
const mockedDeleteCollectionPhoto = vi.mocked(deleteCollectionPhoto);

const created: CollectionDetailData = {
  id: 5,
  slug: "new-suku",
  name: "Suku",
  info: null,
  profile_image: null,
  profile_image_url: null,
};

const detail: CollectionDetail = {
  collection: {
    id: 9,
    slug: "foo",
    name: "Foo Collection",
    info: "Desc",
    profile_image: null,
    profile_image_url: null,
  },
  photos: [
    {
      id: 7,
      filename: "c1.jpg",
      caption: "Reunion",
      uploaded_at: "2026-01-01T00:00:00Z",
      url: "/media/collections/foo/c1.jpg",
      folder_id: null,
    },
  ],
  folders: [],
};

function renderCreate() {
  return render(
    <MemoryRouter initialEntries={["/admin/collections/new"]}>
      <LangProvider>
        <Routes>
          <Route path="/admin/collections/new" element={<CollectionForm />} />
        </Routes>
      </LangProvider>
    </MemoryRouter>,
  );
}

function renderEdit() {
  return render(
    <MemoryRouter initialEntries={["/admin/collections/foo/edit"]}>
      <LangProvider>
        <Routes>
          <Route
            path="/admin/collections/:slug/edit"
            element={<CollectionForm />}
          />
        </Routes>
      </LangProvider>
    </MemoryRouter>,
  );
}

const setInput = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const submit = () =>
  fireEvent.click(screen.getByRole("button", { name: "Tallenna" }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("CollectionForm - create", () => {
  it("has ONLY name + info fields (no person/event facts)", () => {
    renderCreate();

    expect(screen.getByLabelText("Nimi")).toBeTruthy();
    expect(screen.getByLabelText("Kuvaus")).toBeTruthy();
    // Facts that exist on the Person form must NOT be present here.
    expect(screen.queryByLabelText("Syntymäaika")).toBeNull();
    expect(screen.queryByLabelText("Ammatti")).toBeNull();
    expect(screen.queryByLabelText("Profiilikuva")).toBeNull();
  });

  it("sends {name, info} and navigates to the edit route", async () => {
    mockedCreateCollection.mockResolvedValue(created);

    renderCreate();

    setInput("Nimi", "Suku");
    setInput("Kuvaus", "Family album");
    submit();

    await waitFor(() =>
      expect(mockedCreateCollection).toHaveBeenCalledTimes(1),
    );
    const payload = mockedCreateCollection.mock.calls[0][0];
    expect(payload.name).toBe("Suku");
    expect(payload.info).toBe("Family album");
    expect(navigate).toHaveBeenCalledWith("/admin/collections/new-suku/edit");
  });

  it("blocks submit and shows the name-required alert when name is blank (falsifiability)", async () => {
    renderCreate();

    submit();

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(mockedCreateCollection).not.toHaveBeenCalled();
  });
});

describe("CollectionForm - edit", () => {
  it("seeds the form and deletes the collection photo via the collection endpoint", async () => {
    mockedGetCollection.mockResolvedValue(detail);
    mockedUpdateCollection.mockResolvedValue(detail.collection);
    mockedDeleteCollectionPhoto.mockResolvedValue({ deleted: true });
    vi.spyOn(window, "confirm").mockReturnValue(true);

    renderEdit();

    // Form seeded from the fetched collection.
    await screen.findByDisplayValue("Foo Collection");
    expect(screen.getByDisplayValue("Desc")).toBeTruthy();

    // The grid rendered with the fixture photo.
    await waitFor(() => {
      const srcs = Array.from(document.querySelectorAll("img")).map((i) =>
        i.getAttribute("src"),
      );
      expect(srcs).toContain("/media/collections/foo/c1.jpg");
    });

    fireEvent.click(screen.getByRole("button", { name: "Poista" }));
    await waitFor(() =>
      expect(mockedDeleteCollectionPhoto).toHaveBeenCalledWith("foo", 7),
    );

    const beforeSave = mockedGetCollection.mock.calls.length;
    setInput("Nimi", "Foo Renamed");
    submit();

    await waitFor(() =>
      expect(mockedUpdateCollection).toHaveBeenCalledWith(
        "foo",
        expect.objectContaining({ name: "Foo Renamed" }),
      ),
    );
    // Saving triggers a refetch.
    await waitFor(() =>
      expect(mockedGetCollection.mock.calls.length).toBeGreaterThan(beforeSave),
    );
  });

  it("shows the generic alert when the initial load rejects", async () => {
    mockedGetCollection.mockRejectedValue(new Error("boom"));

    renderEdit();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Jotain meni pieleen.");
  });

  it("calls clearAuth once when updateCollection rejects with 401", async () => {
    mockedGetCollection.mockResolvedValue(detail);
    const err = { status: 401 } as AuthError;
    mockedUpdateCollection.mockRejectedValue(err);

    renderEdit();
    await screen.findByDisplayValue("Foo Collection");

    submit();

    await waitFor(() => expect(clearAuth).toHaveBeenCalledTimes(1));
  });
});
