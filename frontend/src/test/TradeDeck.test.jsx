import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TradeDeck from "../components/TradeDeck";

vi.mock("../state/MatchProvider", () => ({
  usePrice: () => ({
    tick: { price: 100 },
    series: { points: [], count: 1 },
  }),
}));

describe("TradeDeck.jsx", () => {
  const defaultMe = {
    cash: 10000,
    equity: 10000,
    position: null,
  };

  it("renders preset buttons and defaults to 3x leverage and 50% size", () => {
    render(<TradeDeck me={defaultMe} onOpen={vi.fn()} onClose={vi.fn()} disabled={false} />);
    expect(screen.getByText("Safe")).toBeInTheDocument();
    expect(screen.getByText("Standard")).toBeInTheDocument();
    expect(screen.getByText("YOLO")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Long/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Short/i })).toBeInTheDocument();
  });

  it("clicking preset updates leverage and size", () => {
    render(<TradeDeck me={defaultMe} onOpen={vi.fn()} onClose={vi.fn()} disabled={false} />);
    const yoloBtn = screen.getByText("YOLO");
    fireEvent.click(yoloBtn);
    expect(screen.getByText("10x")).toBeInTheDocument();
    expect(screen.getByText("High Risk / Scalp")).toBeInTheDocument();
  });

  it("calls onOpen with side, sizeFraction, and leverage when Long is clicked", () => {
    const handleOpen = vi.fn();
    render(<TradeDeck me={defaultMe} onOpen={handleOpen} onClose={vi.fn()} disabled={false} />);
    const longBtn = screen.getByRole("button", { name: /Long/i });
    fireEvent.click(longBtn);
    expect(handleOpen).toHaveBeenCalledWith("LONG", 0.5, 3);
  });

  it("renders open position view and calls onClose when Close button is clicked", () => {
    const meWithPosition = {
      cash: 5000,
      equity: 5500,
      position: {
        side: "LONG",
        leverage: 5,
        margin: 5000,
        entryPrice: 100,
        liquidationPrice: 82,
        unrealisedPnl: 500,
      },
    };
    const handleClose = vi.fn();
    render(<TradeDeck me={meWithPosition} onOpen={vi.fn()} onClose={handleClose} disabled={false} />);
    expect(screen.getByText("Your position")).toBeInTheDocument();
    expect(screen.getByText("5x LONG")).toBeInTheDocument();
    const closeBtn = screen.getByRole("button", { name: /Close Position/i });
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalled();
  });

  it("triggers Long on L key press", () => {
    const handleOpen = vi.fn();
    render(<TradeDeck me={defaultMe} onOpen={handleOpen} onClose={vi.fn()} disabled={false} />);

    fireEvent.keyDown(window, { key: "l" });
    expect(handleOpen).toHaveBeenCalledWith("LONG", 0.5, 3);
  });

  it("triggers Short on S key press", () => {
    const handleOpen = vi.fn();
    render(<TradeDeck me={defaultMe} onOpen={handleOpen} onClose={vi.fn()} disabled={false} />);

    fireEvent.keyDown(window, { key: "s" });
    expect(handleOpen).toHaveBeenCalledWith("SHORT", 0.5, 3);
  });

  it("triggers Close on Space key press when position is open", () => {
    const meWithPosition = {
      cash: 5000,
      equity: 5500,
      position: { side: "LONG", leverage: 5, margin: 5000, entryPrice: 100, liquidationPrice: 82 },
    };
    const handleClose = vi.fn();
    render(<TradeDeck me={meWithPosition} onOpen={vi.fn()} onClose={handleClose} disabled={false} />);

    fireEvent.keyDown(window, { key: " " });
    expect(handleClose).toHaveBeenCalled();
  });

  it("ignores keyboard shortcuts when focus is inside an input field", () => {
    const handleOpen = vi.fn();
    render(
      <div>
        <input data-testid="chat-input" />
        <TradeDeck me={defaultMe} onOpen={handleOpen} onClose={vi.fn()} disabled={false} />
      </div>
    );

    const input = screen.getByTestId("chat-input");
    fireEvent.keyDown(input, { key: "l" });
    expect(handleOpen).not.toHaveBeenCalled();
  });

  it("keeps the close button live immediately after opening, with no server round trip", () => {
    render(<TradeDeck me={defaultMe} onOpen={vi.fn()} onClose={vi.fn()} disabled={false} />);

    fireEvent.click(screen.getByRole("button", { name: /Long/i }));

    // `me` never updates here, so this passes only if the optimistic path alone leaves the
    // control enabled — which is the whole point of the change.
    expect(screen.getByRole("button", { name: /Close Position/i })).toBeEnabled();
  });

  it("hands the closing position to onClose so the PnL floater can be drawn", () => {
    const meWithPosition = {
      cash: 5000,
      equity: 5500,
      position: {
        side: "LONG",
        leverage: 5,
        margin: 5000,
        entryPrice: 100,
        liquidationPrice: 82,
        unrealisedPnl: 500,
      },
    };
    const handleClose = vi.fn();
    render(<TradeDeck me={meWithPosition} onOpen={vi.fn()} onClose={handleClose} disabled={false} />);

    fireEvent.click(screen.getByRole("button", { name: /Close Position/i }));

    expect(handleClose).toHaveBeenCalledWith(meWithPosition.position, expect.any(Number));
  });
});

