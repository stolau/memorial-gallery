// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import { useAuth } from "./AuthContext";

// Control the auth state directly so each case is deterministic.
vi.mock("./AuthContext", () => ({
  useAuth: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function setAuth(authed: boolean | null) {
  mockedUseAuth.mockReturnValue({
    authed,
    login: vi.fn(),
    logout: vi.fn(),
    clearAuth: vi.fn(),
  });
}

function renderTree() {
  return render(
    <MemoryRouter initialEntries={["/admin"]}>
      <Routes>
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <div>PROTECTED CONTENT</div>
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<div>LOGIN PAGE</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute", () => {
  it("renders neither the child nor a redirect while loading (authed===null)", () => {
    setAuth(null);

    renderTree();

    expect(screen.queryByText("PROTECTED CONTENT")).toBeNull();
    expect(screen.queryByText("LOGIN PAGE")).toBeNull();
  });

  it("redirects anonymous users to /login", () => {
    setAuth(false);

    renderTree();

    expect(screen.getByText("LOGIN PAGE")).toBeTruthy();
    // FALSIFIABILITY: the guarded child must NOT leak through on a redirect.
    expect(screen.queryByText("PROTECTED CONTENT")).toBeNull();
  });

  it("renders the protected child for an authenticated user", () => {
    setAuth(true);

    renderTree();

    expect(screen.getByText("PROTECTED CONTENT")).toBeTruthy();
    expect(screen.queryByText("LOGIN PAGE")).toBeNull();
  });
});
