import { useEffect } from "react";
import type { PersonDetailData } from "../api/types";
import { useT } from "../i18n/LangContext";
import PersonFacts from "./PersonFacts";

function PortraitDialog({
  person,
  onClose,
}: {
  person: PersonDetailData;
  onClose: () => void;
}) {
  const t = useT();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="portrait-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t("person.portrait")}
      onClick={onClose}
    >
      <div className="portrait-dialog" onClick={(e) => e.stopPropagation()}>
        {person.profile_image_url && (
          <img
            className="profile-img"
            src={person.profile_image_url}
            alt={person.display_name}
          />
        )}
        <h2>{person.display_name}</h2>
        {person.bio && <p>{person.bio}</p>}
        <PersonFacts person={person} />
        <button
          type="button"
          aria-label={t("lightbox.close")}
          onClick={onClose}
        >
          ×
        </button>
      </div>
    </div>
  );
}

export default PortraitDialog;
