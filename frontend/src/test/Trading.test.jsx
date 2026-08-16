import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Trading from "../components/Trading";

const mockMatch = {
  phase: {
    roundIndex: 0,
    totalRounds: 5,
    endsAtMillis: Date.now() + 60000,
    asset: { ticker: "STNK", startPrice: 100 },
    truthfulTips: 2,
    totalPlayers: 4,
  },
  board: [
    { playerId: "p1", nickname: "Alice", rank: 1, roundScore: 1000, cumulativeScore: 1000 },
    { playerId: "p2", nickname: "Bob", rank: 2, roundScore: 500, cumulativeScore: 500 },
  ],
  feed: [
    { id: 1, kind: "CHAT", playerId: "p2", nickname: "Bob", text: "Hello traders" },
  ],
  me: { inRound: true, cash: 10000, position: null },
  session: { playerId: "p1", code: "ABCD" },
  lobby: { roundSeconds: 90, startingCash: 10000, impact: 1 },
  rumor: { text: "Insiders buying", claimedRegime: "PUMP" },
  open: vi.fn(),
  close: vi.fn(),
  say: vi.fn(),
  serverNow: () => Date.now(),
  suspects: {},
};

vi.mock("../state/MatchProvider", () => ({
  useMatch: () => mockMatch,
  usePrice: () => ({ series: { points: [], count: 0 } }),
}));

vi.mock("../lib/sound", () => ({
  sound: {
    bgm: { start: vi.fn(), stop: vi.fn() },
    tick: vi.fn(),
    news: vi.fn(),
  },
}));

vi.mock("../lib/telemetry", () => ({
  telemetry: {
    start: vi.fn(),
    stop: vi.fn(),
    frame: vi.fn(),
  },
}));

describe("Trading.jsx Mobile Navigation", () => {
  beforeEach(() => {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  it("renders mobile dock with 4 navigation buttons and default trade tab", () => {
    const { container } = render(<Trading />);

    const dock = screen.getByRole("navigation", { name: /Mobile Navigation/i });
    expect(dock).toBeInTheDocument();

    const tradeBtn = screen.getByRole("button", { name: /Trade/i });
    const intelBtn = screen.getByRole("button", { name: /Intel/i });
    const ranksBtn = screen.getByRole("button", { name: /Ranks/i });
    const wireBtn = screen.getByRole("button", { name: /Wire/i });

    expect(tradeBtn).toHaveClass("is-active");
    expect(intelBtn).not.toHaveClass("is-active");
    expect(ranksBtn).not.toHaveClass("is-active");
    expect(wireBtn).not.toHaveClass("is-active");

    const table = container.querySelector(".table");
    expect(table).toHaveClass("tab-trade");
  });

  it("switches tabs when dock buttons are clicked", () => {
    const { container } = render(<Trading />);

    const intelBtn = screen.getByRole("button", { name: /Intel/i });
    fireEvent.click(intelBtn);

    expect(intelBtn).toHaveClass("is-active");
    const table = container.querySelector(".table");
    expect(table).toHaveClass("tab-dossier");

    const ranksBtn = screen.getByRole("button", { name: /Ranks/i });
    fireEvent.click(ranksBtn);
    expect(ranksBtn).toHaveClass("is-active");
    expect(table).toHaveClass("tab-standings");

    const wireBtn = screen.getByRole("button", { name: /Wire/i });
    fireEvent.click(wireBtn);
    expect(wireBtn).toHaveClass("is-active");
    expect(table).toHaveClass("tab-wire");
  });
});
