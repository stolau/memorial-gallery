// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import Paragraphs from "./Paragraphs";

afterEach(() => {
  cleanup();
});

describe("Paragraphs", () => {
  it("renders one <p> per blank-line-separated paragraph", () => {
    const { container } = render(
      <Paragraphs text={"First para.\n\nSecond para.\n\nThird para."} />,
    );
    const ps = container.querySelectorAll("p");
    expect(ps.length).toBe(3);
    expect(ps[0].textContent).toBe("First para.");
    expect(ps[1].textContent).toBe("Second para.");
    expect(ps[2].textContent).toBe("Third para.");
  });

  it("renders a single <p> for a single paragraph", () => {
    const { container } = render(<Paragraphs text="Just one paragraph." />);
    const ps = container.querySelectorAll("p");
    expect(ps.length).toBe(1);
    expect(ps[0].textContent).toBe("Just one paragraph.");
  });

  it("preserves single newlines within a paragraph", () => {
    const { container } = render(<Paragraphs text={"Line one\nLine two"} />);
    const ps = container.querySelectorAll("p");
    expect(ps.length).toBe(1);
    expect(ps[0].textContent).toBe("Line one\nLine two");
  });

  it("tolerates whitespace around the blank-line separator", () => {
    const { container } = render(
      <Paragraphs text={"First.\n   \nSecond."} />,
    );
    const ps = container.querySelectorAll("p");
    expect(ps.length).toBe(2);
    expect(ps[0].textContent).toBe("First.");
    expect(ps[1].textContent).toBe("Second.");
  });

  it("renders nothing for null", () => {
    const { container } = render(<Paragraphs text={null} />);
    expect(container.querySelectorAll("p").length).toBe(0);
    expect(container.textContent).toBe("");
  });

  it("renders nothing for an empty string", () => {
    const { container } = render(<Paragraphs text="" />);
    expect(container.querySelectorAll("p").length).toBe(0);
    expect(container.textContent).toBe("");
  });

  it("renders nothing for whitespace-only text", () => {
    const { container } = render(<Paragraphs text={"   \n\n  \t "} />);
    expect(container.querySelectorAll("p").length).toBe(0);
    expect(container.textContent).toBe("");
  });

  it("does not inject HTML — markup stays literal text", () => {
    const { container } = render(<Paragraphs text="hello <b>bold</b> world" />);
    const ps = container.querySelectorAll("p");
    expect(ps.length).toBe(1);
    // No <b> element was created; the angle brackets survive as text.
    expect(container.querySelector("b")).toBeNull();
    expect(ps[0].textContent).toBe("hello <b>bold</b> world");
  });
});
