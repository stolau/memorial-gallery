import { afterEach, describe, expect, it, vi } from "vitest";
import { getMe, login } from "./auth";
import type { AuthError } from "./auth";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("auth api", () => {
  it("login() POSTs JSON {password} to /api/login with credentials:include", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ authed: true }),
    } as Response);

    const result = await login("hunter2");

    expect(result).toEqual({ authed: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [calledPath, calledOptions] = fetchMock.mock.calls[0];
    expect(calledPath).toBe("/api/login");
    expect(calledOptions).toMatchObject({
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    // Body must be the JSON-encoded password, not form data.
    expect(calledOptions?.body).toBe(JSON.stringify({ password: "hunter2" }));
  });

  it("login() throws an AuthError carrying .status===401 on a 401 response (falsifiability for error propagation)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
    } as Response);

    // The promise must REJECT (a regression that swallowed the !ok branch and
    // resolved would fail this) and the thrown error must carry status 401.
    await expect(login("wrong")).rejects.toMatchObject({ status: 401 });

    let caught: AuthError | undefined;
    try {
      await login("wrong");
    } catch (e) {
      caught = e as AuthError;
    }
    expect(caught).toBeInstanceOf(Error);
    expect(caught?.status).toBe(401);
  });

  it("getMe() GETs /api/me with credentials:include", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ authed: false }),
    } as Response);

    const result = await getMe();

    expect(result).toEqual({ authed: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledPath, calledOptions] = fetchMock.mock.calls[0];
    expect(calledPath).toBe("/api/me");
    expect(calledOptions).toMatchObject({ credentials: "include" });
    // GET: there must be no explicit POST method.
    expect(calledOptions?.method).toBeUndefined();
  });
});
