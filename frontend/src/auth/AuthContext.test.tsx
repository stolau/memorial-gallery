// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AuthProvider, useAuth } from "./AuthContext";
import { getMe, logout } from "../api/auth";

vi.mock("../api/auth", () => ({
  getMe: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}));

const mockedGetMe = vi.mocked(getMe);
const mockedLogout = vi.mocked(logout);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// A consumer that renders a stable, distinguishable token for each of the
// three possible states so tests can assert on observable output.
function StateProbe() {
  const { authed } = useAuth();
  if (authed === null) return <p>state:loading</p>;
  if (authed === true) return <p>state:authed</p>;
  return <p>state:anon</p>;
}

function renderProbe() {
  render(
    <AuthProvider>
      <StateProbe />
    </AuthProvider>,
  );
}

// A consumer that also exposes a button to invoke clearAuth() so a test can
// assert the local-only state reset (no network logout).
function ClearAuthProbe() {
  const { authed, clearAuth } = useAuth();
  return (
    <>
      {authed === null && <p>state:loading</p>}
      {authed === true && <p>state:authed</p>}
      {authed === false && <p>state:anon</p>}
      <button type="button" onClick={clearAuth}>
        clear
      </button>
    </>
  );
}

describe("AuthContext", () => {
  it("starts in the loading state (authed===null) before getMe resolves", () => {
    // Never resolves -> the provider stays in its initial state.
    mockedGetMe.mockReturnValue(new Promise<{ authed: boolean }>(() => {}));

    renderProbe();

    expect(screen.getByText("state:loading")).toBeTruthy();
    expect(screen.queryByText("state:authed")).toBeNull();
    expect(screen.queryByText("state:anon")).toBeNull();
  });

  it("resolves to the authed state when getMe reports {authed:true}", async () => {
    mockedGetMe.mockResolvedValue({ authed: true });

    renderProbe();

    expect(await screen.findByText("state:authed")).toBeTruthy();
    // FALSIFIABILITY: a true session must NOT surface the anon/false state.
    expect(screen.queryByText("state:anon")).toBeNull();
    expect(screen.queryByText("state:loading")).toBeNull();
  });

  it("resolves to the anon state when getMe reports {authed:false}", async () => {
    mockedGetMe.mockResolvedValue({ authed: false });

    renderProbe();

    expect(await screen.findByText("state:anon")).toBeTruthy();
    expect(screen.queryByText("state:authed")).toBeNull();
  });

  it("falls back to the anon state when getMe rejects", async () => {
    mockedGetMe.mockRejectedValue(new Error("network down"));

    renderProbe();

    expect(await screen.findByText("state:anon")).toBeTruthy();
    expect(screen.queryByText("state:authed")).toBeNull();
  });

  it("clearAuth() flips authed session to anon WITHOUT calling network logout", async () => {
    mockedGetMe.mockResolvedValue({ authed: true });

    render(
      <AuthProvider>
        <ClearAuthProbe />
      </AuthProvider>,
    );

    expect(await screen.findByText("state:authed")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "clear" }));

    expect(await screen.findByText("state:anon")).toBeTruthy();
    expect(screen.queryByText("state:authed")).toBeNull();
    // clearAuth is a local reset only: the network logout must NOT fire.
    expect(mockedLogout).not.toHaveBeenCalled();
  });
});
