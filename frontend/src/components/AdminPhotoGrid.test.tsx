// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LangProvider } from "../i18n/LangContext";
import AdminPhotoGrid from "./AdminPhotoGrid";
import type { AuthError } from "../api/auth";
import type { Photo, UploadResult } from "../api/types";

type DeleteFn = (slug: string, id: number) => Promise<{ deleted: boolean }>;
type UploadFn = (
  slug: string,
  files: File[],
  caption?: string,
) => Promise<UploadResult>;

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
  onDeletePhoto?: ReturnType<typeof vi.fn<DeleteFn>>;
  onUpload?: ReturnType<typeof vi.fn<UploadFn>>;
  onChanged?: ReturnType<typeof vi.fn<() => void>>;
} = {}) {
  const onDeletePhoto =
    props.onDeletePhoto ??
    vi.fn<DeleteFn>().mockResolvedValue({ deleted: true });
  const onUpload =
    props.onUpload ??
    vi.fn<UploadFn>().mockResolvedValue({ saved: 1, skipped: 0 });
  const onChanged = props.onChanged ?? vi.fn<() => void>();
  render(
    <LangProvider>
      <AdminPhotoGrid
        slug="kalevi"
        photos={photos}
        onDeletePhoto={onDeletePhoto}
        onUpload={onUpload}
        onChanged={onChanged}
      />
    </LangProvider>,
  );
  return { onDeletePhoto, onUpload, onChanged };
}

function deleteButtons(): HTMLButtonElement[] {
  return screen
    .getAllByRole("button", { name: "Poista" }) as HTMLButtonElement[];
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
});
