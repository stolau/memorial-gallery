import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { getContact } from "../api/client";
import type { Contact } from "../api/types";
import { useT, useLang } from "../i18n/LangContext";
import "./components.css";

function Layout({ children }: { children: ReactNode }) {
  const t = useT();
  const { lang, setLang } = useLang();
  const [contact, setContact] = useState<Contact | null>(null);

  useEffect(() => {
    // Best-effort: a failed contact fetch must not break the chrome.
    getContact()
      .then(setContact)
      .catch(() => setContact(null));
  }, []);

  const hasContact =
    contact !== null &&
    (contact.contact_name || contact.contact_email || contact.contact_phone);

  return (
    <>
      <header className="site-header">
        <Link to="/" className="site-title">
          Kaijankoski
        </Link>
        <nav className="site-nav">
          <Link to="/events">{t("nav.events")}</Link>
          <Link to="/collections">{t("nav.collections")}</Link>
          <span className="lang-switch">
            <button
              type="button"
              aria-label="Suomi"
              aria-pressed={lang === "fi"}
              onClick={() => setLang("fi")}
            >
              <svg viewBox="0 0 18 11" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                <rect width="18" height="11" fill="#fff" />
                <rect y="4" width="18" height="3" fill="#003580" />
                <rect x="5" width="3" height="11" fill="#003580" />
              </svg>
            </button>
            <button
              type="button"
              aria-label="English"
              aria-pressed={lang === "en"}
              onClick={() => setLang("en")}
            >
              <svg viewBox="0 0 60 30" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                <clipPath id="uk-saltire-clip">
                  <path d="M30,15 h30 v15 z v-15 h-30 z h-30 v-15 z v15 h30 z" />
                </clipPath>
                <rect width="60" height="30" fill="#012169" />
                <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
                <path d="M0,0 L60,30 M60,0 L0,30" clipPath="url(#uk-saltire-clip)" stroke="#C8102E" strokeWidth="4" />
                <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
                <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
              </svg>
            </button>
          </span>
        </nav>
        {hasContact && (
          <div className="site-contact">
            {contact!.contact_name && (
              <span className="site-contact-name">{contact!.contact_name}</span>
            )}
            {contact!.contact_email && (
              <a
                className="site-contact-email"
                href={`mailto:${contact!.contact_email}`}
              >
                {contact!.contact_email}
              </a>
            )}
            {contact!.contact_phone && (
              <a
                className="site-contact-phone"
                href={`tel:${contact!.contact_phone}`}
              >
                {contact!.contact_phone}
              </a>
            )}
          </div>
        )}
      </header>
      <main className="page-main">{children}</main>
    </>
  );
}

export default Layout;
