export interface AuthError extends Error {
  status: number;
}

async function postJson(path: string, body?: unknown): Promise<{ authed: boolean }> {
  const res = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const err = new Error(
      `Request to ${path} failed: ${res.status} ${res.statusText}`,
    ) as AuthError;
    err.status = res.status;
    throw err;
  }
  return res.json() as Promise<{ authed: boolean }>;
}

export function login(password: string): Promise<{ authed: boolean }> {
  return postJson("/api/login", { password });
}

export function logout(): Promise<{ authed: boolean }> {
  return postJson("/api/logout");
}

export async function getMe(): Promise<{ authed: boolean }> {
  const res = await fetch("/api/me", { credentials: "include" });
  if (!res.ok) {
    const err = new Error(
      `Request to /api/me failed: ${res.status} ${res.statusText}`,
    ) as AuthError;
    err.status = res.status;
    throw err;
  }
  return res.json() as Promise<{ authed: boolean }>;
}
