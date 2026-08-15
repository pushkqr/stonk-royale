import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Standings from "../components/Standings";

describe("Standings.jsx", () => {
  const initialRows = [
    { playerId: "p1", nickname: "Alice", equity: 12000, roundScore: 20, totalScore: 20, bot: false },
    { playerId: "p2", nickname: "Bob", equity: 10000, roundScore: 0, totalScore: 0, bot: false },
    { playerId: "p3", nickname: "Charlie", equity: 8000, roundScore: -20, totalScore: -20, bot: true },
  ];

  it("renders players with ranks and scores", () => {
    render(<Standings rows={initialRows} meId="p1" />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Charlie")).toBeInTheDocument();
    expect(screen.getByText("BOT")).toBeInTheDocument();
  });

  it("renders rank shift indicator when positions change", () => {
    const { rerender, container } = render(<Standings rows={initialRows} meId="p1" />);
    
    // Bob takes 1st place (+1 rank), Alice drops to 2nd (-1 rank)
    const updatedRows = [
      { playerId: "p2", nickname: "Bob", equity: 15000, roundScore: 50, totalScore: 50, bot: false },
      { playerId: "p1", nickname: "Alice", equity: 12000, roundScore: 20, totalScore: 20, bot: false },
      { playerId: "p3", nickname: "Charlie", equity: 8000, roundScore: -20, totalScore: -20, bot: true },
    ];

    rerender(<Standings rows={updatedRows} meId="p1" />);

    expect(container.querySelector(".rank-shift.is-up")).toBeInTheDocument();
    expect(container.querySelector(".rank-shift.is-down")).toBeInTheDocument();
  });
});
