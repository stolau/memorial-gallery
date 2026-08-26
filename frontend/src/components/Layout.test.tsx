// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LangProvider } from "../i18n/LangContext";
import Layout from "./Layout";
import { getContacts } from "../api/client";

vi.mock("../api/client", () => ({
  // The "Info" pill opens the contact modal, which loads contacts on open.
  getContacts: vi.fn(() => Promise.resolve([])),
}));

const mockedGetContacts = vi.mocked(getContacts);

beforeEach(() => {
  localStorage.clear();
  mockedGetContacts.mockReset();
  mockedGetContacts.mockResolvedValue([]);
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
    // Events + Collections links in the default fi language.
    expect(screen.getByRole("link", { name: "Tapahtumat" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Kokoelmat" })).toBeTruthy();
    // Both language switch buttons are present.
    expect(screen.getByRole("button", { name: /suomi/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /english/i })).toBeTruthy();
    // Each language button renders an inline svg flag.
    expect(
      screen.getByRole("button", { name: /suomi/i }).querySelector("svg"),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /english/i }).querySelector("svg"),
    ).toBeTruthy();
  });

  it("the Collections link points at /collections", () => {
    renderLayout();
    const link = screen.getByRole("link", { name: "Kokoelmat" });
    expect(link.getAttribute("href")).toBe("/collections");
  });

  it("language switcher toggles active language", () => {
    renderLayout();

    // Default state: fi active, en inactive, fi chrome text.
    expect(
      screen.getByRole("button", { name: /suomi/i }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      screen.getByRole("button", { name: /english/i }).getAttribute("aria-pressed"),
    ).toBe("false");
    expect(screen.getByRole("link", { name: "Tapahtumat" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /english/i }));

    // After switching: en active, fi inactive, chrome text re-rendered to en.
    expect(
      screen.getByRole("button", { name: /english/i }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      screen.getByRole("button", { name: /suomi/i }).getAttribute("aria-pressed"),
    ).toBe("false");
    expect(screen.getByRole("link", { name: "Events" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Collections" })).toBeTruthy();
  });

  it("does not show the en chrome text before switching (falsifiability)", () => {
    renderLayout();

    // In the default fi state only the fi "Tapahtumat" link exists.
    // Mutating this to expect non-null makes the test fail in the fi state,
    // proving the assertion is meaningful.
    expect(screen.queryByRole("link", { name: "Events" })).toBeNull();
  });

  it("opens the contact modal from the Info pill and closes on Escape", async () => {
    renderLayout();

    // No modal until the pill is clicked.
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Yhteystiedot" }));

    // The contact modal appears with its localized title.
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeTruthy();
    expect(screen.getByText("Ota yhteyttä")).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
