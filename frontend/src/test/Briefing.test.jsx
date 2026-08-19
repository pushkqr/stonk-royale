import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import Briefing from "../components/Briefing";

let mockMatch = {};
let intersect;

vi.mock("../state/MatchProvider", () => ({
  useMatch: () => mockMatch,
}));

describe("Briefing", () => {
  beforeEach(() => {
    localStorage.clear();
    window.IntersectionObserver = class {
      constructor(cb) {
        intersect = cb;
      }
      observe() {}
      disconnect() {}
    };

    mockMatch = {
      phase: { endsAtMillis: Date.now() + 30000 },
      readyState: { ready: 0, total: 4 },
      ready: vi.fn(),
      connected: true,
      serverNow: () => Date.now(),
    };
  });

  it("keeps ready shut until the rules have been read to the end", () => {
    render(<Briefing />);

    const btn = screen.getByRole("button", { name: "Read to the end first" });
    expect(btn).toBeDisabled();

    act(() => {
      intersect([{ isIntersecting: true }]);
    });

    const readyBtn = screen.getByRole("button", { name: "Got it — I'm ready" });
    expect(readyBtn).toBeEnabled();
  });

  it("marks the briefing as seen and readies up on confirm", () => {
    render(<Briefing />);

    act(() => {
      intersect([{ isIntersecting: true }]);
    });

    const readyBtn = screen.getByRole("button", { name: "Got it — I'm ready" });
    fireEvent.click(readyBtn);

    expect(mockMatch.ready).toHaveBeenCalled();
    expect(localStorage.getItem("stonk:briefed")).toBe("1");
  });

  it("skips the gate for somebody who has read it before", () => {
    localStorage.setItem("stonk:briefed", "1");

    render(<Briefing />);

    expect(mockMatch.ready).toHaveBeenCalled();
    expect(screen.getByText("You have done this before.")).toBeInTheDocument();
  });

  it("waits for the socket before readying a returning player", () => {
    localStorage.setItem("stonk:briefed", "1");
    mockMatch.connected = false;

    render(<Briefing />);

    expect(mockMatch.ready).not.toHaveBeenCalled();
  });
});
