// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { LangProvider } from "../i18n/LangContext";
import PersonFacts from "./PersonFacts";
import type { PersonDetailData } from "../api/types";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

const fullPerson: PersonDetailData = {
  id: 1,
  slug: "kalevi",
  display_name: "Kalevi Koski",
  bio: "Grandfather",
  profile_image: "profile/kalevi.jpg",
  profile_image_url: "/media/kalevi/profile/kalevi.jpg",
  birth_year: 1920,
  death_year: 1998,
  birthplace: "Helsinki",
  profession: "Carpenter",
};

function renderFacts(person: PersonDetailData) {
  return render(
    <LangProvider>
      <PersonFacts person={person} />
    </LangProvider>,
  );
}

describe("PersonFacts", () => {
  it("renders every present fact label and value", () => {
    renderFacts(fullPerson);

    expect(screen.getByText("Syntynyt: 1920")).toBeTruthy();
    expect(screen.getByText("Kuollut: 1998")).toBeTruthy();
    expect(screen.getByText("Syntymäpaikka: Helsinki")).toBeTruthy();
    expect(screen.getByText("Ammatti: Carpenter")).toBeTruthy();
  });

  it("omits the <li> for a null fact (null-guard)", () => {
    renderFacts({ ...fullPerson, profession: null });

    // The profession fact is gone entirely.
    expect(screen.queryByText("Ammatti: Carpenter")).toBeNull();
    expect(screen.queryByText(/^Ammatti:/)).toBeNull();

    // The other facts are still present.
    expect(screen.getByText("Syntynyt: 1920")).toBeTruthy();
    expect(screen.getByText("Syntymäpaikka: Helsinki")).toBeTruthy();
  });
});
