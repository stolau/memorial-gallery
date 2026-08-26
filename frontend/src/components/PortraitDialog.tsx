import { useEffect } from "react";
import type { PersonDetailData } from "../api/types";
import { useT } from "../i18n/LangContext";
import Paragraphs from "./Paragraphs";
import PersonFacts from "./PersonFacts";

// Two-column "info" modal: portrait + facts on the left, eyebrow + name +
// bio on the right. Closes on Escape, a backdrop click, or the × button.
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
        <button
          type="button"
          className="dialog-close"
          aria-label={t("lightbox.close")}
          onClick={onClose}
        >
          ×
        </button>
        <div className="info-cols">
          <div className="info-left">
            {person.profile_image_url && (
              <img
                className="profile-img"
                src={person.profile_image_url}
                alt={person.display_name}
              />
            )}
            <PersonFacts person={person} />
          </div>
          <div className="info-right">
            <p className="info-eyebrow">{t("inMemoriam")}</p>
            <h2 className="info-name">{person.display_name}</h2>
            {person.bio && (
              <div className="info-bio">
                <Paragraphs text={person.bio} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PortraitDialog;
