import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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

    const btn = screen.getByRole("button", { name: /^my tip says PUMP$/i });
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
});
