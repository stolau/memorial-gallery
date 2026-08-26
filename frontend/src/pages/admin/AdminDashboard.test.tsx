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
import {
  getPeople,
  getEvents,
  getCollections,
  getContact,
} from "../../api/client";
import {
  deletePerson,
  deleteEvent,
  deleteCollection,
  updateContact,
} from "../../api/admin";
import type { AuthError } from "../../api/auth";
import type { Person, Event, Collection, Contact } from "../../api/types";

// Mock only the network boundary + auth. Router + i18n stay real.
vi.mock("../../api/client", () => ({
  getPeople: vi.fn(),
  getEvents: vi.fn(),
  getCollections: vi.fn(),
  getContact: vi.fn(),
}));
vi.mock("../../api/admin", () => ({
  deletePerson: vi.fn(),
  deleteEvent: vi.fn(),
  deleteCollection: vi.fn(),
  updateContact: vi.fn(),
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
const mockedGetCollections = vi.mocked(getCollections);
const mockedGetContact = vi.mocked(getContact);
const mockedDeletePerson = vi.mocked(deletePerson);
const mockedDeleteEvent = vi.mocked(deleteEvent);
const mockedDeleteCollection = vi.mocked(deleteCollection);
const mockedUpdateContact = vi.mocked(updateContact);

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

const collections: Collection[] = [
  {
    id: 8,
    slug: "suku",
    name: "Kaijankosken suku",
    info: null,
    profile_image: null,
    cover_filename: null,
    cover_url: null,
  },
];

const contact: Contact = {
  contact_name: "Anssi",
  contact_email: "anssi@example.com",
  contact_phone: null,
};

function seedLoads() {
  mockedGetPeople.mockResolvedValue(people);
  mockedGetEvents.mockResolvedValue(events);
  mockedGetCollections.mockResolvedValue(collections);
  mockedGetContact.mockResolvedValue(contact);
}

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
    seedLoads();

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
    seedLoads();
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
    seedLoads();
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
    seedLoads();
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

describe("AdminDashboard - collections", () => {
  it("renders the collection with an edit link and a new-collection link", async () => {
    seedLoads();

    renderDashboard();

    expect(await screen.findByText("Kaijankosken suku")).toBeTruthy();
    expect(
      document.querySelector('a[href="/admin/collections/suku/edit"]'),
    ).toBeTruthy();
    expect(
      document.querySelector('a[href="/admin/collections/new"]'),
    ).toBeTruthy();
  });

  it("deletes the collection and refetches on confirm=true", async () => {
    seedLoads();
    mockedDeleteCollection.mockResolvedValue({ deleted: true });
    vi.spyOn(window, "confirm").mockReturnValue(true);

    renderDashboard();

    const row = (await screen.findByText("Kaijankosken suku")).closest(
      "li",
    ) as HTMLLIElement;
    fireEvent.click(within(row).getByRole("button", { name: "Poista" }));

    await waitFor(() =>
      expect(mockedDeleteCollection).toHaveBeenCalledWith("suku"),
    );
    // Mount fetch (1) + post-delete refetch (2). People are NOT refetched.
    await waitFor(() =>
      expect(mockedGetCollections).toHaveBeenCalledTimes(2),
    );
    expect(mockedGetPeople).toHaveBeenCalledTimes(1);
  });
});

describe("AdminDashboard - contact", () => {
  it("seeds the contact form and PUTs the edited fields on save", async () => {
    seedLoads();
    mockedUpdateContact.mockResolvedValue({
      contact_name: "Anssi Uistola",
      contact_email: "anssi@example.com",
      contact_phone: "+358401234567",
    });

    renderDashboard();

    // Form seeded from the initial getContact payload.
    const nameInput = (await screen.findByLabelText(
      "Nimi",
    )) as HTMLInputElement;
    // The contact form holds the only labelled inputs on the dashboard.
    const emailInput = screen.getByLabelText(
      "Sähköposti",
    ) as HTMLInputElement;
    expect(emailInput.value).toBe("anssi@example.com");

    fireEvent.change(nameInput, { target: { value: "Anssi Uistola" } });
    fireEvent.change(screen.getByLabelText("Puhelin"), {
      target: { value: "+358401234567" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Tallenna" }));

    await waitFor(() => expect(mockedUpdateContact).toHaveBeenCalledTimes(1));
    expect(mockedUpdateContact).toHaveBeenCalledWith({
      contact_name: "Anssi Uistola",
      contact_email: "anssi@example.com",
      contact_phone: "+358401234567",
    });
    // Confirmation message appears after a successful save.
    expect(await screen.findByText("Yhteystiedot tallennettu.")).toBeTruthy();
  });

  it("routes a 401 from updateContact through clearAuth (falsifiability twin)", async () => {
    seedLoads();
    const err = { status: 401 } as AuthError;
    mockedUpdateContact.mockRejectedValue(err);

    renderDashboard();

    await screen.findByLabelText("Sähköposti");
    fireEvent.click(screen.getByRole("button", { name: "Tallenna" }));

    await waitFor(() => expect(clearAuth).toHaveBeenCalledTimes(1));
    // No success confirmation on failure.
    expect(screen.queryByText("Yhteystiedot tallennettu.")).toBeNull();
  });
});
