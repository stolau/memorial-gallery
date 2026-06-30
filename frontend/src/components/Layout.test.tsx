// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LangProvider } from "../i18n/LangContext";
import Layout from "./Layout";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

function renderLayout() {
  return render(
    <MemoryRouter>
      <LangProvider>
        <Layout>some child text</Layout>
      </LangProvider>
    </MemoryRouter>,
  );
}

describe("Layout", () => {
  it("renders nav chrome", () => {
    renderLayout();

    expect(screen.getByText("Kaijankoski")).toBeTruthy();
    // Events link in the default fi language.
    expect(screen.getByRole("link", { name: "Tapahtumat" })).toBeTruthy();
    // Both language switch buttons are present.
    expect(screen.getByRole("button", { name: "FI" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "EN" })).toBeTruthy();
  });

  it("language switcher toggles active language", () => {
    renderLayout();

    // Default state: fi active, en inactive, fi chrome text.
    expect(
      screen.getByRole("button", { name: "FI" }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      screen.getByRole("button", { name: "EN" }).getAttribute("aria-pressed"),
    ).toBe("false");
    expect(screen.getByRole("link", { name: "Tapahtumat" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "EN" }));

    // After switching: en active, fi inactive, chrome text re-rendered to en.
    expect(
      screen.getByRole("button", { name: "EN" }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      screen.getByRole("button", { name: "FI" }).getAttribute("aria-pressed"),
    ).toBe("false");
    expect(screen.getByRole("link", { name: "Events" })).toBeTruthy();
  });

  it("does not show the en chrome text before switching (falsifiability)", () => {
    renderLayout();

    // In the default fi state only the fi "Tapahtumat" link exists.
    // Mutating this to expect non-null makes the test fail in the fi state,
    // proving the assertion is meaningful.
    expect(screen.queryByRole("link", { name: "Events" })).toBeNull();
  });
});
