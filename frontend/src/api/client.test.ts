import { afterEach, describe, expect, it, vi } from "vitest";
import { getEvent, getPeople, getPerson } from "./client";
import type { EventDetail, Person, PersonDetail } from "./types";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("api client", () => {
  it("getPeople() returns the typed payload and uses credentials:include", async () => {
    const people: Person[] = [
      {
        id: 1,
        slug: "kalevi",
        display_name: "Kalevi",
        bio: "Grandfather",
        profile_image: null,
        profile_image_url: null,
      },
      {
        id: 2,
        slug: "aino",
        display_name: "Aino",
        bio: null,
        profile_image: "aino.jpg",
        profile_image_url: "/media/aino/profile/aino.jpg",
      },
    ];

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue({
        ok: true,
        json: async () => people,
      } as Response);

    const result = await getPeople();

    expect(result).toEqual(people);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [calledPath, calledOptions] = fetchMock.mock.calls[0];
    expect(calledPath).toBe("/api/people");
    expect(calledOptions).toMatchObject({ credentials: "include" });
  });

  it("getPerson() rejects when the response is not ok", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
    } as Response);

    await expect(getPerson("nope")).rejects.toThrow(/404/);
  });

  it("getEvent() encodes the slug into the request URL", async () => {
    const detail: EventDetail = {
      event: {
        id: 7,
        slug: "summer fest",
        name: "Summer Fest",
        description: null,
        event_time: null,
        place: null,
      },
      photos: [],
    };

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue({
        ok: true,
        json: async () => detail,
      } as Response);

    const result = await getEvent("summer fest");

    expect(result).toEqual(detail);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/events/summer%20fest");
  });

  // PersonDetail fixture below also exercises the nested DTO types at compile time.
  it("getPerson() resolves the typed PersonDetail on success", async () => {
    const detail: PersonDetail = {
      person: {
        id: 1,
        slug: "kalevi",
        display_name: "Kalevi",
        bio: null,
        profile_image: null,
        profile_image_url: null,
        birth_date: "19.4.1920",
        death_date: "16.11.1998",
        birthplace: "Helsinki",
        profession: "Carpenter",
      },
      photos: [
        {
          id: 10,
          filename: "k1.jpg",
          caption: null,
          uploaded_at: "2026-01-01T00:00:00Z",
          url: "/media/k1.jpg",
        },
      ],
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => detail,
    } as Response);

    await expect(getPerson("kalevi")).resolves.toEqual(detail);
  });
});
