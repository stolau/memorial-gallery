// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PersonPage from "./PersonPage";
import { getPerson } from "../api/client";
import type { PersonDetail } from "../api/types";

vi.mock("../api/client", () => ({ getPerson: vi.fn() }));

const mockedGetPerson = vi.mocked(getPerson);

const detail: PersonDetail = {
  person: {
    id: 1,
    slug: "kalevi",
    display_name: "Kalevi Koski",
    bio: "Grandfather",
    profile_image: "profile/kalevi.jpg",
    profile_image_url: "/media/kalevi/profile/kalevi.jpg",
    birth_year: 1920,
    death_year: 1998,
    birthplace: "Helsinki",
    profession: "Carpenter",
  },
  photos: [
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
  ],
};

function renderAt(slug: string) {
  return render(
    <MemoryRouter initialEntries={[`/${slug}`]}>
      <Routes>
        <Route path="/:slug" element={<PersonPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderAtEntry(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/:slug" element={<PersonPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockedGetPerson.mockReset();
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

describe("PersonPage", () => {
  it("renders the person name and every photo url from the fixture", async () => {
    mockedGetPerson.mockResolvedValue(detail);

    renderAt("kalevi");

    // Name renders once the async effect resolves; useParams must have wired the slug.
    expect(await screen.findByRole("heading", { name: "Kalevi Koski" })).toBeTruthy();
    await waitForCalledWithSlug("kalevi");

    // Each gallery photo <img> renders with its fixture url.
    const srcs = renderedImageSrcs();
    expect(srcs).toContain("/media/kalevi/k1.jpg");
    expect(srcs).toContain("/media/kalevi/k2.jpg");

    // The captioned photo shows its caption.
    expect(screen.getByText("At the lake")).toBeTruthy();
  });

  it("does not render a url or caption that is absent from the fixture (falsifiability)", async () => {
    mockedGetPerson.mockResolvedValue(detail);

    renderAt("kalevi");

    await screen.findByRole("heading", { name: "Kalevi Koski" });

    const srcs = renderedImageSrcs();
    expect(srcs).not.toContain("/media/kalevi/ghost.jpg");
    expect(screen.queryByText("Caption that does not exist")).toBeNull();
  });

  it("opens the portrait dialog when the Muotokuva button is clicked", async () => {
    mockedGetPerson.mockResolvedValue(detail);

    renderAt("kalevi");

    await screen.findByRole("heading", { name: "Kalevi Koski" });

    // No dialog before interaction.
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Muotokuva" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeTruthy();
    // The dialog carries a fact from the fixture.
    expect(within(dialog).getByText("Syntymäpaikka: Helsinki")).toBeTruthy();
  });

  it("auto-opens the portrait dialog when ?showinfo=1", async () => {
    mockedGetPerson.mockResolvedValue(detail);

    renderAtEntry("/kalevi?showinfo=1");

    await screen.findByRole("heading", { name: "Kalevi Koski" });

    // Dialog appears with no click.
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("falsifiability twin B: does NOT auto-open the dialog without ?showinfo=1", async () => {
    mockedGetPerson.mockResolvedValue(detail);

    renderAtEntry("/kalevi");

    await screen.findByRole("heading", { name: "Kalevi Koski" });

    // Auto-open is gated on the query param, so no dialog here.
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

async function waitForCalledWithSlug(slug: string) {
  // useParams resolved -> getPerson invoked with the routed slug.
  expect(mockedGetPerson).toHaveBeenCalledWith(slug);
}
