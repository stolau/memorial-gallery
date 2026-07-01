import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useT, useLang } from "../i18n/LangContext";
import "./components.css";

function AdminLayout({ children }: { children: ReactNode }) {
  const t = useT();
  const { lang, setLang } = useLang();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <>
      <header className="site-header">
        <Link to="/admin" className="site-title">
          {t("admin.nav.dashboard")}
        </Link>
        <nav className="site-nav">
          <button type="button" onClick={handleLogout}>
            {t("admin.nav.logout")}
          </button>
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

export default AdminLayout;
