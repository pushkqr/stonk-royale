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

    // Card 1: 01 / DOSSIER
    expect(screen.getByText("01 / DOSSIER")).toBeInTheDocument();
    expect(screen.getByText("Secret Intel")).toBeInTheDocument();
    expect(screen.getByText("One private tip per round")).toBeInTheDocument();
    expect(screen.getByText("CONFIDENTIAL")).toBeInTheDocument();

    // Card 2: 02 / THE WIRE
    expect(screen.getByText("02 / THE WIRE")).toBeInTheDocument();
    expect(screen.getByText("Bluff & Snoop")).toBeInTheDocument();
    expect(screen.getByText("Chat and spot the lies")).toBeInTheDocument();
    expect(screen.getByText("70% LIE CHANCE")).toBeInTheDocument();

    // Card 3: 03 / THE PIT
    expect(screen.getByText("03 / THE PIT")).toBeInTheDocument();
    expect(screen.getByText("10x Execution")).toBeInTheDocument();
    expect(screen.getByText("Squeeze prices & profit")).toBeInTheDocument();
    expect(screen.getByText("LONG / SHORT")).toBeInTheDocument();
  });
});
