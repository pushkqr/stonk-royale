import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMatch } from "../state/MatchProvider";

/**
 * The way out of a room, on every screen inside one.
 *
 * Two-step on purpose: this sits a few pixels from the chart during a live round, and a
 * stray click that silently walked you out mid-position would be the worst thing a corner
 * control could do. The second press is the one that leaves.
 */
export default function LeaveTab() {
  const match = useMatch();
  const navigate = useNavigate();
  const [armed, setArmed] = useState(false);

  const phase = match?.phase;
  const inPlay = phase && phase.phase !== "LOBBY" && phase.phase !== "FINISHED";

  useEffect(() => {
    if (!armed) return undefined;
    const id = setTimeout(() => setArmed(false), 5000);
    return () => clearTimeout(id);
  }, [armed]);

  const handleLeave = () => {
    if (!match) {
      navigate("/");
      return;
    }
    if (armed) {
      match.quit();
    } else {
      setArmed(true);
    }
  };

  return (
    <button
      className={`corner-tab leave-tab mono ${armed ? "is-armed" : ""}`}
      onClick={handleLeave}
      title={
        !match
          ? "Leave to home"
          : armed
            ? inPlay
              ? "Press again to leave (forfeits match)"
              : "Press again to leave"
            : "Leave this room"
      }
      aria-label={
        !match
          ? "Leave to home"
          : armed
            ? "Press again to leave the room"
            : "Leave this room"
      }
    >
      {armed ? "TAP AGAIN" : "LEAVE"}
    </button>
  );
}
