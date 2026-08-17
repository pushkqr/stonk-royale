import { useState } from "react";
import { BookOpen } from "lucide-react";
import { useMatch } from "../state/MatchProvider";
import RulesContent from "./RulesContent";

/**
 * The rules, reachable at any point in a match. Reading them once before the first round
 * is not enough — people forget what SQUEEZE means somewhere around round three, and the
 * alternative is asking out loud and telling the room you do not know.
 */
export default function RulesTab() {
  const match = useMatch();
  const phase = match?.phase;
  const [open, setOpen] = useState(false);

  // This overlay is mounted for the whole match and never unmounts, so its own state has
  // to be reset on a phase change — otherwise it can still be open, covering the chart and
  // liquidation line, when TRADING starts underneath it.
  //
  // Adjusted during render rather than in an effect: React re-runs this pass immediately
  // with the new state, so the overlay is gone in the same frame the phase changes instead
  // of flashing for one paint after it.
  const [lastPhase, setLastPhase] = useState(phase?.phase);
  if (phase?.phase !== lastPhase) {
    setLastPhase(phase?.phase);
    setOpen(false);
  }

  return (
    <>
      <button
        className="corner-tab rules-tab mono"
        onClick={() => setOpen(true)}
        title="How the game works"
      >
        <BookOpen size={12} strokeWidth={2.4} aria-hidden="true" />
        <span>RULES</span>
      </button>

      {open && (
        <div className="overlay" role="dialog" aria-modal="true" onClick={() => setOpen(false)}>
          <div className="panel sheet overlay-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="rules-scroll">
              <RulesContent />
            </div>
            <button className="btn" onClick={() => setOpen(false)}>
              Back to the game
            </button>
          </div>
        </div>
      )}
    </>
  );
}
