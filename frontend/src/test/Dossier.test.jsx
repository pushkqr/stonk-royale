import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Dossier from "../components/Dossier";

describe("Dossier.jsx", () => {
  const defaultPlayers = [
    { playerId: "me", nickname: "Self" },
    { playerId: "p1", nickname: "Bob", bot: false },
    { playerId: "p2", nickname: "Alice", bot: true },
  ];

  it("renders opponents and allows toggling Trust and Sus", () => {
    const handleToggle = vi.fn();
    render(
      <Dossier
        rumor={{ text: "Pump rumor", claimedRegime: "PUMP" }}
        feed={[]}
        roundIndex={0}
        players={defaultPlayers}
        meId="me"
        suspects={{ p1: "TRUSTED" }}
        onToggleSuspect={handleToggle}
      />
    );

    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.queryByText("Self")).not.toBeInTheDocument();

    const susBtns = screen.getAllByRole("button", { name: /Sus/i });
    fireEvent.click(susBtns[0]);
    expect(handleToggle).toHaveBeenCalledWith("p1", "SUS");
  });
});
