// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Login from "./Login";
import { AuthProvider } from "../auth/AuthContext";
import { getMe, login } from "../api/auth";
import type { AuthError } from "../api/auth";

// Mock ONLY the network boundary. The real AuthProvider/useAuth wiring runs so
// the test proves the actual login -> navigate path, not a stubbed shortcut.
vi.mock("../api/auth", () => ({
  getMe: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}));

const mockedGetMe = vi.mocked(getMe);
const mockedLogin = vi.mocked(login);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderLogin() {
  // getMe settles the provider into a known (anon) state on mount.
  mockedGetMe.mockResolvedValue({ authed: false });
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/admin" element={<div>ADMIN DASHBOARD</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

function typePassword(value: string) {
  const input = screen.getByLabelText("Password") as HTMLInputElement;
  fireEvent.change(input, { target: { value } });
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: "Log in" }));
}

describe("Login", () => {
  it("calls login() with the typed password and navigates on success", async () => {
    mockedLogin.mockResolvedValue({ authed: true });

    renderLogin();
    typePassword("s3cret");
    submit();

    // Navigation is observed via the destination route's content appearing.
    expect(await screen.findByText("ADMIN DASHBOARD")).toBeTruthy();
    expect(mockedLogin).toHaveBeenCalledTimes(1);
    expect(mockedLogin).toHaveBeenCalledWith("s3cret");
    // The login form is gone -> we genuinely left /login.
    expect(screen.queryByRole("button", { name: "Log in" })).toBeNull();
  });

  it("shows an error and does NOT navigate when login rejects with status 401", async () => {
    const err = new Error("Request failed: 401") as AuthError;
    err.status = 401;
    mockedLogin.mockRejectedValue(err);

    renderLogin();
    typePassword("wrong-pw");
    submit();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Wrong password.");
    // FALSIFIABILITY: a rejected login must not navigate away.
    expect(screen.queryByText("ADMIN DASHBOARD")).toBeNull();
    expect(screen.getByRole("button", { name: "Log in" })).toBeTruthy();
    expect(mockedLogin).toHaveBeenCalledWith("wrong-pw");
  });
});
