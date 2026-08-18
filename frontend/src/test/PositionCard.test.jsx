import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import PositionCard from "../components/PositionCard";

// vi.mock is hoisted above the imports, so the factory cannot close over an ordinary
// const — vi.hoisted is what makes a mutable price visible to it.
const live = vi.hoisted(() => ({ price: 100 }));

vi.mock("../state/MatchProvider", () => ({
  usePrice: () => ({ tick: { price: live.price }, series: { points: [], count: 1 } }),
}));

const longPosition = {
  side: "LONG",
  leverage: 5,
  margin: 1000,
  entryPrice: 100,
  liquidationPrice: 82,
  unrealisedPnl: 0,
};

const header = () => screen.getByText("Your position").closest(".deck-open-header");

describe("PositionCard.jsx", () => {
  it("tints green while the position is in profit", () => {
    live.price = 110;
    render(<PositionCard position={longPosition} onClose={vi.fn()} disabled={false} />);
    expect(header()).toHaveClass("tone-pump");
  });

  it("tints red while the position is underwater", () => {
    live.price = 95;
    render(<PositionCard position={longPosition} onClose={vi.fn()} disabled={false} />);
    expect(header()).toHaveClass("tone-dump");
  });

  it("stays neutral at the entry price rather than greeting you green", () => {
    live.price = 100;
    render(<PositionCard position={longPosition} onClose={vi.fn()} disabled={false} />);
    expect(header()).toHaveClass("tone-muted");
  });

  it("flags the card once the price is close to the liquidation wall", () => {
    // Entry 100, liquidation 82: at 85 only about 17% of the distance is left.
    live.price = 85;
    render(<PositionCard position={longPosition} onClose={vi.fn()} disabled={false} />);
    expect(header()).toHaveClass("is-near-liq");
  });

  it("names the liquidation price in the same words the deck used", () => {
    live.price = 100;
    render(<PositionCard position={longPosition} onClose={vi.fn()} disabled={false} />);
    expect(screen.getByText(/wiped out at/)).toBeInTheDocument();
  });
});
