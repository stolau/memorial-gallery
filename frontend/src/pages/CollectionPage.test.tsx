// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import CollectionPage from "./CollectionPage";
import { getCollection } from "../api/client";
import type { CollectionDetail } from "../api/types";

vi.mock("../api/client", () => ({
  getCollection: vi.fn(),
  // Layout (rendered by this page) fetches contact on mount.
  getContact: vi.fn(() =>
    Promise.resolve({
      contact_name: null,
      contact_email: null,
      contact_phone: null,
    }),
  ),
}));

const mockedGetCollection = vi.mocked(getCollection);

const detail: CollectionDetail = {
  collection: {
    id: 1,
    slug: "suku",
    name: "Kaijankosken suku",
    info: "First paragraph.\n\nSecond paragraph.",
    profile_image: null,
    profile_image_url: null,
  },
  photos: [
    {
      id: 10,
      filename: "c1.jpg",
      caption: "Reunion",
      uploaded_at: "2026-01-01T00:00:00Z",
      url: "/media/collections/suku/c1.jpg",
      folder_id: null,
    },
    {
      id: 11,
      filename: "c2.jpg",
      caption: null,
      uploaded_at: "2026-01-02T00:00:00Z",
      url: "/media/collections/suku/c2.jpg",
      folder_id: 5,
    },
  ],
  folders: [{ id: 5, name: "Old albums" }],
};

function renderAt(slug: string) {
  return render(
    <MemoryRouter initialEntries={[`/collections/${slug}`]}>
      <Routes>
        <Route path="/collections/:slug" element={<CollectionPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockedGetCollection.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("CollectionPage", () => {
  it("renders the name and the info split into paragraphs", async () => {
    mockedGetCollection.mockResolvedValue(detail);

    renderAt("suku");

    expect(await screen.findByText("Kaijankosken suku")).toBeTruthy();
    // <Paragraphs> splits the blank-line-separated info into two <p> blocks.
    const first = screen.getByText("First paragraph.");
    const second = screen.getByText("Second paragraph.");
    expect(first.tagName).toBe("P");
    expect(second.tagName).toBe("P");
    expect(first.className).toContain("info-paragraph");
  });

  it("shows the folder card and the unfoldered photo at the root", async () => {
    mockedGetCollection.mockResolvedValue(detail);

    renderAt("suku");

    await screen.findByText("Kaijankosken suku");
    // Folder card for the folder that has a photo.
    expect(screen.getByText("Old albums")).toBeTruthy();
    // The unfoldered photo renders in the flat grid.
    const srcs = Array.from(document.querySelectorAll("img")).map((i) =>
      i.getAttribute("src"),
    );
    expect(srcs).toContain("/media/collections/suku/c1.jpg");
  });

  it("opens a folder's photos when its card is clicked", async () => {
    mockedGetCollection.mockResolvedValue(detail);

    renderAt("suku");

    fireEvent.click(await screen.findByText("Old albums"));

    // The heading for the opened folder appears and its photo is shown.
    expect(screen.getByRole("heading", { name: "Old albums" })).toBeTruthy();
    const srcs = Array.from(document.querySelectorAll("img")).map((i) =>
      i.getAttribute("src"),
    );
    expect(srcs).toContain("/media/collections/suku/c2.jpg");
  });

  it("renders an error alert when the load rejects (falsifiability)", async () => {
    mockedGetCollection.mockRejectedValue(new Error("boom"));

    renderAt("suku");

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("boom");
    expect(screen.queryByText("Kaijankosken suku")).toBeNull();
  });
});
