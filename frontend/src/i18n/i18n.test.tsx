// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import EventsIndex from "../pages/EventsIndex";
import { getEvents } from "../api/client";
import { LangProvider, useT } from "./LangContext";
import { strings } from "./strings";

// Mock ONLY the network boundary — everything i18n stays real.
vi.mock("../api/client", () => ({ getEvents: vi.fn() }));

const mockedGetEvents = vi.mocked(getEvents);

function renderEvents() {
  return render(
    <LangProvider>
      <MemoryRouter>
        <EventsIndex />
      </MemoryRouter>
    </LangProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  mockedGetEvents.mockReset();
  mockedGetEvents.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
});

describe("i18n EventsIndex integration", () => {
  it("defaults to fi: shows empty state, heading, no loading, and not the en string", async () => {
    renderEvents();

    // Unique empty-state string is safe for findByText.
    expect(await screen.findByText("Ei vielä tapahtumia.")).toBeTruthy();

    // "Tapahtumat" appears twice (nav + h1) — disambiguate via heading role.
    expect(
      screen.getByRole("heading", { name: "Tapahtumat" }),
    ).toBeTruthy();

    // Loading text gone after fetch resolves.
    expect(screen.queryByText("Ladataan…")).toBeNull();

    // Falsifiability check 1: en string must be absent in default fi.
    expect(screen.queryByText("No events yet.")).toBeNull();
  });

  it("switches to en via the real switcher and persists the choice", async () => {
    renderEvents();

    // Wait for fi to settle first.
    expect(await screen.findByText("Ei vielä tapahtumia.")).toBeTruthy();

    // Drive the REAL setLang through the REAL switcher button.
    fireEvent.click(screen.getByRole("button", { name: /english/i }));

    // Unique en empty-state string is now present.
    expect(await screen.findByText("No events yet.")).toBeTruthy();

    // fi string is gone.
    expect(screen.queryByText("Ei vielä tapahtumia.")).toBeNull();

    // English heading via role (still appears twice: nav + h1).
    expect(screen.getByRole("heading", { name: "Events" })).toBeTruthy();

    // Persistence.
    expect(localStorage.getItem("lang")).toBe("en");
  });

  it("falls back to the literal key when a key is missing (real useT)", () => {
    function Probe() {
      const t = useT();
      return <span data-testid="probe">{t("does.not.exist")}</span>;
    }

    render(
      <LangProvider>
        <Probe />
      </LangProvider>,
    );

    expect(screen.getByTestId("probe").textContent).toBe("does.not.exist");
  });

  it("has identical key sets across fi and en (key-parity guard)", () => {
    expect(Object.keys(strings.fi).sort()).toEqual(
      Object.keys(strings.en).sort(),
    );
  });
});
