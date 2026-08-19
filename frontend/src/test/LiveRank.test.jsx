import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import LiveRank from "../components/LiveRank";

/**
 * The strip's answer to "am I winning", which a phone player otherwise has to leave a
 * leveraged position to find out. What matters is that it reads the board's own order —
 * anything that recomputes a rank here could disagree with the Standings panel, and two
 * different answers on one screen is worse than the question going unanswered.
 */
describe("LiveRank", () => {
  // Ordered so that the board's order and the ids' own order disagree at every seat. A
  // fixture where the leader is also alphabetically first proves nothing: a rank derived
  // from the wrong thing entirely would still come out right.
  const board = [
    { playerId: "c", equity: 12000 },
    { playerId: "a", equity: 9000 },
    { playerId: "b", equity: 7000 },
  ];

  it("reads the place out of the board's order, not the row's identity", () => {
    render(<LiveRank rows={board} meId="b" />);
    expect(screen.getByText(/#3/)).toBeInTheDocument();
    expect(screen.getByText(/of 3/)).toBeInTheDocument();
  });

  it("counts the leader as first rather than zeroth", () => {
    render(<LiveRank rows={board} meId="c" />);
    expect(screen.getByText(/#1/)).toBeInTheDocument();
  });

  it("says nothing in a room of one, where a standing is not a fact about anything", () => {
    const { container } = render(<LiveRank rows={[{ playerId: "a", equity: 1 }]} meId="a" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("says nothing for a spectator who holds no seat on the board", () => {
    const { container } = render(<LiveRank rows={board} meId="nobody" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("survives a board that has not arrived yet", () => {
    const { container } = render(<LiveRank rows={undefined} meId="a" />);
    expect(container).toBeEmptyDOMElement();
  });
});
