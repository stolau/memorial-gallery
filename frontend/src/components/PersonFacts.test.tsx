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
  birth_date: "19.4.1920",
  death_date: "16.11.1998",
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

    // Each fact exposes an accessible-named SVG line icon with role="img" named
    // by the Finnish label, and the value renders in its own <dd> (no combined
    // "Label: value" text).
    const born = screen.getByRole("img", { name: "Syntynyt" });
    expect(born).toBeTruthy();
    expect(born.querySelector("svg")).toBeTruthy();
    expect(born.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.getByText("19.4.1920")).toBeTruthy();

    const died = screen.getByLabelText("Kuollut");
    expect(died).toBeTruthy();
    expect(died.querySelector("svg")).toBeTruthy();
    expect(died.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.getByText("16.11.1998")).toBeTruthy();

    const birthplace = screen.getByLabelText("Syntymäpaikka");
    expect(birthplace).toBeTruthy();
    expect(birthplace.querySelector("svg")).toBeTruthy();
    expect(birthplace.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.getByText("Helsinki")).toBeTruthy();

    const profession = screen.getByLabelText("Ammatti");
    expect(profession).toBeTruthy();
    expect(profession.querySelector("svg")).toBeTruthy();
    expect(profession.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.getByText("Carpenter")).toBeTruthy();

    // Strong render guard: the full person renders exactly four SVG icons.
    expect(document.querySelectorAll(".person-facts svg").length).toBe(4);
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
