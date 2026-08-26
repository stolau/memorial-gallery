// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { LangProvider } from "../i18n/LangContext";
import ContactModal from "./ContactModal";
import { getContacts } from "../api/client";
import type { Contact } from "../api/types";

vi.mock("../api/client", () => ({
  getContacts: vi.fn(),
}));

const mockedGetContacts = vi.mocked(getContacts);

const contacts: Contact[] = [
  {
    id: 1,
    position: 0,
    name: "Anssi Uistola",
    role: "Ylläpitäjä",
    phone: "+358401234567",
    email: "anssi@example.com",
  },
  {
    id: 2,
    position: 1,
    name: "Aino Koski",
    role: null,
    phone: null,
    email: "aino@example.com",
  },
];

beforeEach(() => {
  localStorage.clear();
  mockedGetContacts.mockReset();
});

afterEach(() => {
  cleanup();
});

function renderModal(onClose: () => void = () => {}) {
  return render(
    <LangProvider>
      <ContactModal onClose={onClose} />
    </LangProvider>,
  );
}

describe("ContactModal", () => {
  it("renders the eyebrow, title, note and a card per contact with tel:/mailto: links", async () => {
    mockedGetContacts.mockResolvedValue(contacts);

    renderModal();

    // The localized heading + note render immediately.
    expect(screen.getByText("Ota yhteyttä")).toBeTruthy();
    expect(
      screen.getByText(
        "Kuvia, muistoja tai korjauksia sivustolle — ota yhteyttä.",
      ),
    ).toBeTruthy();

    // One card per contact appears once the fetch resolves.
    const first = (await screen.findByText("Anssi Uistola")).closest("li")!;
    expect(within(first).getByText("Ylläpitäjä")).toBeTruthy();
    expect(
      within(first).getByText("+358401234567").getAttribute("href"),
    ).toBe("tel:+358401234567");
    expect(
      within(first).getByText("anssi@example.com").getAttribute("href"),
    ).toBe("mailto:anssi@example.com");

    // The second contact has no role/phone: only its email link renders.
    const second = screen.getByText("Aino Koski").closest("li")!;
    expect(within(second).queryByText(/tel:/)).toBeNull();
    expect(
      within(second).getByText("aino@example.com").getAttribute("href"),
    ).toBe("mailto:aino@example.com");
  });

  it("closes on the × button and on a backdrop click", async () => {
    mockedGetContacts.mockResolvedValue(contacts);

    const onClose = vi.fn();
    renderModal(onClose);
    await screen.findByText("Anssi Uistola");

    fireEvent.click(screen.getByLabelText("Sulje"));
    expect(onClose).toHaveBeenCalledTimes(1);

    // Backdrop (overlay) click also closes; a click on the panel does not.
    fireEvent.click(document.querySelector(".contact-dialog")!);
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(document.querySelector(".contact-overlay")!);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
