import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import GameplayHook from "../components/GameplayHook";

describe("GameplayHook.jsx", () => {
  it("renders with accessible section label", () => {
    render(<GameplayHook />);
    const section = screen.getByRole("region", { name: /How the game loop works/i });
    expect(section).toBeInTheDocument();
  });

  it("renders all 3 tactical cards with phase tags, titles, descriptions, and telemetry chips", () => {
    render(<GameplayHook />);

    // Card 1: 01 / GET A TIP
    expect(screen.getByText("01 / GET A TIP")).toBeInTheDocument();
    expect(screen.getByText("You Get Intel")).toBeInTheDocument();
    expect(screen.getByText("A private tip on the coin")).toBeInTheDocument();
    expect(screen.getByText("PRIVATE")).toBeInTheDocument();

    // Card 2: 02 / SPOT LIES
    expect(screen.getByText("02 / SPOT LIES")).toBeInTheDocument();
    expect(screen.getByText("Everyone Lies")).toBeInTheDocument();
    expect(screen.getByText("Chat and spot who is fake")).toBeInTheDocument();
    expect(screen.getByText("MOSTLY FAKE")).toBeInTheDocument();

    // Card 3: 03 / TRADE IT
    expect(screen.getByText("03 / TRADE IT")).toBeInTheDocument();
    expect(screen.getByText("Trade & Win")).toBeInTheDocument();
    expect(screen.getByText("Long or short to take cash")).toBeInTheDocument();
    expect(screen.getByText("TAKE PROFIT")).toBeInTheDocument();
  });
});
