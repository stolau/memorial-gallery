import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { AuthError } from "../api/auth";
import { useAuth } from "../auth/AuthContext";

function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login(password);
      navigate(searchParams.get("next") || "/admin");
    } catch (err) {
      if ((err as AuthError).status === 401) {
        setError("Wrong password.");
      } else {
        setError((err as Error).message);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      <button type="submit">Log in</button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}

export default Login;
