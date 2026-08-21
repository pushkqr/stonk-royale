import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Trading from "../components/Trading";
import { haptic } from "../lib/haptic";

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

vi.mock("../lib/haptic", () => ({
  haptic: {
    tap: vi.fn(),
    trade: vi.fn(),
    success: vi.fn(),
    loss: vi.fn(),
    liquidate: vi.fn(),
    tick: vi.fn(),
    cancel: vi.fn(),
  },
}));

describe("Trading.jsx Mobile Dock", () => {
  beforeEach(() => {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  it("renders the mobile dock as a tab list with trade selected by default", () => {
    const { container } = render(<Trading />);

    const dock = screen.getByRole("tablist", { name: /Mobile Navigation/i });
    expect(dock).toBeInTheDocument();

    const tradeBtn = screen.getByRole("tab", { name: /Trade/i });
    const intelBtn = screen.getByRole("tab", { name: /Intel/i });
    const ranksBtn = screen.getByRole("tab", { name: /Ranks/i });
    const wireBtn = screen.getByRole("tab", { name: /Wire/i });

    expect(tradeBtn).toHaveClass("is-active");
    expect(intelBtn).not.toHaveClass("is-active");
    expect(ranksBtn).not.toHaveClass("is-active");
    expect(wireBtn).not.toHaveClass("is-active");

    expect(tradeBtn).toHaveAttribute("aria-selected", "true");
    expect(intelBtn).toHaveAttribute("aria-selected", "false");

    const table = container.querySelector(".table");
    expect(table).toHaveClass("tab-trade");
  });

  it("switches tabs when dock buttons are clicked", () => {
    const { container } = render(<Trading />);

    const intelBtn = screen.getByRole("tab", { name: /Intel/i });
    fireEvent.click(intelBtn);

    expect(intelBtn).toHaveClass("is-active");
    expect(intelBtn).toHaveAttribute("aria-selected", "true");
    const table = container.querySelector(".table");
    expect(table).toHaveClass("tab-dossier");

    const ranksBtn = screen.getByRole("tab", { name: /Ranks/i });
    fireEvent.click(ranksBtn);
    expect(ranksBtn).toHaveClass("is-active");
    expect(table).toHaveClass("tab-standings");

    const wireBtn = screen.getByRole("tab", { name: /Wire/i });
    fireEvent.click(wireBtn);
    expect(wireBtn).toHaveClass("is-active");
    expect(table).toHaveClass("tab-wire");
  });

  // The badge is a bare dot, which announces nothing at all. What a screen reader actually
  // gets is the tab name, so that is what has to change when the wire moves behind your
  // back -- asserting the span exists would pass just as well with it hidden off in a
  // corner of the DOM that nothing reads.
  it("names the wire tab as unread when the feed grows behind your back", () => {
    const originalFeed = mockMatch.feed;
    const { rerender } = render(<Trading />);

    // Mounted on the trade tab with the feed already seen: nothing to announce yet.
    expect(screen.queryByRole("tab", { name: /unread messages/i })).not.toBeInTheDocument();

    mockMatch.feed = [
      ...originalFeed,
      { id: 100, kind: "CHAT", playerId: "p2", nickname: "Bob", text: "sell now" },
    ];
    rerender(<Trading />);

    const unread = screen.getByRole("tab", { name: /unread messages/i });
    expect(unread).toBe(screen.getByRole("tab", { name: /Wire/i }));

    // Opening the wire is what marks it read, so the name has to drop back.
    fireEvent.click(unread);
    expect(screen.queryByRole("tab", { name: /unread messages/i })).not.toBeInTheDocument();

    mockMatch.feed = originalFeed;
  });

  it("renders Whale Impact badge when marketImpactMultiplier is >= 2.0", () => {
    mockMatch.lobby.marketImpactMultiplier = 3.5;
    render(<Trading />);
    expect(screen.getByText(/WHALE IMPACT \(3.5x\)/i)).toBeInTheDocument();
    mockMatch.lobby.marketImpactMultiplier = 1.0;
  });

  it("renders the full breaking-news headline without truncating it", () => {
    const headline = "$SOLARIS VOLUME DRIES UP, TRADERS SIDELINED";
    const originalFeed = mockMatch.feed;
    mockMatch.feed = [
      ...originalFeed,
      { id: 99, kind: "NEWS", text: headline, round: 0 },
    ];

    const { container } = render(<Trading />);

    const banner = container.querySelector(".in-chart-news-banner");
    expect(banner).toBeInTheDocument();
    expect(banner.querySelector(".news-text")).toHaveTextContent(headline);

    mockMatch.feed = originalFeed;
  });

  it("prints the cross-check verdict as a stamped word beside its sentence", () => {
    // The verdict used to be one of five lucide glyphs, which said nothing a screen reader
    // or a glance could use. Naming it is the point of the change, so the name is what this
    // asserts — not the class it happens to wear.
    const originalFeed = mockMatch.feed;
    mockMatch.feed = [
      ...originalFeed,
      { id: 77, kind: "NEWS", text: "$STNK SHORT INTEREST HITS ALL-TIME HIGH", round: 0 },
    ];

    render(<Trading />);

    // The tip claims PUMP; a squeeze headline points elsewhere, so the tip is contradicted.
    expect(screen.getByText("CONFLICTING")).toBeInTheDocument();
    expect(screen.getByText(/your tip says otherwise/i)).toBeInTheDocument();

    mockMatch.feed = originalFeed;
  });

  it("renders the player's private tip in full", () => {
    const tipText = "$VOID is done. Everyone's heading for the exit.";
    const originalRumor = mockMatch.rumor;
    mockMatch.rumor = {
      text: tipText,
      claimedRegime: "DUMP",
    };
    const { container } = render(<Trading />);
    const pill = container.querySelector(".intel-pill");
    expect(pill).toBeInTheDocument();
    expect(pill).toHaveTextContent(tipText);
    mockMatch.rumor = originalRumor;
  });
});

/**
 * Room keys the phase wrapper on the phase name, so this screen is a fresh mount every time
 * a round opens while `feed` carries the whole match. Anything here that remembers what it
 * has already reacted to does so in a ref, and those refs start at zero again — so the
 * effects have to ask which round an event belongs to, not just whether they have seen it.
 */
describe("Trading.jsx round boundaries", () => {
  const originalFeed = mockMatch.feed;
  const originalRound = mockMatch.phase.roundIndex;

  beforeEach(() => {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    haptic.liquidate.mockClear();
  });

  afterEach(() => {
    mockMatch.feed = originalFeed;
    mockMatch.phase.roundIndex = originalRound;
  });

  it("does not replay last round's liquidation when the next round opens", () => {
    // Round 0 blew this player up. Round 1 is now open, and this component has just
    // mounted for the first time — exactly the state a real second round starts in.
    mockMatch.feed = [
      { id: 7, kind: "LIQUIDATION", round: 0, playerId: "p1", nickname: "Alice",
        text: "Alice got LIQUIDATED for $4,000" },
    ];
    mockMatch.phase.roundIndex = 1;

    const { container } = render(<Trading />);

    expect(container.querySelector(".liquidation-flash")).toBeNull();
    expect(haptic.liquidate).not.toHaveBeenCalled();
  });

  it("still reacts to a liquidation in the round being played", () => {
    mockMatch.feed = [
      { id: 7, kind: "LIQUIDATION", round: 1, playerId: "p1", nickname: "Alice",
        text: "Alice got LIQUIDATED for $4,000" },
    ];
    mockMatch.phase.roundIndex = 1;

    const { container } = render(<Trading />);

    expect(container.querySelector(".liquidation-flash")).not.toBeNull();
    expect(haptic.liquidate).toHaveBeenCalled();
  });

  it("does not replay last round's flow surge either", () => {
    mockMatch.feed = [
      { id: 8, kind: "FLOW", round: 0, text: "THE ROOM IS PILING IN" },
    ];
    mockMatch.phase.roundIndex = 1;

    const { container } = render(<Trading />);

    expect(container.querySelector(".floor.is-surging-pump")).toBeNull();
  });
});
