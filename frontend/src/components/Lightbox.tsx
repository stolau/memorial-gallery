import { useEffect, useRef, useState } from "react";
import type { Photo } from "../api/types";
import { useT } from "../i18n/LangContext";

function Lightbox({
  photos,
  startIndex,
  onClose,
}: {
  photos: Photo[];
  startIndex: number;
  onClose: () => void;
}) {
  const t = useT();
  const n = photos.length;
  const [index, setIndex] = useState(startIndex);
  const [playing, setPlaying] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  const next = () => setIndex((i) => (i + 1) % n);
  const prev = () => setIndex((i) => (i - 1 + n) % n);

  useEffect(() => {
    if (!playing) return undefined;
    const id = setInterval(() => setIndex((i) => (i + 1) % n), 15000);
    return () => clearInterval(id);
  }, [playing, index, n]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        setIndex((i) => (i - 1 + n) % n);
      } else if (e.key === "ArrowRight") {
        setIndex((i) => (i + 1) % n);
      } else if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, n]);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    overlayRef.current?.focus();
    return () => previouslyFocused?.focus();
  }, []);

  const photo = photos[index];

  return (
    <div
      className="lightbox-overlay"
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      ref={overlayRef}
      onClick={onClose}
    >
      <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
        <img
          className="lightbox-img"
          src={photo.url}
          alt={photo.caption ?? ""}
        />
        {photo.caption && (
          <p className="lightbox-caption">{photo.caption}</p>
        )}
        <div className="lightbox-controls">
          <button type="button" aria-label={t("lightbox.prev")} onClick={prev}>
            ←
          </button>
          <span className="lightbox-counter" aria-label={t("lightbox.counter")}>
            {index + 1} / {n}
          </span>
          <button type="button" aria-label={t("lightbox.next")} onClick={next}>
            →
          </button>
          <button
            type="button"
            aria-label={playing ? t("lightbox.pause") : t("lightbox.play")}
            onClick={() => setPlaying((p) => !p)}
          >
            {playing ? "⏸" : "▶"}
          </button>
          <button
            type="button"
            aria-label={t("lightbox.close")}
            onClick={onClose}
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}

export default Lightbox;
