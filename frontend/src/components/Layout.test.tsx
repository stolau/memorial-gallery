// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LangProvider } from "../i18n/LangContext";
import Layout from "./Layout";
import { getContact } from "../api/client";
import type { Contact } from "../api/types";

vi.mock("../api/client", () => ({ getContact: vi.fn() }));

const mockedGetContact = vi.mocked(getContact);

const emptyContact: Contact = {
  contact_name: null,
  contact_email: null,
  contact_phone: null,
};

beforeEach(() => {
  localStorage.clear();
  mockedGetContact.mockReset();
  // Default: no contact configured, so the contact block stays hidden.
  mockedGetContact.mockResolvedValue(emptyContact);
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
});

describe("Layout - contact info", () => {
  it("renders name, a mailto: email link and a tel: phone link when set", async () => {
    mockedGetContact.mockResolvedValue({
      contact_name: "Anssi Uistola",
      contact_email: "anssi@example.com",
      contact_phone: "+358 40 123 4567",
    });

    renderLayout();

    expect(await screen.findByText("Anssi Uistola")).toBeTruthy();
    const email = screen.getByRole("link", { name: "anssi@example.com" });
    expect(email.getAttribute("href")).toBe("mailto:anssi@example.com");
    const phone = screen.getByRole("link", { name: "+358 40 123 4567" });
    expect(phone.getAttribute("href")).toBe("tel:+358 40 123 4567");
  });

  it("degrades gracefully: only the phone renders when name/email are null", async () => {
    mockedGetContact.mockResolvedValue({
      contact_name: null,
      contact_email: null,
      contact_phone: "12345",
    });

    renderLayout();

    const phone = await screen.findByRole("link", { name: "12345" });
    expect(phone.getAttribute("href")).toBe("tel:12345");
    // No email link, no name span leaks in.
    expect(
      screen.queryByRole("link", { name: /mailto/i }),
    ).toBeNull();
  });

  it("shows no contact block when every field is empty (falsifiability)", async () => {
    renderLayout();

    // Let the effect resolve, then assert no mailto/tel links exist.
    await waitFor(() => expect(mockedGetContact).toHaveBeenCalledTimes(1));
    const links = screen
      .getAllByRole("link")
      .map((a) => a.getAttribute("href"));
    expect(links.some((h) => h?.startsWith("mailto:"))).toBe(false);
    expect(links.some((h) => h?.startsWith("tel:"))).toBe(false);
  });

  it("does not crash the chrome when the contact fetch rejects", async () => {
    mockedGetContact.mockRejectedValue(new Error("boom"));

    renderLayout();

    // Chrome still renders; the contact block simply stays absent.
    expect(screen.getByText("Kaijankoski")).toBeTruthy();
    await waitFor(() => expect(mockedGetContact).toHaveBeenCalledTimes(1));
    expect(
      screen.queryByRole("link", { name: /mailto/i }),
    ).toBeNull();
  });
});
