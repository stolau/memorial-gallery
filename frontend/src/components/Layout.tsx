import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import "./components.css";

function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="site-header">
        <Link to="/" className="site-title">
          Kaijankoski
        </Link>
        <nav className="site-nav">
          <Link to="/events">Events</Link>
        </nav>
      </header>
      <main className="page-main">{children}</main>
    </>
  );
}

export default Layout;
