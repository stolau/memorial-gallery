import type { Photo } from "../api/types";
import { useT } from "../i18n/LangContext";

function PhotoGrid({ photos }: { photos: Photo[] }) {
  const t = useT();
  if (photos.length === 0) {
    return <p className="photo-grid-empty">{t("photos.empty")}</p>;
  }
  return (
    <div className="photo-grid">
      {photos.map((p) => (
        <figure key={p.id}>
          <img
            src={p.url}
            alt={p.caption ?? ""}
            loading="lazy"
            decoding="async"
            width={640}
            height={480}
            style={{ aspectRatio: "4 / 3", width: "100%", height: "auto" }}
          />
          {p.caption && <figcaption>{p.caption}</figcaption>}
        </figure>
      ))}
    </div>
  );
}

export default PhotoGrid;
