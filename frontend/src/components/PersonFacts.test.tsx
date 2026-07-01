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
  it("renders each present fact as an accessible-named icon plus its value", () => {
    renderFacts(fullPerson);

    // Each fact exposes an emoji with role="img" named by the Finnish label,
    // and the value renders in its own <dd> (no combined "Label: value" text).
    expect(screen.getByRole("img", { name: "Syntynyt" })).toBeTruthy();
    expect(screen.getByText("1920")).toBeTruthy();

    expect(screen.getByLabelText("Kuollut")).toBeTruthy();
    expect(screen.getByText("1998")).toBeTruthy();

    expect(screen.getByLabelText("Syntymäpaikka")).toBeTruthy();
    expect(screen.getByText("Helsinki")).toBeTruthy();

    expect(screen.getByLabelText("Ammatti")).toBeTruthy();
    expect(screen.getByText("Carpenter")).toBeTruthy();
  });

  it("renders a <dl> and no bulleted list", () => {
    renderFacts(fullPerson);

    expect(document.querySelector("dl.person-facts")).toBeTruthy();
    expect(document.querySelectorAll("li").length).toBe(0);
  });

  it("omits a null fact entirely (null-guard)", () => {
    renderFacts({ ...fullPerson, profession: null });

    // The profession fact is gone entirely.
    expect(screen.queryByLabelText("Ammatti")).toBeNull();
    expect(screen.queryByText("Carpenter")).toBeNull();

    // The other facts are still present.
    expect(screen.getByLabelText("Syntynyt")).toBeTruthy();
    expect(screen.getByLabelText("Syntymäpaikka")).toBeTruthy();
  });
});
