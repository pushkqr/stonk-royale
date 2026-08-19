import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import Intermission from "../components/Intermission";

let mockMatch = {};

vi.mock("../state/MatchProvider", () => ({
  useMatch: () => mockMatch,
}));

vi.mock("../lib/sound", () => ({
  sound: {
    bgm: { stop: vi.fn() },
    stamp: vi.fn(),
  },
}));

describe("Intermission", () => {
  beforeEach(() => {
    mockMatch = {
      phase: {
        phase: "INTERMISSION",
        roundIndex: 1,
        totalRounds: 5,
        endsAtMillis: Date.now() + 15000,
        asset: { ticker: "STNK", blurb: "A meme stock" },
        truthfulTips: 1,
      },
      rumor: { text: "Pump expected", claimedRegime: "PUMP" },
      lastRumor: { text: "Was a pump", wasTrue: true },
      settled: {
        roundIndex: 0,
        regime: "PUMP",
        results: [
          {
            playerId: "p1",
            nickname: "Alice",
            roundScore: 50,
            totalScore: 50,
            rumorClaimed: "PUMP",
            tipClaim: "PUMP",
            rumorWasTrue: true,
          },
        ],
      },
      standings: [{ playerId: "p1", nickname: "Alice", totalScore: 50, rank: 1 }],
      session: { playerId: "p1", code: "TEST" },
      serverNow: () => Date.now(),
      feed: [],
      say: vi.fn(),
      suspects: {},
      lobby: { players: [{ playerId: "p1", avatar: "banker" }] },
    };
  });

  it("opens on the reveal beat when there is a round to look back on", () => {
    render(<Intermission />);

    const resultsTab = screen.getByRole("button", { name: /Round 1 Results/i });
    expect(resultsTab).toHaveClass("is-active");
  });

  it("opens straight on the deal when there is nothing to reveal", () => {
    mockMatch.lastRumor = null;
    mockMatch.settled = null;

    render(<Intermission />);

    expect(screen.queryByRole("button", { name: /Results/i })).not.toBeInTheDocument();
    expect(screen.getByText("$STNK")).toBeInTheDocument();
    expect(screen.getByText("Pump expected")).toBeInTheDocument();
  });

  it("switches beat when the tabs are clicked", () => {
    render(<Intermission />);

    const intelTab = screen.getByRole("button", { name: /Intel/i });
    fireEvent.click(intelTab);

    expect(intelTab).toHaveClass("is-active");

    const resultsTab = screen.getByRole("button", { name: /Results/i });
    expect(resultsTab).not.toHaveClass("is-active");
  });

  it("auto-advances from reveal to deal", () => {
    vi.useFakeTimers();
    const now = 1000000;
    vi.setSystemTime(now);

    mockMatch.phase.endsAtMillis = now + 20000; // 20s remaining -> hold is 8000ms
    mockMatch.serverNow = () => now;

    render(<Intermission />);

    const resultsTab = screen.getByRole("button", { name: /Results/i });
    expect(resultsTab).toHaveClass("is-active");

    act(() => {
      vi.advanceTimersByTime(8500);
    });

    const intelTab = screen.getByRole("button", { name: /Intel/i });
    expect(intelTab).toHaveClass("is-active");
    expect(resultsTab).not.toHaveClass("is-active");

    vi.useRealTimers();
  });

  it("shows the round's tab labels from the settled round, not the upcoming one", () => {
    mockMatch.settled.roundIndex = 1;
    mockMatch.phase.roundIndex = 2;

    render(<Intermission />);

    expect(screen.getByRole("button", { name: /Round 2 Results/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Round 3 Intel/i })).toBeInTheDocument();
  });
});
