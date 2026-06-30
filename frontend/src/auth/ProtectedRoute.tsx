import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { authed } = useAuth();
  const location = useLocation();

  if (authed === null) {
    return null;
  }
  if (authed === false) {
    return (
      <Navigate
        to={`/login?next=${encodeURIComponent(location.pathname)}`}
        replace
      />
    );
  }
  return <>{children}</>;
}

export default ProtectedRoute;
