import { useEffect, useState } from "react";
import { useMatch } from "../state/MatchProvider";

/**
 * The way out of a room, on every screen inside one.
 *
 * Two-step on purpose: this sits a few pixels from the chart during a live round, and a
 * stray click that silently walked you out mid-position would be the worst thing a corner
 * control could do. The second press is the one that leaves.
 */
export default function LeaveTab() {
  const { quit } = useMatch();
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return undefined;
    const id = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(id);
  }, [armed]);

  return (
    <button
      className={`corner-tab leave-tab mono ${armed ? "is-armed" : ""}`}
      onClick={() => (armed ? quit() : setArmed(true))}
      title="Leave this room"
    >
      {armed ? "LEAVE?" : "LEAVE"}
    </button>
  );
}
