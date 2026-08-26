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
  getContacts,
  getFamilyLines,
} from "../../api/client";
import {
  deletePerson,
  deleteEvent,
  deleteCollection,
  deleteFamilyLine,
  createContact,
  updateContact,
  deleteContact,
} from "../../api/admin";
import type { AuthError } from "../../api/auth";
import type {
  Person,
  Event,
  Collection,
  Contact,
  FamilyLine,
} from "../../api/types";

// Mock only the network boundary + auth. Router + i18n stay real.
vi.mock("../../api/client", () => ({
  getPeople: vi.fn(),
  getEvents: vi.fn(),
  getCollections: vi.fn(),
  getContacts: vi.fn(),
  getFamilyLines: vi.fn(),
}));
vi.mock("../../api/admin", () => ({
  deletePerson: vi.fn(),
  deleteEvent: vi.fn(),
  deleteCollection: vi.fn(),
  deleteFamilyLine: vi.fn(),
  createContact: vi.fn(),
  updateContact: vi.fn(),
  deleteContact: vi.fn(),
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
const mockedGetContacts = vi.mocked(getContacts);
const mockedGetFamilyLines = vi.mocked(getFamilyLines);
const mockedDeletePerson = vi.mocked(deletePerson);
const mockedDeleteEvent = vi.mocked(deleteEvent);
const mockedDeleteCollection = vi.mocked(deleteCollection);
const mockedDeleteFamilyLine = vi.mocked(deleteFamilyLine);
const mockedCreateContact = vi.mocked(createContact);
const mockedUpdateContact = vi.mocked(updateContact);
const mockedDeleteContact = vi.mocked(deleteContact);

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
    kind: null,
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

const contacts: Contact[] = [
  {
    id: 1,
    position: 1,
    name: "Anssi",
    role: "Ylläpitäjä",
    phone: null,
    email: "anssi@example.com",
  },
];

const familyLines: FamilyLine[] = [
  {
    id: 3,
    slug: "kaijankoski",
    name: "Kaijankosken päälinja",
    year_range: "1850–",
    note: null,
    position: 1,
    members: [],
  },
];

function seedLoads() {
  mockedGetPeople.mockResolvedValue(people);
  mockedGetEvents.mockResolvedValue(events);
  mockedGetCollections.mockResolvedValue(collections);
  mockedGetContacts.mockResolvedValue(contacts);
  mockedGetFamilyLines.mockResolvedValue(familyLines);
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


describe("AdminDashboard - family lines", () => {
  it("renders a family line with an edit link to its route", async () => {
    seedLoads();
    renderDashboard();

    const line = await screen.findByText("Kaijankosken päälinja");
    const row = line.closest("li")!;
    const editLink = within(row).getByRole("link", { name: "Muokkaa" });
    expect(editLink.getAttribute("href")).toBe(
      "/admin/family-lines/kaijankoski/edit",
    );
  });

  it("deletes a family line and refetches the list", async () => {
    seedLoads();
    mockedDeleteFamilyLine.mockResolvedValue({ deleted: true });
    vi.spyOn(window, "confirm").mockReturnValue(true);

    renderDashboard();

    const line = await screen.findByText("Kaijankosken päälinja");
    const row = line.closest("li")!;
    fireEvent.click(within(row).getByRole("button", { name: "Poista" }));

    await waitFor(() =>
      expect(mockedDeleteFamilyLine).toHaveBeenCalledWith("kaijankoski"),
    );
    // Refetch: getFamilyLines called on mount + after delete.
    expect(mockedGetFamilyLines).toHaveBeenCalledTimes(2);
  });
});

describe("AdminDashboard - contacts", () => {
  it("seeds each contact row from the initial getContacts payload", async () => {
    seedLoads();
    renderDashboard();

    const nameInputs = (await screen.findAllByLabelText(
      "Nimi",
    )) as HTMLInputElement[];
    expect(nameInputs[0].value).toBe("Anssi");
    const emailInputs = screen.getAllByLabelText(
      "Sähköposti",
    ) as HTMLInputElement[];
    expect(emailInputs[0].value).toBe("anssi@example.com");
  });

  it("adds a new contact and refetches the list", async () => {
    seedLoads();
    mockedCreateContact.mockResolvedValue({
      id: 2,
      position: 2,
      name: "Aino",
      role: null,
      phone: null,
      email: null,
    });

    renderDashboard();

    await screen.findAllByLabelText("Nimi");
    // The add form is the last row: its name input is the last "Nimi".
    const nameInputs = screen.getAllByLabelText("Nimi") as HTMLInputElement[];
    fireEvent.change(nameInputs[nameInputs.length - 1], {
      target: { value: "Aino" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lisää uusi" }));

    await waitFor(() =>
      expect(mockedCreateContact).toHaveBeenCalledWith({
        name: "Aino",
        role: null,
        phone: null,
        email: null,
      }),
    );
    expect(mockedGetContacts).toHaveBeenCalledTimes(2);
  });

  it("routes a 401 from a contact mutation through clearAuth", async () => {
    seedLoads();
    const err = { status: 401 } as AuthError;
    mockedUpdateContact.mockRejectedValue(err);

    renderDashboard();

    await screen.findAllByLabelText("Nimi");
    // First "Tallenna" belongs to the seeded contact row.
    fireEvent.click(screen.getAllByRole("button", { name: "Tallenna" })[0]);

    await waitFor(() => expect(clearAuth).toHaveBeenCalledTimes(1));
  });

  it("deletes a contact via its row", async () => {
    seedLoads();
    mockedDeleteContact.mockResolvedValue({ deleted: true });
    vi.spyOn(window, "confirm").mockReturnValue(true);

    renderDashboard();

    await screen.findAllByLabelText("Nimi");
    // Scope to the contact row via its seeded email input.
    const emailInput = screen.getAllByLabelText("Sähköposti")[0];
    const row = emailInput.closest("form")!;
    fireEvent.click(within(row).getByRole("button", { name: "Poista" }));

    await waitFor(() => expect(mockedDeleteContact).toHaveBeenCalledWith(1));
  });
});
