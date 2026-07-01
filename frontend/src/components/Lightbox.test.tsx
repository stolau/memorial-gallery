// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LangProvider } from "../i18n/LangContext";
import Lightbox from "./Lightbox";
import type { Photo } from "../api/types";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const photos: Photo[] = [
  {
    id: 1,
    filename: "0.jpg",
    caption: "a",
    uploaded_at: "2026-01-01T00:00:00Z",
    url: "/m/0.jpg",
  },
  {
    id: 2,
    filename: "1.jpg",
    caption: "b",
    uploaded_at: "2026-01-02T00:00:00Z",
    url: "/m/1.jpg",
  },
  {
    id: 3,
    filename: "2.jpg",
    caption: "c",
    uploaded_at: "2026-01-03T00:00:00Z",
    url: "/m/2.jpg",
  },
];

function renderLightbox(startIndex: number, onClose: () => void = () => {}) {
  return render(
    <LangProvider>
      <Lightbox photos={photos} startIndex={startIndex} onClose={onClose} />
    </LangProvider>,
  );
}

function counterText(): string {
  return (
    document.querySelector(".lightbox-counter")?.textContent?.trim() ?? ""
  );
}

function imgSrc(): string {
  return document.querySelector(".lightbox-img")?.getAttribute("src") ?? "";
}

describe("Lightbox", () => {
  it("opens at the given startIndex", () => {
    renderLightbox(1);
    expect(counterText()).toBe("2 / 3");
    expect(imgSrc().endsWith("/m/1.jpg")).toBe(true);
  });

  it("next navigates forward and wraps last -> first", () => {
    renderLightbox(2);
    fireEvent.click(screen.getByLabelText("Seuraava"));
    expect(counterText()).toBe("1 / 3");
    expect(imgSrc().endsWith("/m/0.jpg")).toBe(true);
  });

  it("prev navigates back and wraps first -> last", () => {
    renderLightbox(0);
    fireEvent.click(screen.getByLabelText("Edellinen"));
    expect(counterText()).toBe("3 / 3");
    expect(imgSrc().endsWith("/m/2.jpg")).toBe(true);
  });

  it("ArrowRight advances and ArrowLeft goes back", () => {
    renderLightbox(0);
    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(counterText()).toBe("2 / 3");
    expect(imgSrc().endsWith("/m/1.jpg")).toBe(true);

    fireEvent.keyDown(document, { key: "ArrowLeft" });
    expect(counterText()).toBe("1 / 3");
    expect(imgSrc().endsWith("/m/0.jpg")).toBe(true);
  });

  it("auto-advances every 15s while playing and wraps at the end", () => {
    vi.useFakeTimers();
    try {
      renderLightbox(0);
      fireEvent.click(screen.getByLabelText("Toista"));

      act(() => {
        vi.advanceTimersByTime(15000);
      });
      expect(counterText()).toBe("2 / 3");

      act(() => {
        vi.advanceTimersByTime(15000);
      });
      expect(counterText()).toBe("3 / 3");

      // Cross the end -> wrap back to the first photo.
      act(() => {
        vi.advanceTimersByTime(15000);
      });
      expect(counterText()).toBe("1 / 3");
    } finally {
      vi.useRealTimers();
    }
  });

  it("pause stops auto-advance", () => {
    vi.useFakeTimers();
    try {
      renderLightbox(0);
      fireEvent.click(screen.getByLabelText("Toista"));
      // Button now toggles to the pause label.
      fireEvent.click(screen.getByLabelText("Keskeytä"));

      act(() => {
        vi.advanceTimersByTime(30000);
      });
      expect(counterText()).toBe("1 / 3");
    } finally {
      vi.useRealTimers();
    }
  });

  it("closes on Escape, on the close button, and on backdrop click, but not on content click", () => {
    // Escape
    const onCloseEsc = vi.fn();
    const first = renderLightbox(0, onCloseEsc);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCloseEsc).toHaveBeenCalledTimes(1);
    first.unmount();

    // Close button
    const onCloseBtn = vi.fn();
    const second = renderLightbox(0, onCloseBtn);
    fireEvent.click(screen.getByLabelText("Sulje"));
    expect(onCloseBtn).toHaveBeenCalledTimes(1);
    second.unmount();

    // Backdrop click closes; content click does NOT (stopPropagation).
    const onCloseBackdrop = vi.fn();
    renderLightbox(0, onCloseBackdrop);
    fireEvent.click(document.querySelector(".lightbox-content")!);
    expect(onCloseBackdrop).not.toHaveBeenCalled();
    fireEvent.click(document.querySelector(".lightbox-img")!);
    expect(onCloseBackdrop).not.toHaveBeenCalled();
    fireEvent.click(document.querySelector(".lightbox-overlay")!);
    expect(onCloseBackdrop).toHaveBeenCalledTimes(1);
  });

  it("falsifiability twin A: wrap really changes the index, it is not a clamp/no-op", () => {
    // prev from the first photo must wrap to the LAST one.
    const first = renderLightbox(0);
    fireEvent.click(screen.getByLabelText("Edellinen"));
    expect(counterText()).toBe("3 / 3");
    expect(counterText()).not.toBe("1 / 3");
    expect(imgSrc().endsWith("/m/2.jpg")).toBe(true);
    expect(imgSrc().endsWith("/m/0.jpg")).toBe(false);
    first.unmount();

    // From the first photo, next x3 (0 -> 1 -> 2 -> 0) crosses the end and
    // wraps last -> first on the final step.
    renderLightbox(0);
    const next = screen.getByLabelText("Seuraava");
    fireEvent.click(next);
    fireEvent.click(next);
    fireEvent.click(next);
    expect(counterText()).toBe("1 / 3");
    expect(counterText()).not.toBe("3 / 3");
    expect(imgSrc().endsWith("/m/0.jpg")).toBe(true);
  });
});
