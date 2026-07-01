// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { LangProvider } from "../i18n/LangContext";
import PhotoGrid from "./PhotoGrid";
import type { Photo } from "../api/types";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

const photos: Photo[] = [
  {
    id: 1,
    filename: "a.jpg",
    caption: "At the lake",
    uploaded_at: "2026-01-01T00:00:00Z",
    url: "/media/a.jpg",
  },
  {
    id: 2,
    filename: "b.jpg",
    caption: null,
    uploaded_at: "2026-01-02T00:00:00Z",
    url: "/media/b.jpg",
  },
];

function renderGrid(items: Photo[]) {
  return render(
    <LangProvider>
      <PhotoGrid photos={items} />
    </LangProvider>,
  );
}

describe("PhotoGrid", () => {
  it("renders the empty state when there are no photos", () => {
    renderGrid([]);

    const p = document.querySelector("p.photo-grid-empty");
    expect(p).toBeTruthy();
    expect(p?.textContent).toBe("Ei vielä valokuvia.");
  });

  it("renders every photo url and only captioned photos get a figcaption", () => {
    renderGrid(photos);

    // Raw <img> query: a null-caption photo renders alt="" which is excluded
    // from role "img", so we read every <img> element directly.
    const srcs = Array.from(document.querySelectorAll("img")).map((i) =>
      i.getAttribute("src"),
    );
    expect(srcs).toContain("/media/a.jpg");
    expect(srcs).toContain("/media/b.jpg");

    // The captioned photo shows its caption.
    expect(screen.getByText("At the lake")).toBeTruthy();

    // Only the captioned photo produces a figcaption.
    expect(document.querySelectorAll("figcaption")).toHaveLength(1);
  });

  it("does not render a caption or url absent from the fixture (falsifiability)", () => {
    renderGrid(photos);

    const srcs = Array.from(document.querySelectorAll("img")).map((i) =>
      i.getAttribute("src"),
    );
    expect(screen.queryByText("Caption that does not exist")).toBeNull();
    expect(srcs).not.toContain("/media/ghost.jpg");
  });

  it("every img is lazy-loaded and async-decoded (perf attrs)", () => {
    renderGrid(photos);

    const imgs = Array.from(document.querySelectorAll("img"));
    expect(imgs.length).toBe(photos.length);
    for (const img of imgs) {
      expect(img.getAttribute("loading")).toBe("lazy");
      expect(img.getAttribute("decoding")).toBe("async");
    }
    // Falsifiability: none is eagerly loaded.
    expect(imgs.some((i) => i.getAttribute("loading") === "eager")).toBe(false);
  });
});
