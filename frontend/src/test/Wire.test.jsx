import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import Wire from "../components/Wire";

describe("Wire", () => {
  it("shows the empty state when nobody has spoken", () => {
    render(<Wire feed={[]} onSay={vi.fn()} />);
    expect(screen.getByText("Nobody's talking. Suspicious.")).toBeInTheDocument();
  });

  it("renders a chat line with its speaker", () => {
    const feed = [
      { id: 1, kind: "CHAT", playerId: "p2", nickname: "Bob", text: "pump it up" },
    ];
    render(<Wire feed={feed} onSay={vi.fn()} />);

    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("pump it up")).toBeInTheDocument();
  });

  it("renders non-chat feed items without a speaker", () => {
    const feed = [{ id: 2, kind: "NEWS", text: "$STNK DOWNGRADED" }];
    const { container } = render(<Wire feed={feed} onSay={vi.fn()} />);

    expect(screen.getByText("$STNK DOWNGRADED")).toBeInTheDocument();
    expect(container.querySelectorAll(".wire-name").length).toBe(0);
  });

  it("sends the claim along with a quick line", () => {
    const onSay = vi.fn();
    render(<Wire feed={[]} onSay={onSay} />);

    const btn = screen.getByRole("button", { name: /^PUMP$/i });
    fireEvent.click(btn);

    expect(onSay).toHaveBeenCalledWith("my tip says PUMP", "PUMP");
  });

  it("sends free text and clears the input", () => {
    const onSay = vi.fn();
    render(<Wire feed={[]} onSay={onSay} />);

    const input = screen.getByLabelText("Message the room");
    fireEvent.change(input, { target: { value: "dump it all" } });

    const submitBtn = screen.getByRole("button", { name: "Say" });
    fireEvent.click(submitBtn);

    expect(onSay).toHaveBeenCalledWith("dump it all");
    expect(input.value).toBe("");
  });

  it("does not send blank or whitespace-only text", () => {
    const onSay = vi.fn();
    render(<Wire feed={[]} onSay={onSay} />);

    const input = screen.getByLabelText("Message the room");
    fireEvent.change(input, { target: { value: "   " } });

    const form = input.closest("form");
    fireEvent.submit(form);

    expect(onSay).not.toHaveBeenCalled();
  });

  it("marks a player you flagged as suspect", () => {
    const feed = [
      { id: 1, kind: "CHAT", playerId: "p2", nickname: "Bob", text: "trust me" },
    ];
    render(<Wire feed={feed} onSay={vi.fn()} suspects={{ p2: "SUS" }} />);

    expect(screen.getByText("SUS")).toBeInTheDocument();
  });

  it("draws the avatar the room agreed on", () => {
    const feed = [
      { id: 1, kind: "CHAT", playerId: "p2", nickname: "Bob", text: "gm" },
      { id: 2, kind: "CHAT", playerId: "p3", nickname: "Charlie", text: "gn" },
    ];
    const avatars = new Map([["p2", { playerId: "p2", avatar: "degen" }]]);

    const { container } = render(<Wire feed={feed} onSay={vi.fn()} avatars={avatars} />);

    const svgs = container.querySelectorAll("svg.avatar-svg");
    expect(svgs[0]).toHaveClass("avatar-degen");
    expect(svgs[1]).toHaveClass("avatar-banker");
  });

  it("fires quick lines up to TAP_CAPACITY in a burst and then disables them", () => {
    vi.useFakeTimers();
    try {
      const onSay = vi.fn();
      render(<Wire feed={[]} onSay={onSay} />);

      const btn = screen.getByRole("button", { name: /^PUMP$/i });

      // Click 5 times (TAP_CAPACITY)
      for (let i = 0; i < 5; i++) {
        fireEvent.click(btn);
      }
      expect(onSay).toHaveBeenCalledTimes(5);

      // Button should now be disabled (cooling)
      expect(btn).toBeDisabled();

      // 6th click should not fire onSay
      fireEvent.click(btn);
      expect(onSay).toHaveBeenCalledTimes(5);

      // Advance time by TAP_REFILL_MS wrapped in act
      act(() => {
        vi.advanceTimersByTime(1200);
      });

      // Button should no longer be cooling/disabled
      expect(btn).not.toBeDisabled();
      fireEvent.click(btn);
      expect(onSay).toHaveBeenCalledTimes(6);
    } finally {
      vi.useRealTimers();
    }
  });

  it("still submits the text form while the quick-tap buttons are cooling", () => {
    vi.useFakeTimers();
    try {
      const onSay = vi.fn();
      render(<Wire feed={[]} onSay={onSay} />);

      const quickBtn = screen.getByRole("button", { name: /^PUMP$/i });
      for (let i = 0; i < 5; i++) {
        fireEvent.click(quickBtn);
      }
      expect(quickBtn).toBeDisabled();

      // Text form must still be enabled and submit successfully
      const input = screen.getByLabelText("Message the room");
      expect(input).not.toBeDisabled();
      fireEvent.change(input, { target: { value: "I can still type freely" } });

      const submitBtn = screen.getByRole("button", { name: "Say" });
      expect(submitBtn).not.toBeDisabled();
      fireEvent.click(submitBtn);

      expect(onSay).toHaveBeenCalledWith("I can still type freely");
      expect(onSay).toHaveBeenCalledTimes(6);
    } finally {
      vi.useRealTimers();
    }
  });

  /**
   * Going on record is the one tap the game holds a player to, and until now it looked
   * exactly like the eight that hold them to nothing. These cover the telling, not the
   * styling — that the claim is named back while it can still be acted on, that talk which
   * binds nobody stays silent, and that the notice dies with the round the way the server's
   * copy does.
   */
  describe("the record", () => {
    it("names the claim back to the player who made it", () => {
      render(<Wire feed={[]} onSay={vi.fn()} roundIndex={0} />);

      // By role, not by text: the heading above the buttons also says "go on record", and
      // that is the point of it — the warning has to be readable before anyone taps.
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /^PUMP$/i }));

      const notice = screen.getByRole("status");
      expect(notice).toHaveTextContent(/on record/i);
      expect(notice).toHaveTextContent(/your tip says PUMP/i);
    });

    it("keeps quiet for talk that binds nobody", () => {
      render(<Wire feed={[]} onSay={vi.fn()} roundIndex={0} />);

      fireEvent.click(screen.getByRole("button", { name: /^i'm long$/i }));
      fireEvent.click(screen.getByRole("button", { name: "Rekt (Skull)" }));

      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("replaces the record when the player changes their story", () => {
      render(<Wire feed={[]} onSay={vi.fn()} roundIndex={0} />);

      fireEvent.click(screen.getByRole("button", { name: /^PUMP$/i }));
      fireEvent.click(screen.getByRole("button", { name: /^DUMP$/i }));

      // Last claim wins on the server too — recordTipClaim is a put, not an add.
      expect(screen.getByRole("status")).toHaveTextContent(/your tip says DUMP/i);
      expect(screen.getByRole("status")).not.toHaveTextContent(/PUMP/i);
    });

    it("forgets the record when the next round deals a new tip", () => {
      const { rerender } = render(<Wire feed={[]} onSay={vi.fn()} roundIndex={0} />);
      fireEvent.click(screen.getByRole("button", { name: /^PUMP$/i }));
      expect(screen.getByRole("status")).toBeInTheDocument();

      // Match.planRound bumps roundIndex immediately before enterIntermission wipes every
      // claim, so this is the same instant the server stops holding anyone to anything.
      rerender(<Wire feed={[]} onSay={vi.fn()} roundIndex={1} />);

      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("still sends the full sentence the room reads, not the button's face", () => {
      const onSay = vi.fn();
      render(<Wire feed={[]} onSay={onSay} roundIndex={0} />);

      fireEvent.click(screen.getByRole("button", { name: /^SQUEEZE$/i }));

      expect(onSay).toHaveBeenCalledWith("it's a squeeze", "SQUEEZE");
    });
  });
});
