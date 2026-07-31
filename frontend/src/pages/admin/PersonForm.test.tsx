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
import PersonForm from "./PersonForm";
import { LangProvider } from "../../i18n/LangContext";
import { getPerson } from "../../api/client";
import {
  createPerson,
  updatePerson,
  setPersonProfileImage,
} from "../../api/admin";
import type { AuthError } from "../../api/auth";
import type { PersonDetail, PersonDetailData } from "../../api/types";

vi.mock("../../api/client", () => ({ getPerson: vi.fn() }));
vi.mock("../../api/admin", () => ({
  createPerson: vi.fn(),
  updatePerson: vi.fn(),
  setPersonProfileImage: vi.fn(),
  removePersonProfileImage: vi.fn(),
  deletePersonPhoto: vi.fn(),
  uploadPersonPhotos: vi.fn(),
  updatePhotoCaption: vi.fn(),
  createFolder: vi.fn(),
  deleteFolder: vi.fn(),
  setPhotoFolder: vi.fn(),
  reorderPersonPhotos: vi.fn(),
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

// Partial-mock react-router-dom: keep MemoryRouter/Routes/Route/useParams real
// so the routed :slug resolves; only useNavigate is a spy.
const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigate };
});

const mockedGetPerson = vi.mocked(getPerson);
const mockedCreatePerson = vi.mocked(createPerson);
const mockedUpdatePerson = vi.mocked(updatePerson);
const mockedSetProfile = vi.mocked(setPersonProfileImage);

const detail: PersonDetail = {
  person: {
    id: 1,
    slug: "kalevi",
    display_name: "Kalevi Koski",
    bio: "Grandfather",
    profile_image: "profile/kalevi.jpg",
    profile_image_url: "/media/kalevi/profile/kalevi.jpg",
    birth_date: "19.4.1920",
    death_date: "16.11.1998",
    birthplace: "Helsinki",
    profession: "Carpenter",
  },
  photos: [
    {
      id: 10,
      filename: "k1.jpg",
      caption: "At the lake",
      uploaded_at: "2026-01-01T00:00:00Z",
      url: "/media/kalevi/k1.jpg",
    },
  ],
  folders: [],
};

function renderCreate() {
  return render(
    <MemoryRouter initialEntries={["/admin/people/new"]}>
      <LangProvider>
        <Routes>
          <Route path="/admin/people/new" element={<PersonForm />} />
        </Routes>
      </LangProvider>
    </MemoryRouter>,
  );
}

function renderEdit() {
  return render(
    <MemoryRouter initialEntries={["/admin/people/kalevi/edit"]}>
      <LangProvider>
        <Routes>
          <Route path="/admin/people/:slug/edit" element={<PersonForm />} />
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

describe("PersonForm - create", () => {
  it("sends empty optionals as null and the typed date as-is (no slug key)", async () => {
    mockedCreatePerson.mockResolvedValue({
      ...detail.person,
      slug: "new-person",
    } as PersonDetailData);

    renderCreate();

    setInput("Nimi", "Uusi Henkilo");
    // birth date left blank -> null; death date sent verbatim.
    setInput("Kuolinaika", "16.11.1998");
    submit();

    await waitFor(() => expect(mockedCreatePerson).toHaveBeenCalledTimes(1));
    const payload = mockedCreatePerson.mock.calls[0][0];
    expect(payload).toEqual({
      display_name: "Uusi Henkilo",
      bio: null,
      birth_date: null,
      death_date: "16.11.1998",
      birthplace: null,
      profession: null,
    });
    // Create must not send a client-chosen slug.
    expect("slug" in payload).toBe(false);
  });

  it("uploads the chosen profile image with the created slug", async () => {
    mockedCreatePerson.mockResolvedValue({
      ...detail.person,
      slug: "new-person",
    } as PersonDetailData);
    mockedSetProfile.mockResolvedValue(detail.person);

    renderCreate();

    setInput("Nimi", "Uusi Henkilo");
    const file = new File(["img"], "face.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByLabelText("Profiilikuva"), {
      target: { files: [file] },
    });
    submit();

    await waitFor(() =>
      expect(mockedSetProfile).toHaveBeenCalledWith("new-person", file),
    );
    expect(navigate).toHaveBeenCalledWith("/admin/people/new-person/edit");
  });

  it("sends the birth date verbatim, including non-numeric text", async () => {
    mockedCreatePerson.mockResolvedValue({
      ...detail.person,
      slug: "new-person",
    } as PersonDetailData);

    renderCreate();

    setInput("Nimi", "Uusi Henkilo");
    // Free-text: full dates, plain years, or approximate text all pass through.
    setInput("Syntymäaika", "kesä 1920");
    submit();

    await waitFor(() => expect(mockedCreatePerson).toHaveBeenCalledTimes(1));
    expect(mockedCreatePerson.mock.calls[0][0].birth_date).toBe("kesä 1920");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("PersonForm - edit", () => {
  it("seeds inputs, saves the edit, refetches and shows the photo grid", async () => {
    mockedGetPerson.mockResolvedValue(detail);
    mockedUpdatePerson.mockResolvedValue(detail.person);

    renderEdit();

    // Seeded from the fixture.
    expect(await screen.findByDisplayValue("19.4.1920")).toBeTruthy();
    // AdminPhotoGrid is present in edit mode -> the fixture photo is visible.
    const srcs = Array.from(document.querySelectorAll("img")).map((i) =>
      i.getAttribute("src"),
    );
    expect(srcs).toContain("/media/kalevi/k1.jpg");

    setInput("Nimi", "Kalevi Uusi");
    submit();

    await waitFor(() =>
      expect(mockedUpdatePerson).toHaveBeenCalledWith(
        "kalevi",
        expect.objectContaining({ display_name: "Kalevi Uusi" }),
      ),
    );
    // Mount load (1) + post-save refetch (2).
    await waitFor(() => expect(mockedGetPerson).toHaveBeenCalledTimes(2));
  });

  it("shows the generic alert when the initial getPerson load rejects", async () => {
    // Plain Error with NO .status -> matches what client.ts actually throws on
    // a read failure; PersonForm treats a status-less rejection as generic.
    mockedGetPerson.mockRejectedValue(new Error("boom"));

    renderEdit();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Jotain meni pieleen.");
  });

  it("shows NO alert when the initial getPerson load resolves (falsifiability twin)", async () => {
    mockedGetPerson.mockResolvedValue(detail);

    renderEdit();

    // Wait for the load to seed the form, then prove the alert is absent -
    // confirming the alert above appears BECAUSE of the rejection.
    await screen.findByDisplayValue("19.4.1920");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("calls clearAuth when updatePerson rejects with 401", async () => {
    mockedGetPerson.mockResolvedValue(detail);
    const err = { status: 401 } as AuthError;
    mockedUpdatePerson.mockRejectedValue(err);

    renderEdit();
    await screen.findByDisplayValue("19.4.1920");

    submit();

    await waitFor(() => expect(clearAuth).toHaveBeenCalledTimes(1));
  });

  it("does NOT call clearAuth when updatePerson resolves (falsifiability twin)", async () => {
    mockedGetPerson.mockResolvedValue(detail);
    mockedUpdatePerson.mockResolvedValue(detail.person);

    renderEdit();
    await screen.findByDisplayValue("19.4.1920");

    submit();

    await waitFor(() => expect(mockedUpdatePerson).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockedGetPerson).toHaveBeenCalledTimes(2));
    expect(clearAuth).not.toHaveBeenCalled();
  });

  it("shows the notFound alert when updatePerson rejects with 404", async () => {
    mockedGetPerson.mockResolvedValue(detail);
    const err = { status: 404 } as AuthError;
    mockedUpdatePerson.mockRejectedValue(err);

    renderEdit();
    await screen.findByDisplayValue("19.4.1920");

    submit();

    const alerts = await screen.findAllByRole("alert");
    expect(alerts.some((a) => a.textContent === "Kohdetta ei löytynyt.")).toBe(
      true,
    );
    expect(clearAuth).not.toHaveBeenCalled();
  });
});
