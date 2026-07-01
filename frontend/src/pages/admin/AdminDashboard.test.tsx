// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AdminDashboard from "./AdminDashboard";
import { LangProvider } from "../../i18n/LangContext";
import { getPeople, getEvents } from "../../api/client";
import { deletePerson, deleteEvent } from "../../api/admin";
import type { AuthError } from "../../api/auth";
import type { Person, Event } from "../../api/types";

// Mock only the network boundary + auth. Router + i18n stay real.
vi.mock("../../api/client", () => ({
  getPeople: vi.fn(),
  getEvents: vi.fn(),
}));
vi.mock("../../api/admin", () => ({
  deletePerson: vi.fn(),
  deleteEvent: vi.fn(),
}));

const { clearAuth } = vi.hoisted(() => ({ clearAuth: vi.fn() }));
vi.mock("../../auth/AuthContext", () => ({
  useAuth: () => ({
    authed: true,
    login: vi.fn(),
    logout: vi.fn(),
    clearAuth,
  }),
}));

const mockedGetPeople = vi.mocked(getPeople);
const mockedGetEvents = vi.mocked(getEvents);
const mockedDeletePerson = vi.mocked(deletePerson);
const mockedDeleteEvent = vi.mocked(deleteEvent);

const people: Person[] = [
  {
    id: 1,
    slug: "kalevi",
    display_name: "Kalevi Koski",
    bio: null,
    profile_image: null,
    profile_image_url: null,
  },
  {
    id: 2,
    slug: "aino",
    display_name: "Aino Koski",
    bio: null,
    profile_image: null,
    profile_image_url: null,
  },
];

const events: Event[] = [
  {
    id: 5,
    slug: "wedding",
    name: "Wedding 1950",
    description: null,
    event_time: null,
    place: null,
    cover_filename: null,
    cover_url: null,
  },
];

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={["/admin"]}>
      <LangProvider>
        <AdminDashboard />
      </LangProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AdminDashboard", () => {
  it("renders people + events and an edit link to the person route", async () => {
    mockedGetPeople.mockResolvedValue(people);
    mockedGetEvents.mockResolvedValue(events);

    renderDashboard();

    expect(await screen.findByText("Kalevi Koski")).toBeTruthy();
    expect(screen.getByText("Aino Koski")).toBeTruthy();
    expect(screen.getByText("Wedding 1950")).toBeTruthy();

    // The edit link points at the real person edit route.
    const editLink = document.querySelector(
      'a[href="/admin/people/kalevi/edit"]',
    );
    expect(editLink).toBeTruthy();
    expect(editLink?.textContent).toBe("Muokkaa");
  });

  it("deletes the row's person and refetches on confirm=true", async () => {
    mockedGetPeople.mockResolvedValue(people);
    mockedGetEvents.mockResolvedValue(events);
    mockedDeletePerson.mockResolvedValue({ deleted: true });
    vi.spyOn(window, "confirm").mockReturnValue(true);

    renderDashboard();

    const row = (await screen.findByText("Kalevi Koski")).closest(
      "li",
    ) as HTMLLIElement;
    fireEvent.click(within(row).getByRole("button", { name: "Poista" }));

    await waitFor(() =>
      expect(mockedDeletePerson).toHaveBeenCalledWith("kalevi"),
    );
    // Mount fetch (1) + post-delete refetch (2).
    await waitFor(() => expect(mockedGetPeople).toHaveBeenCalledTimes(2));
  });

  it("does NOT delete or refetch when confirm=false (falsifiability)", async () => {
    mockedGetPeople.mockResolvedValue(people);
    mockedGetEvents.mockResolvedValue(events);
    vi.spyOn(window, "confirm").mockReturnValue(false);

    renderDashboard();

    const row = (await screen.findByText("Kalevi Koski")).closest(
      "li",
    ) as HTMLLIElement;
    fireEvent.click(within(row).getByRole("button", { name: "Poista" }));

    expect(mockedDeletePerson).not.toHaveBeenCalled();
    // Only the single mount fetch happened; no refetch.
    expect(mockedGetPeople).toHaveBeenCalledTimes(1);
  });

  it("calls clearAuth once when deletePerson rejects with 401", async () => {
    mockedGetPeople.mockResolvedValue(people);
    mockedGetEvents.mockResolvedValue(events);
    const err = { status: 401 } as AuthError;
    mockedDeletePerson.mockRejectedValue(err);
    vi.spyOn(window, "confirm").mockReturnValue(true);

    renderDashboard();

    const row = (await screen.findByText("Kalevi Koski")).closest(
      "li",
    ) as HTMLLIElement;
    fireEvent.click(within(row).getByRole("button", { name: "Poista" }));

    await waitFor(() => expect(clearAuth).toHaveBeenCalledTimes(1));
    // FALSIFIABILITY: a 401 must not trigger a people refetch.
    expect(mockedGetPeople).toHaveBeenCalledTimes(1);
    expect(mockedDeleteEvent).not.toHaveBeenCalled();
  });
});
