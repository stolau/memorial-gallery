import { useState } from "react";
import type { Photo } from "../api/types";
import { useT } from "../i18n/LangContext";
import Lightbox from "./Lightbox";

function PhotoGrid({ photos }: { photos: Photo[] }) {
  const t = useT();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  if (photos.length === 0) {
    return <p className="photo-grid-empty">{t("photos.empty")}</p>;
  }
  return (
    <div className="photo-grid">
      {photos.map((p, i) => (
        <figure key={p.id}>
          <button
            type="button"
            className="photo-grid-btn"
            onClick={() => setOpenIndex(i)}
            aria-label={p.caption ?? t("lightbox.open")}
          >
            <img
              src={p.url}
              alt={p.caption ?? ""}
              loading="lazy"
              decoding="async"
              width={640}
              height={480}
              style={{ aspectRatio: "4 / 3", width: "100%", height: "auto" }}
            />
          </button>
          {p.caption && <figcaption>{p.caption}</figcaption>}
        </figure>
      ))}
      {openIndex !== null && (
        <Lightbox
          photos={photos}
          startIndex={openIndex}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </div>
  );
}

export default PhotoGrid;
