import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Results from "../components/Results";

const mockStandings = [
  { playerId: "p1", nickname: "WinnerGuy", totalScore: 120, bestRound: 80, bot: false, rank: 1 },
  { playerId: "p2", nickname: "RunnerUp", totalScore: 40, bestRound: 30, bot: false, rank: 2 },
];

vi.mock("../state/MatchProvider", () => ({
  useMatch: () => ({
    standings: mockStandings,
    session: { playerId: "p1", host: true },
    rematch: vi.fn(),
    lobby: { code: "TEST1", players: [{ playerId: "p1", host: true }] },
    settled: {
      roundIndex: 4,
      regime: "PUMP",
      results: [
        {
          playerId: "p1",
          nickname: "WinnerGuy",
          roundScore: 80,
          totalScore: 120,
          rumorClaimed: "PUMP",
          rumorWasTrue: true,
          tipClaim: "PUMP",
        },
      ],
    },
    feed: [],
    quit: vi.fn(),
    suspects: {},
  }),
}));

describe("Results.jsx", () => {
  it("renders victory verdict, podium, and accolades", () => {
    render(<Results />);
    expect(screen.getByText("You took it.")).toBeInTheDocument();
    expect(screen.getAllByText("WinnerGuy").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("THE ORACLE")).toBeInTheDocument();
    expect(screen.getByText("Match Accolades")).toBeInTheDocument();
  });
});
