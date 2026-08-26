// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import EventsIndex from "./EventsIndex";
import { getEvents } from "../api/client";
import type { Event } from "../api/types";

vi.mock("../api/client", () => ({
  getEvents: vi.fn(),
  // Layout (rendered by this page) fetches contact on mount.
  getContact: vi.fn(() =>
    Promise.resolve({
      contact_name: null,
      contact_email: null,
      contact_phone: null,
    }),
  ),
}));

const mockedGetEvents = vi.mocked(getEvents);

const events: Event[] = [
  {
    id: 1,
    slug: "wedding",
    name: "Aino & Kalevi Wedding",
    description: null,
    event_time: "1948-06-12",
    place: "Helsinki",
    cover_filename: "cover.jpg",
    cover_url: "/media/events/wedding/cover.jpg",
  },
  {
    id: 2,
    slug: "summer",
    name: "Summer Gathering",
    description: null,
    event_time: null,
    place: null,
    cover_filename: null,
    cover_url: null,
  },
];

beforeEach(() => {
  mockedGetEvents.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("EventsIndex", () => {
  it("renders every event name and only renders covers for those with a cover_url", async () => {
    mockedGetEvents.mockResolvedValue(events);

    render(
      <MemoryRouter>
        <EventsIndex />
      </MemoryRouter>,
    );

    // Both event names render once the async effect resolves.
    expect(await screen.findByText("Aino & Kalevi Wedding")).toBeTruthy();
    expect(screen.getByText("Summer Gathering")).toBeTruthy();

    // The event WITH a cover_url has a cover <img> pointing at that url.
    const weddingImg = screen.getByAltText(
      "Aino & Kalevi Wedding",
    ) as HTMLImageElement;
    expect(weddingImg.tagName).toBe("IMG");
    expect(weddingImg.getAttribute("src")).toBe(
      "/media/events/wedding/cover.jpg",
    );

    // Exactly one image is rendered: the null-cover event has no <img>.
    expect(screen.queryByAltText("Summer Gathering")).toBeNull();
    expect(screen.getAllByRole("img")).toHaveLength(1);
  });

  it("does not render a name that is absent from the fixture (falsifiability)", async () => {
    mockedGetEvents.mockResolvedValue(events);

    render(
      <MemoryRouter>
        <EventsIndex />
      </MemoryRouter>,
    );

    await screen.findByText("Aino & Kalevi Wedding");
    expect(screen.queryByText("Nonexistent Event")).toBeNull();
  });

  it("waits for the async load before any event appears", async () => {
    mockedGetEvents.mockResolvedValue(events);

    render(
      <MemoryRouter>
        <EventsIndex />
      </MemoryRouter>,
    );

    await waitFor(() => expect(mockedGetEvents).toHaveBeenCalledTimes(1));
    await screen.findByText("Summer Gathering");
  });
});
