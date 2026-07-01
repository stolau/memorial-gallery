// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AdminLayout from "./AdminLayout";
import { LangProvider } from "../i18n/LangContext";

const { logout } = vi.hoisted(() => ({
  logout: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({
    authed: true,
    login: vi.fn(),
    logout,
    clearAuth: vi.fn(),
  }),
}));

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigate };
});

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={["/admin/people/kalevi/edit"]}>
      <LangProvider>
        <AdminLayout>
          <div>CHILD CONTENT</div>
        </AdminLayout>
      </LangProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AdminLayout", () => {
  it("renders the dashboard link, logout button and FI/EN toggles", () => {
    renderLayout();

    const dashLink = document.querySelector('a[href="/admin"]');
    expect(dashLink).toBeTruthy();
    expect(dashLink?.textContent).toBe("Hallintapaneeli");

    expect(screen.getByRole("button", { name: "Kirjaudu ulos" })).toBeTruthy();

    // Default lang is fi -> FI is the pressed toggle, EN is not.
    expect(
      screen.getByRole("button", { name: "FI" }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      screen.getByRole("button", { name: "EN" }).getAttribute("aria-pressed"),
    ).toBe("false");

    expect(screen.getByText("CHILD CONTENT")).toBeTruthy();
  });

  it("logs out then navigates to /login", async () => {
    renderLayout();

    fireEvent.click(screen.getByRole("button", { name: "Kirjaudu ulos" }));

    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/login"));
  });

  it("does not navigate to /login before logout is invoked (falsifiability)", () => {
    renderLayout();

    // No click yet -> the navigation must not have fired.
    expect(navigate).not.toHaveBeenCalled();
  });
});
