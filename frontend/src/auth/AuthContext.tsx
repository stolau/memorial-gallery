import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getMe, login as apiLogin, logout as apiLogout } from "../api/auth";

const AuthContext = createContext<{
  authed: boolean | null;
  login: (pw: string) => Promise<void>;
  logout: () => Promise<void>;
}>({
  authed: null,
  login: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    getMe()
      .then((r) => setAuthed(r.authed))
      .catch(() => setAuthed(false));
  }, []);

  const login = async (pw: string) => {
    await apiLogin(pw);
    setAuthed(true);
  };

  const logout = async () => {
    await apiLogout();
    setAuthed(false);
  };

  return (
    <AuthContext.Provider value={{ authed, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
