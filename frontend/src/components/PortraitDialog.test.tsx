// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { LangProvider } from "../i18n/LangContext";
import PortraitDialog from "./PortraitDialog";
import type { PersonDetailData } from "../api/types";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

const person: PersonDetailData = {
  id: 1,
  slug: "kalevi",
  display_name: "Kalevi Koski",
  bio: "Grandfather from the north.",
  profile_image: "profile/kalevi.jpg",
  profile_image_url: "/media/kalevi/profile/kalevi.jpg",
  birth_date: "19.4.1920",
  death_date: "16.11.1998",
  birthplace: "Helsinki",
  profession: "Carpenter",
};

function renderDialog(onClose: () => void = () => {}) {
  return render(
    <LangProvider>
      <PortraitDialog person={person} onClose={onClose} />
    </LangProvider>,
  );
}

describe("PortraitDialog", () => {
  it("renders a dialog with the profile image, bio and facts", () => {
    renderDialog();

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeTruthy();

    const img = dialog.querySelector("img.profile-img");
    expect(img?.getAttribute("src")).toBe("/media/kalevi/profile/kalevi.jpg");

    expect(within(dialog).getByText("Grandfather from the north.")).toBeTruthy();

    // A reused fact renders inside the dialog as an accessible-named icon + value.
    expect(within(dialog).getByLabelText("Syntymäpaikka")).toBeTruthy();
    expect(within(dialog).getByText("Helsinki")).toBeTruthy();

    // The dialog carries the sized inner element.
    expect(dialog.querySelector(".portrait-dialog")).toBeTruthy();

    // The facts row now renders BEFORE the bio paragraph in the DOM.
    const facts = dialog.querySelector("dl.person-facts");
    const bio = within(dialog).getByText("Grandfather from the north.");
    expect(facts).toBeTruthy();
    // facts.compareDocumentPosition(bio) has DOCUMENT_POSITION_FOLLOWING set
    // exactly when `bio` follows `facts` in document order (facts is earlier).
    expect(
      facts!.compareDocumentPosition(bio) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // And it must NOT be marked as preceding — guards against bio-before-facts.
    expect(
      facts!.compareDocumentPosition(bio) & Node.DOCUMENT_POSITION_PRECEDING,
    ).toBeFalsy();
  });

  it("fires onClose from the close button", () => {
    const onClose = vi.fn();
    renderDialog(onClose);
    fireEvent.click(screen.getByLabelText("Sulje"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("fires onClose on Escape", () => {
    const onClose = vi.fn();
    renderDialog(onClose);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
