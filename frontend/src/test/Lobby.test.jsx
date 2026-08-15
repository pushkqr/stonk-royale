import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import Lobby from "../components/Lobby";

const mockLobby = {
  code: "ABCD",
  phase: "LOBBY",
  totalRounds: 5,
  roundSeconds: 90,
  intermissionSeconds: 25,
  maxPlayers: 12,
  startingCash: 10000,
  isPublic: false,
  volatilityMultiplier: 1.0,
  players: [
    { playerId: "p1", nickname: "Alice", host: true, connected: true, bot: false },
    { playerId: "p2", nickname: "Bob", host: false, connected: true, bot: false },
  ],
};

vi.mock("../state/MatchProvider", () => ({
  useMatch: () => ({
    lobby: mockLobby,
    session: { playerId: "p1", code: "ABCD", host: true },
    start: vi.fn(),
    kick: vi.fn(),
    addBot: vi.fn(),
    configure: vi.fn(),
  }),
}));

describe("Lobby.jsx", () => {
  it("renders room code, players, and copy link button", () => {
    render(<Lobby />);
    expect(screen.getByText("ABCD")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Copy invite link/i })).toBeInTheDocument();
  });

  it("triggers clipboard copy on button click", async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue() },
    });
    render(<Lobby />);
    const copyBtn = screen.getByRole("button", { name: /Copy invite link/i });
    await act(async () => {
      fireEvent.click(copyBtn);
    });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining("/m/ABCD")
    );
  });
});
