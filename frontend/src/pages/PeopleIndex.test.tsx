// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { fireEvent } from "@testing-library/react";
import PeopleIndex from "./PeopleIndex";
import { getPeople, getEvents, getFamilyLines } from "../api/client";
import type { Event, FamilyLine, Person } from "../api/types";

vi.mock("../api/client", () => ({
  getPeople: vi.fn(),
  // The home page also loads the events + family-lines section.
  getEvents: vi.fn(() => Promise.resolve([])),
  getFamilyLines: vi.fn(() => Promise.resolve([])),
}));

const mockedGetPeople = vi.mocked(getPeople);
const mockedGetEvents = vi.mocked(getEvents);
const mockedGetFamilyLines = vi.mocked(getFamilyLines);

const people: Person[] = [
  {
    id: 1,
    slug: "aino",
    display_name: "Aino Koski",
    bio: null,
    profile_image: "profile/aino.jpg",
    profile_image_url: "/media/aino/profile/aino.jpg",
  },
  {
    id: 2,
    slug: "kalevi",
    display_name: "Kalevi Koski",
    bio: null,
    profile_image: null,
    profile_image_url: null,
  },
];

beforeEach(() => {
  mockedGetPeople.mockReset();
  mockedGetEvents.mockReset();
  mockedGetEvents.mockResolvedValue([]);
  mockedGetFamilyLines.mockReset();
  mockedGetFamilyLines.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
});

describe("PeopleIndex", () => {
  it("renders every person name and only renders thumbnails for those with a profile_image_url", async () => {
    mockedGetPeople.mockResolvedValue(people);

    render(
      <MemoryRouter>
        <PeopleIndex />
      </MemoryRouter>,
    );

    // Both display names render once the async effect resolves.
    expect(await screen.findByText("Aino Koski")).toBeTruthy();
    expect(screen.getByText("Kalevi Koski")).toBeTruthy();

    // The person WITH a url has a thumbnail <img> pointing at that url.
    const ainoImg = screen.getByAltText("Aino Koski") as HTMLImageElement;
    expect(ainoImg.tagName).toBe("IMG");
    expect(ainoImg.getAttribute("src")).toBe("/media/aino/profile/aino.jpg");

    // Exactly one image is rendered: the null-url person has no <img>.
    expect(screen.queryByAltText("Kalevi Koski")).toBeNull();
    expect(screen.getAllByRole("img")).toHaveLength(1);
  });

  it("does not render a name that is absent from the fixture (falsifiability)", async () => {
    mockedGetPeople.mockResolvedValue(people);

    render(
      <MemoryRouter>
        <PeopleIndex />
      </MemoryRouter>,
    );

    await screen.findByText("Aino Koski");
    expect(screen.queryByText("Nonexistent Person")).toBeNull();
  });

  it("waits for the async load before any person appears", async () => {
    mockedGetPeople.mockResolvedValue(people);

    render(
      <MemoryRouter>
        <PeopleIndex />
      </MemoryRouter>,
    );

    await waitFor(() => expect(mockedGetPeople).toHaveBeenCalledTimes(1));
    await screen.findByText("Kalevi Koski");
  });

  it("shows loading state before the promise resolves", () => {
    // Explicit <Person[]> type param: a bare new Promise(() => {}) infers
    // Promise<unknown> and fails typecheck against getPeople's Promise<Person[]>.
    mockedGetPeople.mockReturnValue(new Promise<Person[]>(() => {}));

    render(
      <MemoryRouter>
        <PeopleIndex />
      </MemoryRouter>,
    );

    // people === null && error === null -> the loading paragraph renders.
    expect(screen.getByText("Ladataan…")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows an error alert when getPeople rejects", async () => {
    mockedGetPeople.mockRejectedValue(new Error("Network down"));

    render(
      <MemoryRouter>
        <PeopleIndex />
      </MemoryRouter>,
    );

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Network down");
    expect(screen.queryByText("Ladataan…")).toBeNull();
    expect(screen.queryByText("Aino Koski")).toBeNull();
  });
});

const timelineEvents: Event[] = [
  {
    id: 1,
    slug: "wedding",
    name: "Aino & Kalevi Wedding",
    description: null,
    event_time: "1948",
    place: "Helsinki",
    kind: "wedding",
    cover_filename: null,
    cover_url: null,
  },
];

const kinLines: FamilyLine[] = [
  {
    id: 1,
    slug: "koski",
    name: "Koski",
    year_range: "1890–1998",
    note: "The northern branch.",
    position: 0,
    members: [{ slug: "kalevi", display_name: "Kalevi Koski" }],
  },
];

describe("PeopleIndex — events / family-lines tabs", () => {
  it("defaults to the Timeline tab and shows events with a kind eyebrow", async () => {
    mockedGetPeople.mockResolvedValue([]);
    mockedGetEvents.mockResolvedValue(timelineEvents);
    mockedGetFamilyLines.mockResolvedValue(kinLines);

    render(
      <MemoryRouter>
        <PeopleIndex />
      </MemoryRouter>,
    );

    // Timeline is the default tab: the event card + its localized kind label.
    expect(await screen.findByText("Aino & Kalevi Wedding")).toBeTruthy();
    expect(screen.getByText("Häät")).toBeTruthy();
    // The Kin cards are not shown until that tab is selected.
    expect(screen.queryByText("Koski")).toBeNull();

    const timelineTab = screen.getByRole("tab", { name: "Aikajana" });
    expect(timelineTab.getAttribute("aria-selected")).toBe("true");
  });

  it("switches to the Kin tab and links member chips to /:slug", async () => {
    mockedGetPeople.mockResolvedValue([]);
    mockedGetEvents.mockResolvedValue(timelineEvents);
    mockedGetFamilyLines.mockResolvedValue(kinLines);

    render(
      <MemoryRouter>
        <PeopleIndex />
      </MemoryRouter>,
    );

    await screen.findByText("Aino & Kalevi Wedding");

    fireEvent.click(screen.getByRole("tab", { name: "Suvut" }));

    // The family line card renders with its name, range and note...
    expect(screen.getByText("Koski")).toBeTruthy();
    expect(screen.getByText("1890–1998")).toBeTruthy();
    expect(screen.getByText("The northern branch.")).toBeTruthy();

    // ...and each member is a chip linking to that person's page.
    const chip = screen.getByRole("link", { name: "Kalevi Koski" });
    expect(chip.getAttribute("href")).toBe("/kalevi");

    // The timeline event is no longer shown once Kin is active.
    expect(screen.queryByText("Aino & Kalevi Wedding")).toBeNull();
  });
});
