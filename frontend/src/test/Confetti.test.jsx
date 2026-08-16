import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import Confetti from "../components/Confetti";

describe("Confetti.jsx", () => {
  it("renders canvas element without throwing", () => {
    const { container } = render(<Confetti />);
    const canvas = container.querySelector("canvas.confetti-canvas");
    expect(canvas).not.toBeNull();
    expect(canvas?.getAttribute("aria-hidden")).toBe("true");
  });
});
