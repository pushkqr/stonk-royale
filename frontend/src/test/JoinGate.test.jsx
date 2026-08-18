import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import JoinGate from "../components/JoinGate";

vi.mock("../lib/api", () => ({ joinMatch: vi.fn() }));

describe("JoinGate.jsx", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("tells a first-time arrival what the game is before asking for anything", () => {
    render(<JoinGate code="abcde" onSeated={vi.fn()} />);
    expect(screen.getByText("ABCDE")).toBeInTheDocument();
    expect(screen.getByText(/most of the tips are lies/i)).toBeInTheDocument();
  });

  it("does not ask a returning player for a name they already chose", () => {
    localStorage.setItem("stonk_nickname", "Dave");
    render(<JoinGate code="abcde" onSeated={vi.fn()} />);
    expect(screen.getByDisplayValue("Dave")).toBeInTheDocument();
  });
});
