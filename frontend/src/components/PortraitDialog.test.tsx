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
  birth_year: 1920,
  death_year: 1998,
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

    // A reused fact label + value renders inside the dialog.
    expect(within(dialog).getByText("Syntymäpaikka: Helsinki")).toBeTruthy();
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
