import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import PriceChart from "../components/PriceChart";

describe("PriceChart.jsx", () => {
  beforeEach(() => {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  it("renders price chart canvas correctly", () => {
    render(
      <PriceChart
        roundMillis={90000}
        position={null}
        startPrice={100}
        series={{ points: [{ t: 0, p: 100 }, { t: 1000, p: 105 }], count: 2 }}
      />
    );

    const canvas = screen.getByRole("img", { name: /Price chart for the round in progress/i });
    expect(canvas).toBeInTheDocument();
  });

  it("renders floating PnL pills when floaters are provided", () => {
    const mockFloaters = [
      { id: 1, text: "+$3,450", subtext: "+34.5%", tone: "pump" },
      { id: 2, text: "💥 REKT", subtext: "-100% MARGIN CALL", tone: "rekt" },
    ];

    render(
      <PriceChart
        roundMillis={90000}
        position={null}
        startPrice={100}
        floaters={mockFloaters}
        series={{ points: [{ t: 0, p: 100 }], count: 1 }}
      />
    );

    expect(screen.getByText("+$3,450")).toBeInTheDocument();
    expect(screen.getByText("+34.5%")).toBeInTheDocument();
    expect(screen.getByText("💥 REKT")).toBeInTheDocument();
    expect(screen.getByText("-100% MARGIN CALL")).toBeInTheDocument();
  });

  it("accepts and handles liquidations array prop without throwing", () => {
    const mockLiquidations = [
      { id: 10, nickname: "Bob", isMine: false, t: 5000, p: 90 },
      { id: 11, nickname: "Alice", isMine: true, t: 10000, p: 80 },
    ];

    expect(() => {
      render(
        <PriceChart
          roundMillis={90000}
          position={null}
          startPrice={100}
          liquidations={mockLiquidations}
          series={{ points: [{ t: 0, p: 100 }, { t: 12000, p: 85 }], count: 2 }}
        />
      );
    }).not.toThrow();
  });
});
