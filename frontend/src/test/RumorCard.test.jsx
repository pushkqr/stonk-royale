import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import RumorCard from "../components/RumorCard";

describe("RumorCard.jsx", () => {
  it("renders rumor text, claimed regime, and bias badge", () => {
    render(
      <RumorCard
        text="A major whale is accumulating ahead of the protocol launch."
        claimedRegime="PUMP"
      />
    );
    expect(screen.getByText(/whale is accumulating/i)).toBeInTheDocument();
    expect(screen.getByText(/Claims: PUMP/i)).toBeInTheDocument();
    expect(screen.getByText("BET IT GOES UP")).toBeInTheDocument();
  });

  it("renders TRUE stamp with 3D flip class", () => {
    const { container } = render(
      <RumorCard
        text="Insider leak confirmed."
        stamp="TRUE"
      />
    );
    expect(screen.getByText("TRUE")).toBeInTheDocument();
    expect(container.querySelector(".rumor-reveal-flip")).toBeInTheDocument();
    expect(container.querySelector(".stamp-true")).toBeInTheDocument();
  });

  it("renders LIE stamp with 3D flip class", () => {
    const { container } = render(
      <RumorCard
        text="False rumor."
        stamp="LIE"
      />
    );
    expect(screen.getByText("LIE")).toBeInTheDocument();
    expect(container.querySelector(".stamp-lie")).toBeInTheDocument();
  });
});
