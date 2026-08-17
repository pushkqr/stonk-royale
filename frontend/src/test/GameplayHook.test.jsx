import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import GameplayHook from "../components/GameplayHook";

describe("GameplayHook.jsx", () => {
  it("renders with accessible section label", () => {
    render(<GameplayHook />);
    const section = screen.getByRole("region", { name: /How the game works/i });
    expect(section).toBeInTheDocument();
  });

  it("renders all 3 gameplay steps with title and description", () => {
    render(<GameplayHook />);

    // Step 1
    expect(screen.getByText("1. Secret Intel")).toBeInTheDocument();
    expect(screen.getByText("You get private market info")).toBeInTheDocument();

    // Step 2
    expect(screen.getByText("2. Bluff or Truth")).toBeInTheDocument();
    expect(screen.getByText("Some tips are lies. Call bluffs.")).toBeInTheDocument();

    // Step 3
    expect(screen.getByText("3. Trade & Win")).toBeInTheDocument();
    expect(screen.getByText("Leverage long/short to win")).toBeInTheDocument();
  });
});
