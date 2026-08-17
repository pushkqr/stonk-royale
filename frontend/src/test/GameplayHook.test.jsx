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
    expect(screen.getByText("Get private tips")).toBeInTheDocument();

    // Step 2
    expect(screen.getByText("2. Spot the Liar")).toBeInTheDocument();
    expect(screen.getByText("Call out false rumors")).toBeInTheDocument();

    // Step 3
    expect(screen.getByText("3. Trade & Win")).toBeInTheDocument();
    expect(screen.getByText("Long or short the market")).toBeInTheDocument();
  });
});
