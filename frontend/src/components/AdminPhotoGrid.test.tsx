// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LangProvider } from "../i18n/LangContext";
import AdminPhotoGrid from "./AdminPhotoGrid";
import type { AuthError } from "../api/auth";
import type { Folder, Photo, UploadResult } from "../api/types";

type DeleteFn = (slug: string, id: number) => Promise<{ deleted: boolean }>;
type UploadFn = (
  slug: string,
  files: File[],
  caption?: string,
) => Promise<UploadResult>;
type UpdateCaptionFn = (
  slug: string,
  id: number,
  caption: string | null,
) => Promise<{ ok: boolean }>;
type ReorderFn = (slug: string, ids: number[]) => Promise<{ ok: boolean }>;
type AssignFolderFn = (
  slug: string,
  id: number,
  folderId: number | null,
) => Promise<{ ok: boolean }>;
type CreateFolderFn = (slug: string, name: string) => Promise<Folder>;
type DeleteFolderFn = (
  slug: string,
  id: number,
) => Promise<{ deleted: boolean }>;

// useAuth is mocked so we can observe clearAuth() on a 401. LangContext stays
// real (wrapped in LangProvider) so the rendered text is the genuine fi copy.
const { clearAuth } = vi.hoisted(() => ({ clearAuth: vi.fn() }));
vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({
    authed: true,
    login: vi.fn(),
    logout: vi.fn(),
    clearAuth,
  }),
}));

const photos: Photo[] = [
  {
    id: 10,
    filename: "k1.jpg",
    caption: "At the lake",
    uploaded_at: "2026-01-01T00:00:00Z",
    url: "/media/kalevi/k1.jpg",
  },
  {
    id: 11,
    filename: "k2.jpg",
    caption: null,
    uploaded_at: "2026-01-02T00:00:00Z",
    url: "/media/kalevi/k2.jpg",
  },
];

function renderGrid(props: {
  photos?: Photo[];
  onDeletePhoto?: ReturnType<typeof vi.fn<DeleteFn>>;
  onUpload?: ReturnType<typeof vi.fn<UploadFn>>;
  onUpdateCaption?: ReturnType<typeof vi.fn<UpdateCaptionFn>>;
  onChanged?: ReturnType<typeof vi.fn<() => void>>;
  onReorder?: ReturnType<typeof vi.fn<ReorderFn>>;
  folders?: Folder[];
  onAssignFolder?: ReturnType<typeof vi.fn<AssignFolderFn>>;
  onCreateFolder?: ReturnType<typeof vi.fn<CreateFolderFn>>;
  onDeleteFolder?: ReturnType<typeof vi.fn<DeleteFolderFn>>;
  onReorderFolders?: ReturnType<typeof vi.fn<ReorderFn>>;
} = {}) {
  const onDeletePhoto =
    props.onDeletePhoto ??
    vi.fn<DeleteFn>().mockResolvedValue({ deleted: true });
  const onUpload =
    props.onUpload ??
    vi.fn<UploadFn>().mockResolvedValue({ saved: 1, skipped: 0 });
  const onUpdateCaption =
    props.onUpdateCaption ??
    vi.fn<UpdateCaptionFn>().mockResolvedValue({ ok: true });
  const onChanged = props.onChanged ?? vi.fn<() => void>();
  render(
    <LangProvider>
      <AdminPhotoGrid
        slug="kalevi"
        photos={props.photos ?? photos}
        onDeletePhoto={onDeletePhoto}
        onUpload={onUpload}
        onUpdateCaption={onUpdateCaption}
        onChanged={onChanged}
        onReorder={props.onReorder}
        folders={props.folders}
        onAssignFolder={props.onAssignFolder}
        onCreateFolder={props.onCreateFolder}
        onDeleteFolder={props.onDeleteFolder}
        onReorderFolders={props.onReorderFolders}
      />
    </LangProvider>,
  );
  return { onDeletePhoto, onUpload, onUpdateCaption, onChanged };
}

function deleteButtons(): HTMLButtonElement[] {
  return screen
    .getAllByRole("button", { name: "Poista" }) as HTMLButtonElement[];
}

function editButtons(): HTMLButtonElement[] {
  return screen
    .getAllByRole("button", { name: "Muokkaa" }) as HTMLButtonElement[];
}

afterEach(() => {
  cleanup();
  clearAuth.mockClear();
  vi.restoreAllMocks();
});

describe("AdminPhotoGrid", () => {
  it("renders every fixture photo with a delete control", () => {
    renderGrid();

    const srcs = Array.from(document.querySelectorAll("img")).map((i) =>
      i.getAttribute("src"),
    );
    expect(srcs).toContain("/media/kalevi/k1.jpg");
    expect(srcs).toContain("/media/kalevi/k2.jpg");

    // One delete button per photo -> a 2-photo fixture yields two.
    expect(deleteButtons()).toHaveLength(2);
  });

  it("deletes with the EXACT (slug, id) and refetches on confirm=true", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { onDeletePhoto, onChanged } = renderGrid();

    fireEvent.click(deleteButtons()[0]);

    await waitFor(() => expect(onDeletePhoto).toHaveBeenCalledTimes(1));
    // First photo in the fixture has id 10.
    expect(onDeletePhoto).toHaveBeenCalledWith("kalevi", 10);
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
  });

  it("does NOT delete or refetch when confirm=false (falsifiability)", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const { onDeletePhoto, onChanged } = renderGrid();

    fireEvent.click(deleteButtons()[0]);

    expect(onDeletePhoto).not.toHaveBeenCalled();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("uploads the chosen files with the slug then refetches", async () => {
    const { onUpload, onChanged } = renderGrid();

    const file = new File(["binary"], "photo.jpg", { type: "image/jpeg" });
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    fireEvent.click(screen.getByRole("button", { name: "Lataa" }));

    await waitFor(() => expect(onUpload).toHaveBeenCalledTimes(1));
    const [slugArg, filesArg, captionArg] = onUpload.mock.calls[0];
    expect(slugArg).toBe("kalevi");
    expect(Array.isArray(filesArg)).toBe(true);
    expect(filesArg).toHaveLength(1);
    expect(filesArg[0]).toBeInstanceOf(File);
    expect(filesArg[0].name).toBe("photo.jpg");
    // No caption typed -> the optional third arg is undefined.
    expect(captionArg).toBeUndefined();

    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
  });

  it("does NOT upload or refetch when no file is chosen (empty-upload guard)", async () => {
    // Twin of "uploads the chosen files with the slug then refetches"
    // (~line 118): that test proves onUpload fires ONCE when a file is
    // selected. Here no change event is fired, so files stays empty and the
    // `if (files.length === 0) return;` guard must short-circuit before onUpload.
    const { onUpload, onChanged } = renderGrid();

    fireEvent.click(screen.getByRole("button", { name: "Lataa" }));

    // handleUpload is async; flush pending microtasks so the negative
    // assertions are meaningful rather than a false pass.
    await waitFor(() => {});

    expect(onUpload).not.toHaveBeenCalled();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("calls clearAuth exactly once when delete rejects with 401 (FIX 1)", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const err = { status: 401 } as AuthError;
    const onDeletePhoto = vi.fn<DeleteFn>().mockRejectedValue(err);
    const onChanged = vi.fn();
    renderGrid({ onDeletePhoto, onChanged });

    fireEvent.click(deleteButtons()[0]);

    await waitFor(() => expect(clearAuth).toHaveBeenCalledTimes(1));
    // A 401 is a session reset, not an in-page refetch.
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("does NOT call clearAuth when the delete resolves (falsifiability twin)", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const onDeletePhoto = vi.fn<DeleteFn>().mockResolvedValue({ deleted: true });
    const { onChanged } = renderGrid({ onDeletePhoto });

    fireEvent.click(deleteButtons()[0]);

    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(clearAuth).not.toHaveBeenCalled();
  });

  it("shows the notFound alert when delete rejects with 404", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const err = { status: 404 } as AuthError;
    const onDeletePhoto = vi.fn<DeleteFn>().mockRejectedValue(err);
    renderGrid({ onDeletePhoto });

    fireEvent.click(deleteButtons()[0]);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Kohdetta ei löytynyt.");
    expect(clearAuth).not.toHaveBeenCalled();
  });

  it("every img is lazy-loaded and async-decoded (perf attrs)", () => {
    renderGrid();

    const imgs = Array.from(document.querySelectorAll("img"));
    expect(imgs.length).toBe(photos.length);
    for (const img of imgs) {
      expect(img.getAttribute("loading")).toBe("lazy");
      expect(img.getAttribute("decoding")).toBe("async");
    }
    expect(imgs.some((i) => i.getAttribute("loading") === "eager")).toBe(false);
  });

  it("Edit->Save updates the caption with EXACT (slug, id, text) then refetches", async () => {
    const { onUpdateCaption, onChanged } = renderGrid();

    // Open the editor for the first photo (fixture id 10).
    fireEvent.click(editButtons()[0]);

    // The edit input is the text box that now holds the current caption.
    const input = screen.getByDisplayValue("At the lake") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "By the shore" } });

    fireEvent.click(screen.getByRole("button", { name: "Tallenna" }));

    await waitFor(() => expect(onUpdateCaption).toHaveBeenCalledTimes(1));
    expect(onUpdateCaption).toHaveBeenCalledWith("kalevi", 10, "By the shore");
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
  });

  it("does NOT update or refetch when Edit is clicked but Save is not (falsifiability)", async () => {
    const { onUpdateCaption, onChanged } = renderGrid();

    fireEvent.click(editButtons()[0]);
    const input = screen.getByDisplayValue("At the lake") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "unsaved edit" } });

    // No Save click. Flush pending microtasks so negatives are meaningful.
    await waitFor(() => {});

    expect(onUpdateCaption).not.toHaveBeenCalled();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("calls clearAuth exactly once when caption save rejects with 401", async () => {
    const err = { status: 401 } as AuthError;
    const onUpdateCaption = vi.fn<UpdateCaptionFn>().mockRejectedValue(err);
    const onChanged = vi.fn<() => void>();
    renderGrid({ onUpdateCaption, onChanged });

    fireEvent.click(editButtons()[0]);
    fireEvent.click(screen.getByRole("button", { name: "Tallenna" }));

    await waitFor(() => expect(clearAuth).toHaveBeenCalledTimes(1));
    // A 401 is a session reset, not an in-page refetch.
    expect(onChanged).not.toHaveBeenCalled();
  });
});

function figures(): HTMLElement[] {
  return Array.from(document.querySelectorAll(".photo-grid figure"));
}

describe("AdminPhotoGrid drag-and-drop reordering", () => {
  it("figures are draggable only when onReorder is provided", () => {
    renderGrid();
    expect(figures().every((f) => f.getAttribute("draggable") !== "true")).toBe(
      true,
    );
    cleanup();

    renderGrid({ onReorder: vi.fn<ReorderFn>().mockResolvedValue({ ok: true }) });
    expect(figures().every((f) => f.getAttribute("draggable") === "true")).toBe(
      true,
    );
  });

  it("dropping photo 0 onto photo 1 persists the moved id order then refetches", async () => {
    const onReorder = vi.fn<ReorderFn>().mockResolvedValue({ ok: true });
    const { onChanged } = renderGrid({ onReorder });

    const [first, second] = figures();
    fireEvent.dragStart(first);
    fireEvent.dragOver(second);
    fireEvent.drop(second);

    await waitFor(() => expect(onReorder).toHaveBeenCalledTimes(1));
    // Fixture ids are [10, 11]; moving index 0 after index 1 gives [11, 10].
    expect(onReorder).toHaveBeenCalledWith("kalevi", [11, 10]);
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
  });

  it("dropping a photo onto itself neither persists nor refetches (falsifiability)", async () => {
    const onReorder = vi.fn<ReorderFn>().mockResolvedValue({ ok: true });
    const { onChanged } = renderGrid({ onReorder });

    const [first] = figures();
    fireEvent.dragStart(first);
    fireEvent.drop(first);

    await waitFor(() => {});
    expect(onReorder).not.toHaveBeenCalled();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("calls clearAuth when the reorder rejects with 401", async () => {
    const err = { status: 401 } as AuthError;
    const onReorder = vi.fn<ReorderFn>().mockRejectedValue(err);
    const { onChanged } = renderGrid({ onReorder });

    const [first, second] = figures();
    fireEvent.dragStart(first);
    fireEvent.drop(second);

    await waitFor(() => expect(clearAuth).toHaveBeenCalledTimes(1));
    expect(onChanged).not.toHaveBeenCalled();
  });
});

describe("AdminPhotoGrid folder drop targets", () => {
  const folders: Folder[] = [
    { id: 5, name: "Lapsuus" },
    { id: 6, name: "Työvuodet" },
  ];

  function folderCard(name: string): HTMLElement {
    const el = Array.from(
      document.querySelectorAll(".folder-card"),
    ).find((c) => c.textContent?.includes(name));
    if (!el) throw new Error(`folder card ${name} not found`);
    return el as HTMLElement;
  }

  it("renders no folder row unless folders and onAssignFolder are given", () => {
    renderGrid();
    expect(document.querySelector(".folder-grid")).toBeNull();
  });

  it("dropping a photo onto a folder card assigns it then refetches", async () => {
    const onAssignFolder = vi
      .fn<AssignFolderFn>()
      .mockResolvedValue({ ok: true });
    const { onChanged } = renderGrid({ folders, onAssignFolder });

    // Drag the first photo (id 10) onto the "Lapsuus" card (id 5).
    fireEvent.dragStart(figures()[0]);
    const card = folderCard("Lapsuus");
    fireEvent.dragOver(card);
    fireEvent.drop(card);

    await waitFor(() => expect(onAssignFolder).toHaveBeenCalledTimes(1));
    expect(onAssignFolder).toHaveBeenCalledWith("kalevi", 10, 5);
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
  });

  it("root view lists only unfoldered photos; foldered ones live behind their card", () => {
    const onAssignFolder = vi
      .fn<AssignFolderFn>()
      .mockResolvedValue({ ok: true });
    renderGrid({
      photos: [{ ...photos[0], folder_id: 5 }, photos[1]],
      folders,
      onAssignFolder,
    });

    // Only k2 (unfoldered) is in the grid; the Lapsuus card shows count 1.
    const srcs = Array.from(document.querySelectorAll(".photo-grid img")).map(
      (i) => i.getAttribute("src"),
    );
    expect(srcs).toEqual(["/media/kalevi/k2.jpg"]);
    expect(folderCard("Lapsuus").textContent).toContain("1");
  });

  it("clicking a folder opens it; dragging a photo onto ← moves it back to root", async () => {
    const onAssignFolder = vi
      .fn<AssignFolderFn>()
      .mockResolvedValue({ ok: true });
    const { onChanged } = renderGrid({
      photos: [{ ...photos[0], folder_id: 5 }, photos[1]],
      folders,
      onAssignFolder,
    });

    fireEvent.click(folderCard("Lapsuus"));

    // Inside the folder: only its photo (k1) and a back card.
    const srcs = () =>
      Array.from(document.querySelectorAll(".photo-grid img")).map((i) =>
        i.getAttribute("src"),
      );
    expect(srcs()).toEqual(["/media/kalevi/k1.jpg"]);
    const back = folderCard("Takaisin");

    // Drag the photo onto ← Takaisin -> unassign (folder_id null).
    fireEvent.dragStart(figures()[0]);
    fireEvent.dragOver(back);
    fireEvent.drop(back);

    await waitFor(() => expect(onAssignFolder).toHaveBeenCalledTimes(1));
    expect(onAssignFolder).toHaveBeenCalledWith("kalevi", 10, null);
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
  });

  it("dragging a folder onto another folder reorders them", async () => {
    const onAssignFolder = vi
      .fn<AssignFolderFn>()
      .mockResolvedValue({ ok: true });
    const onReorderFolders = vi
      .fn<ReorderFn>()
      .mockResolvedValue({ ok: true });
    const { onChanged } = renderGrid({
      folders,
      onAssignFolder,
      onReorderFolders,
    });

    // Drag "Lapsuus" (id 5) onto "Työvuodet" (id 6) -> order [6, 5].
    fireEvent.dragStart(folderCard("Lapsuus"));
    const target = folderCard("Työvuodet");
    fireEvent.dragOver(target);
    fireEvent.drop(target);

    await waitFor(() => expect(onReorderFolders).toHaveBeenCalledTimes(1));
    expect(onReorderFolders).toHaveBeenCalledWith("kalevi", [6, 5]);
    // A folder drag must NOT be mistaken for a photo-into-folder move.
    expect(onAssignFolder).not.toHaveBeenCalled();
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
  });

  it("clicking ← Takaisin returns to the root view", () => {
    const onAssignFolder = vi
      .fn<AssignFolderFn>()
      .mockResolvedValue({ ok: true });
    renderGrid({
      photos: [{ ...photos[0], folder_id: 5 }, photos[1]],
      folders,
      onAssignFolder,
    });

    fireEvent.click(folderCard("Lapsuus"));
    fireEvent.click(folderCard("Takaisin"));

    // Root again: folder cards + the unfoldered photo.
    expect(folderCard("Lapsuus")).toBeTruthy();
    const srcs = Array.from(document.querySelectorAll(".photo-grid img")).map(
      (i) => i.getAttribute("src"),
    );
    expect(srcs).toEqual(["/media/kalevi/k2.jpg"]);
  });

  it("the + card opens a naming input and creates the trimmed folder", async () => {
    const onCreateFolder = vi
      .fn<CreateFolderFn>()
      .mockResolvedValue({ id: 7, name: "Kesä" });
    const onAssignFolder = vi
      .fn<AssignFolderFn>()
      .mockResolvedValue({ ok: true });
    const { onChanged } = renderGrid({
      folders,
      onAssignFolder,
      onCreateFolder,
    });

    fireEvent.click(screen.getByRole("button", { name: "Uusi kansio" }));
    fireEvent.change(screen.getByLabelText("Kansion nimi"), {
      target: { value: "  Kesä  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Luo" }));

    await waitFor(() => expect(onCreateFolder).toHaveBeenCalledTimes(1));
    expect(onCreateFolder).toHaveBeenCalledWith("kalevi", "Kesä");
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
  });

  it("deletes a folder from its × button after confirm", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const onDeleteFolder = vi
      .fn<DeleteFolderFn>()
      .mockResolvedValue({ deleted: true });
    const onAssignFolder = vi
      .fn<AssignFolderFn>()
      .mockResolvedValue({ ok: true });
    const { onChanged } = renderGrid({
      folders,
      onAssignFolder,
      onDeleteFolder,
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Poista Työvuodet" }),
    );

    await waitFor(() => expect(onDeleteFolder).toHaveBeenCalledTimes(1));
    expect(onDeleteFolder).toHaveBeenCalledWith("kalevi", 6);
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
  });

});
