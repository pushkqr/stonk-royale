import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import Avatar from "../components/Avatar";

describe("Avatar.jsx", () => {
  it("renders SVG avatar with proper classes and attributes", () => {
    const { container } = render(
      <Avatar archetypeId="moon" mood="laser" size={40} className="custom-test" />
    );
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.classList.contains("avatar-moon")).toBe(true);
    expect(svg?.classList.contains("mood-laser")).toBe(true);
    expect(svg?.classList.contains("custom-test")).toBe(true);
    expect(svg?.getAttribute("width")).toBe("40");
    expect(svg?.getAttribute("height")).toBe("40");
  });

  it("handles fallback to default archetype on invalid id", () => {
    const { container } = render(<Avatar archetypeId="unknown-archetype" />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.classList.contains("avatar-banker")).toBe(true);
  });
});
