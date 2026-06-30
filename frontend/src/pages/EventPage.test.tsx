// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import EventPage from "./EventPage";
import { getEvent } from "../api/client";
import type { EventDetail } from "../api/types";

vi.mock("../api/client", () => ({ getEvent: vi.fn() }));

const mockedGetEvent = vi.mocked(getEvent);

const detail: EventDetail = {
  event: {
    id: 1,
    slug: "wedding",
    name: "Aino & Kalevi Wedding",
    description: "A summer wedding in Helsinki",
    event_time: "1948-06-12",
    place: "Helsinki",
  },
  photos: [
    {
      id: 10,
      filename: "w1.jpg",
      caption: "Cutting the cake",
      uploaded_at: "2026-01-01T00:00:00Z",
      url: "/media/events/wedding/w1.jpg",
    },
    {
      id: 11,
      filename: "w2.jpg",
      caption: null,
      uploaded_at: "2026-01-02T00:00:00Z",
      url: "/media/events/wedding/w2.jpg",
    },
  ],
};

function renderAt(slug: string) {
  return render(
    <MemoryRouter initialEntries={[`/events/${slug}`]}>
      <Routes>
        <Route path="/events/:slug" element={<EventPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockedGetEvent.mockReset();
});

afterEach(() => {
  cleanup();
});

// Query raw <img> elements from the rendered tree. We avoid getAllByRole("img")
// because an <img alt=""> (a photo with no caption) is treated as presentational
// and excluded from the "img" role — but it is still a real rendered element
// whose src we want to assert.
function renderedImageSrcs(): (string | null)[] {
  return Array.from(document.querySelectorAll("img")).map((img) =>
    img.getAttribute("src"),
  );
}

describe("EventPage", () => {
  it("renders the event name and every photo url from the fixture", async () => {
    mockedGetEvent.mockResolvedValue(detail);

    renderAt("wedding");

    // Name renders once the async effect resolves; useParams must have wired the slug.
    expect(
      await screen.findByRole("heading", { name: "Aino & Kalevi Wedding" }),
    ).toBeTruthy();
    expect(mockedGetEvent).toHaveBeenCalledWith("wedding");

    // Each gallery photo <img> renders with its fixture url.
    const srcs = renderedImageSrcs();
    expect(srcs).toContain("/media/events/wedding/w1.jpg");
    expect(srcs).toContain("/media/events/wedding/w2.jpg");

    // The captioned photo shows its caption.
    expect(screen.getByText("Cutting the cake")).toBeTruthy();
  });

  it("does not render a url or caption that is absent from the fixture (falsifiability)", async () => {
    mockedGetEvent.mockResolvedValue(detail);

    renderAt("wedding");

    await screen.findByRole("heading", { name: "Aino & Kalevi Wedding" });

    const srcs = renderedImageSrcs();
    expect(srcs).not.toContain("/media/events/wedding/ghost.jpg");
    expect(screen.queryByText("Caption that does not exist")).toBeNull();
  });
});
