// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LangProvider } from "../i18n/LangContext";
import FolderManager from "./FolderManager";
import type { AuthError } from "../api/auth";
import type { Folder } from "../api/types";

type CreateFn = (slug: string, name: string) => Promise<Folder>;
type DeleteFn = (slug: string, id: number) => Promise<{ deleted: boolean }>;

const { clearAuth } = vi.hoisted(() => ({ clearAuth: vi.fn() }));
vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({
    authed: true,
    login: vi.fn(),
    logout: vi.fn(),
    clearAuth,
  }),
}));

const folders: Folder[] = [
  { id: 5, name: "Lapsuus" },
  { id: 6, name: "Työvuodet" },
];

function renderManager(props: {
  folders?: Folder[];
  onCreateFolder?: ReturnType<typeof vi.fn<CreateFn>>;
  onDeleteFolder?: ReturnType<typeof vi.fn<DeleteFn>>;
} = {}) {
  const onCreateFolder =
    props.onCreateFolder ??
    vi.fn<CreateFn>().mockResolvedValue({ id: 7, name: "Uusi" });
  const onDeleteFolder =
    props.onDeleteFolder ??
    vi.fn<DeleteFn>().mockResolvedValue({ deleted: true });
  const onChanged = vi.fn<() => void>();
  render(
    <LangProvider>
      <FolderManager
        slug="kalevi"
        folders={props.folders ?? folders}
        onCreateFolder={onCreateFolder}
        onDeleteFolder={onDeleteFolder}
        onChanged={onChanged}
      />
    </LangProvider>,
  );
  return { onCreateFolder, onDeleteFolder, onChanged };
}

afterEach(() => {
  cleanup();
  clearAuth.mockClear();
  vi.restoreAllMocks();
});

describe("FolderManager", () => {
  it("lists every folder and shows the empty message when there are none", () => {
    renderManager();
    expect(screen.getByText("Lapsuus")).toBeTruthy();
    expect(screen.getByText("Työvuodet")).toBeTruthy();
    cleanup();

    renderManager({ folders: [] });
    expect(screen.getByText("Ei vielä kansioita.")).toBeTruthy();
  });

  it("creates a folder with the trimmed typed name, clears the input, refetches", async () => {
    const { onCreateFolder, onChanged } = renderManager();

    const input = screen.getByLabelText("Kansion nimi") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "  Kesämökki  " } });
    fireEvent.click(screen.getByRole("button", { name: "Luo" }));

    await waitFor(() => expect(onCreateFolder).toHaveBeenCalledTimes(1));
    expect(onCreateFolder).toHaveBeenCalledWith("kalevi", "Kesämökki");
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(input.value).toBe("");
  });

  it("does NOT create with an empty name (falsifiability)", async () => {
    const { onCreateFolder, onChanged } = renderManager();

    fireEvent.click(screen.getByRole("button", { name: "Luo" }));
    await waitFor(() => {});

    expect(onCreateFolder).not.toHaveBeenCalled();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("deletes the EXACT (slug, id) on confirm=true then refetches", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { onDeleteFolder, onChanged } = renderManager();

    const deleteButtons = screen.getAllByRole("button", { name: "Poista" });
    expect(deleteButtons).toHaveLength(2);
    fireEvent.click(deleteButtons[1]);

    await waitFor(() => expect(onDeleteFolder).toHaveBeenCalledTimes(1));
    expect(onDeleteFolder).toHaveBeenCalledWith("kalevi", 6);
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
  });

  it("does NOT delete when confirm=false", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const { onDeleteFolder, onChanged } = renderManager();

    fireEvent.click(screen.getAllByRole("button", { name: "Poista" })[0]);

    expect(onDeleteFolder).not.toHaveBeenCalled();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("calls clearAuth exactly once when create rejects with 401", async () => {
    const err = { status: 401 } as AuthError;
    const onCreateFolder = vi.fn<CreateFn>().mockRejectedValue(err);
    const { onChanged } = renderManager({ onCreateFolder });

    fireEvent.change(screen.getByLabelText("Kansion nimi"), {
      target: { value: "x" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Luo" }));

    await waitFor(() => expect(clearAuth).toHaveBeenCalledTimes(1));
    expect(onChanged).not.toHaveBeenCalled();
  });
});
