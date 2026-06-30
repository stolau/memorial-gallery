import type { Photo } from "../api/types";

function PhotoGrid({ photos }: { photos: Photo[] }) {
  if (photos.length === 0) {
    return <p className="photo-grid-empty">No photos yet.</p>;
  }
  return (
    <div className="photo-grid">
      {photos.map((p) => (
        <figure key={p.id}>
          <img src={p.url} alt={p.caption ?? ""} />
          {p.caption && <figcaption>{p.caption}</figcaption>}
        </figure>
      ))}
    </div>
  );
}

export default PhotoGrid;
