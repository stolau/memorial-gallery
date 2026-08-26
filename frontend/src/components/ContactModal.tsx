import { useEffect, useState } from "react";
import { getContacts } from "../api/client";
import type { Contact } from "../api/types";
import { useT } from "../i18n/LangContext";

// Header "Info" modal: the eyebrow/title/note plus a list of contact cards
// (name / role / tel: + mailto: links). Fetches getContacts on open. Closes
// on Escape or a backdrop click.
function ContactModal({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [contacts, setContacts] = useState<Contact[] | null>(null);

  useEffect(() => {
    getContacts()
      .then(setContacts)
      .catch(() => setContacts([]));
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="contact-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t("contactTitle")}
      onClick={onClose}
    >
      <div className="contact-dialog" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="dialog-close"
          aria-label={t("lightbox.close")}
          onClick={onClose}
        >
          ×
        </button>
        <p className="contact-eyebrow">{t("contact")}</p>
        <h2 className="contact-title">{t("contactTitle")}</h2>
        <p className="contact-note">{t("contactNote")}</p>
        {contacts && contacts.length > 0 && (
          <ul className="contact-list">
            {contacts.map((c) => (
              <li key={c.id} className="contact-card">
                <p className="contact-name">{c.name}</p>
                {c.role && <p className="contact-role">{c.role}</p>}
                {(c.phone || c.email) && (
                  <div className="contact-links">
                    {c.phone && <a href={`tel:${c.phone}`}>{c.phone}</a>}
                    {c.email && <a href={`mailto:${c.email}`}>{c.email}</a>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default ContactModal;
