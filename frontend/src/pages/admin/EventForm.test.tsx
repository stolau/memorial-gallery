// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import EventForm from "./EventForm";
import { LangProvider } from "../../i18n/LangContext";
import { getEvent } from "../../api/client";
import {
  createEvent,
  updateEvent,
  deleteEventPhoto,
  deletePersonPhoto,
} from "../../api/admin";
import type { AuthError } from "../../api/auth";
import type { Event, EventDetail } from "../../api/types";

vi.mock("../../api/client", () => ({ getEvent: vi.fn() }));
vi.mock("../../api/admin", () => ({
  createEvent: vi.fn(),
  updateEvent: vi.fn(),
  deleteEventPhoto: vi.fn(),
  uploadEventPhotos: vi.fn(),
  // Included so the test can prove it is NEVER called from EventForm (FIX 2).
  deletePersonPhoto: vi.fn(),
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

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigate };
});

const mockedGetEvent = vi.mocked(getEvent);
const mockedCreateEvent = vi.mocked(createEvent);
const mockedUpdateEvent = vi.mocked(updateEvent);
const mockedDeleteEventPhoto = vi.mocked(deleteEventPhoto);
const mockedDeletePersonPhoto = vi.mocked(deletePersonPhoto);

const eventFixture: Event = {
  id: 5,
  slug: "new-event",
  name: "Wedding",
  description: null,
  event_time: null,
  place: null,
  cover_filename: null,
  cover_url: null,
};

const detail: EventDetail = {
  event: {
    id: 9,
    slug: "foo",
    name: "Foo Event",
    description: "Desc",
    event_time: "1950",
    place: "Helsinki",
  },
  photos: [
    {
      id: 7,
      filename: "e1.jpg",
      caption: "Ceremony",
      uploaded_at: "2026-01-01T00:00:00Z",
      url: "/media/foo/e1.jpg",
    },
  ],
};

function renderCreate() {
  return render(
    <MemoryRouter initialEntries={["/admin/events/new"]}>
      <LangProvider>
        <Routes>
          <Route path="/admin/events/new" element={<EventForm />} />
        </Routes>
      </LangProvider>
    </MemoryRouter>,
  );
}

function renderEdit() {
  return render(
    <MemoryRouter initialEntries={["/admin/events/foo/edit"]}>
      <LangProvider>
        <Routes>
          <Route path="/admin/events/:slug/edit" element={<EventForm />} />
        </Routes>
      </LangProvider>
    </MemoryRouter>,
  );
}

const setInput = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const submit = () =>
  fireEvent.click(screen.getByRole("button", { name: "Tallenna" }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("EventForm - create", () => {
  it("sends event_time null when blank and navigates to the edit route", async () => {
    mockedCreateEvent.mockResolvedValue(eventFixture);

    renderCreate();

    setInput("Nimi", "Wedding");
    // event time left blank -> null
    submit();

    await waitFor(() => expect(mockedCreateEvent).toHaveBeenCalledTimes(1));
    const payload = mockedCreateEvent.mock.calls[0][0];
    expect(payload.name).toBe("Wedding");
    expect(payload.event_time).toBeNull();
    expect(navigate).toHaveBeenCalledWith("/admin/events/new-event/edit");
  });
});

describe("EventForm - edit", () => {
  it("deletes the event photo (not the person photo) and saves + refetches", async () => {
    mockedGetEvent.mockResolvedValue(detail);
    mockedUpdateEvent.mockResolvedValue({ ...eventFixture, slug: "foo" });
    mockedDeleteEventPhoto.mockResolvedValue({ deleted: true });
    vi.spyOn(window, "confirm").mockReturnValue(true);

    renderEdit();

    // Grid rendered with the fixture photo.
    await waitFor(() => {
      const srcs = Array.from(document.querySelectorAll("img")).map((i) =>
        i.getAttribute("src"),
      );
      expect(srcs).toContain("/media/foo/e1.jpg");
    });

    // Delete the photo -> the EVENT delete fn fires with (slug, id), proving
    // EventForm injected the event functions (FIX 2), not the person ones.
    fireEvent.click(screen.getByRole("button", { name: "Poista" }));
    await waitFor(() =>
      expect(mockedDeleteEventPhoto).toHaveBeenCalledWith("foo", 7),
    );
    expect(mockedDeletePersonPhoto).not.toHaveBeenCalled();

    const beforeSave = mockedGetEvent.mock.calls.length;
    setInput("Nimi", "Foo Renamed");
    submit();

    await waitFor(() =>
      expect(mockedUpdateEvent).toHaveBeenCalledWith(
        "foo",
        expect.objectContaining({ name: "Foo Renamed" }),
      ),
    );
    // The save triggers another getEvent refetch.
    await waitFor(() =>
      expect(mockedGetEvent.mock.calls.length).toBeGreaterThan(beforeSave),
    );
  });

  it("calls clearAuth once when updateEvent rejects with 401", async () => {
    mockedGetEvent.mockResolvedValue(detail);
    const err = { status: 401 } as AuthError;
    mockedUpdateEvent.mockRejectedValue(err);

    renderEdit();
    await screen.findByDisplayValue("Foo Event");

    submit();

    await waitFor(() => expect(clearAuth).toHaveBeenCalledTimes(1));
  });

  it("does NOT call clearAuth when updateEvent resolves (falsifiability twin)", async () => {
    mockedGetEvent.mockResolvedValue(detail);
    mockedUpdateEvent.mockResolvedValue({ ...eventFixture, slug: "foo" });

    renderEdit();
    await screen.findByDisplayValue("Foo Event");

    submit();

    await waitFor(() => expect(mockedUpdateEvent).toHaveBeenCalledTimes(1));
    expect(clearAuth).not.toHaveBeenCalled();
  });
});
