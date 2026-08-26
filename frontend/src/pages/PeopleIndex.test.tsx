// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PeopleIndex from "./PeopleIndex";
import { getPeople } from "../api/client";
import type { Person } from "../api/types";

vi.mock("../api/client", () => ({
  getPeople: vi.fn(),
  // Layout (rendered by this page) fetches contact on mount.
  getContact: vi.fn(() =>
    Promise.resolve({
      contact_name: null,
      contact_email: null,
      contact_phone: null,
    }),
  ),
}));

const mockedGetPeople = vi.mocked(getPeople);

const people: Person[] = [
  {
    id: 1,
    slug: "aino",
    display_name: "Aino Koski",
    bio: null,
    profile_image: "profile/aino.jpg",
    profile_image_url: "/media/aino/profile/aino.jpg",
  },
  {
    id: 2,
    slug: "kalevi",
    display_name: "Kalevi Koski",
    bio: null,
    profile_image: null,
    profile_image_url: null,
  },
];

beforeEach(() => {
  mockedGetPeople.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("PeopleIndex", () => {
  it("renders every person name and only renders thumbnails for those with a profile_image_url", async () => {
    mockedGetPeople.mockResolvedValue(people);

    render(
      <MemoryRouter>
        <PeopleIndex />
      </MemoryRouter>,
    );

    // Both display names render once the async effect resolves.
    expect(await screen.findByText("Aino Koski")).toBeTruthy();
    expect(screen.getByText("Kalevi Koski")).toBeTruthy();

    // The person WITH a url has a thumbnail <img> pointing at that url.
    const ainoImg = screen.getByAltText("Aino Koski") as HTMLImageElement;
    expect(ainoImg.tagName).toBe("IMG");
    expect(ainoImg.getAttribute("src")).toBe("/media/aino/profile/aino.jpg");

    // Exactly one image is rendered: the null-url person has no <img>.
    expect(screen.queryByAltText("Kalevi Koski")).toBeNull();
    expect(screen.getAllByRole("img")).toHaveLength(1);
  });

  it("does not render a name that is absent from the fixture (falsifiability)", async () => {
    mockedGetPeople.mockResolvedValue(people);

    render(
      <MemoryRouter>
        <PeopleIndex />
      </MemoryRouter>,
    );

    await screen.findByText("Aino Koski");
    expect(screen.queryByText("Nonexistent Person")).toBeNull();
  });

  it("waits for the async load before any person appears", async () => {
    mockedGetPeople.mockResolvedValue(people);

    render(
      <MemoryRouter>
        <PeopleIndex />
      </MemoryRouter>,
    );

    await waitFor(() => expect(mockedGetPeople).toHaveBeenCalledTimes(1));
    await screen.findByText("Kalevi Koski");
  });

  it("shows loading state before the promise resolves", () => {
    // Explicit <Person[]> type param: a bare new Promise(() => {}) infers
    // Promise<unknown> and fails typecheck against getPeople's Promise<Person[]>.
    mockedGetPeople.mockReturnValue(new Promise<Person[]>(() => {}));

    render(
      <MemoryRouter>
        <PeopleIndex />
      </MemoryRouter>,
    );

    // people === null && error === null -> the loading paragraph renders.
    expect(screen.getByText("Ladataan…")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows an error alert when getPeople rejects", async () => {
    mockedGetPeople.mockRejectedValue(new Error("Network down"));

    render(
      <MemoryRouter>
        <PeopleIndex />
      </MemoryRouter>,
    );

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Network down");
    expect(screen.queryByText("Ladataan…")).toBeNull();
    expect(screen.queryByText("Aino Koski")).toBeNull();
  });
});
