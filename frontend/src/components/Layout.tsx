import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useT, useLang } from "../i18n/LangContext";
import "./components.css";

function Layout({ children }: { children: ReactNode }) {
  const t = useT();
  const { lang, setLang } = useLang();
  return (
    <>
      <header className="site-header">
        <Link to="/" className="site-title">
          Kaijankoski
        </Link>
        <nav className="site-nav">
          <Link to="/events">{t("nav.events")}</Link>
          <button
            type="button"
            aria-pressed={lang === "fi"}
            onClick={() => setLang("fi")}
          >
            FI
          </button>
          <button
            type="button"
            aria-pressed={lang === "en"}
            onClick={() => setLang("en")}
          >
            EN
          </button>
        </nav>
      </header>
      <main className="page-main">{children}</main>
    </>
  );
}

export default Layout;
