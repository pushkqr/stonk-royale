import { useEffect, useState } from "react";
import { useMatch } from "../state/MatchProvider";
import RulesContent from "./RulesContent";

/**
 * The rules, reachable at any point in a match. Reading them once before the first round
 * is not enough — people forget what SQUEEZE means somewhere around round three, and the
 * alternative is asking out loud and telling the room you do not know.
 */
export default function RulesTab() {
  const { phase } = useMatch();
  const [open, setOpen] = useState(false);

  // This overlay is mounted for the whole match and never unmounts, so its own state has
  // to be reset on a phase change — otherwise it can still be open, covering the chart and
  // liquidation line, when TRADING starts underneath it.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- closing on phase change is exactly what this effect is for
  useEffect(() => setOpen(false), [phase?.phase]);

  return (
    <>
      <button
        className="corner-tab rules-tab mono"
        onClick={() => setOpen(true)}
        title="How the game works"
      >
        RULES
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
