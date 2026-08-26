// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CollectionsIndex from "./CollectionsIndex";
import { getCollections } from "../api/client";
import type { Collection } from "../api/types";

vi.mock("../api/client", () => ({
  getCollections: vi.fn(),
  // Layout (rendered by this page) fetches contact on mount.
  getContact: vi.fn(() =>
    Promise.resolve({
      contact_name: null,
      contact_email: null,
      contact_phone: null,
    }),
  ),
}));

const mockedGetCollections = vi.mocked(getCollections);

const collections: Collection[] = [
  {
    id: 1,
    slug: "suku",
    name: "Kaijankosken suku",
    info: null,
    profile_image: null,
    cover_filename: "cover.jpg",
    cover_url: "/media/collections/suku/cover.jpg",
  },
  {
    id: 2,
    slug: "vanhat",
    name: "Vanhat kuvat",
    info: null,
    profile_image: null,
    cover_filename: null,
    cover_url: null,
  },
];

beforeEach(() => {
  mockedGetCollections.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("CollectionsIndex", () => {
  it("renders each collection name, links to /collections/:slug and shows covers only when set", async () => {
    mockedGetCollections.mockResolvedValue(collections);

    render(
      <MemoryRouter>
        <CollectionsIndex />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Kaijankosken suku")).toBeTruthy();
    expect(screen.getByText("Vanhat kuvat")).toBeTruthy();

    const link = screen.getByText("Kaijankosken suku").closest("a");
    expect(link?.getAttribute("href")).toBe("/collections/suku");

    const cover = screen.getByAltText("Kaijankosken suku") as HTMLImageElement;
    expect(cover.getAttribute("src")).toBe("/media/collections/suku/cover.jpg");
    // The null-cover collection renders no image.
    expect(screen.queryByAltText("Vanhat kuvat")).toBeNull();
    expect(screen.getAllByRole("img")).toHaveLength(1);
  });

  it("shows the empty message when there are no collections", async () => {
    mockedGetCollections.mockResolvedValue([]);

    render(
      <MemoryRouter>
        <CollectionsIndex />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Ei vielä kokoelmia.")).toBeTruthy();
  });

  it("waits for the async load before any collection appears (falsifiability)", async () => {
    mockedGetCollections.mockResolvedValue(collections);

    render(
      <MemoryRouter>
        <CollectionsIndex />
      </MemoryRouter>,
    );

    // Before the effect resolves, no card exists yet.
    expect(screen.queryByText("Kaijankosken suku")).toBeNull();
    await waitFor(() =>
      expect(mockedGetCollections).toHaveBeenCalledTimes(1),
    );
    await screen.findByText("Kaijankosken suku");
  });
});
