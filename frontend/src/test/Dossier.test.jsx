import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Dossier from "../components/Dossier";

describe("Dossier.jsx", () => {
  it("renders rumor, truthful tips count, and headlines", () => {
    render(
      <Dossier
        rumor={{ text: "Pump rumor", claimedRegime: "PUMP" }}
        truthfulTips={2}
        feed={[
          { id: 1, kind: "NEWS", text: "Breaking: Tech Rally", round: 0 },
        ]}
        roundIndex={0}
      />
    );

    expect(screen.getByText("What you know")).toBeInTheDocument();
    expect(screen.getByText("Pump rumor")).toBeInTheDocument();
    expect(screen.getByText(/Claims:\s*PUMP/i)).toBeInTheDocument();
    expect(screen.getByText("2 of you got the truth.")).toBeInTheDocument();
    expect(screen.getByText("Breaking: Tech Rally")).toBeInTheDocument();
  });
});
