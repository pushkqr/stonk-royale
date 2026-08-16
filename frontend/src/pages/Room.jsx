import { useState } from "react";
import { useParams } from "react-router-dom";
import { MatchProvider, useMatch } from "../state/MatchProvider";
import { loadSeat, saveSeat } from "../lib/session";
import JoinGate from "../components/JoinGate";
import MuteToggle from "../components/MuteToggle";
import LeaveTab from "../components/LeaveTab";
import Lobby from "../components/Lobby";
import Briefing from "../components/Briefing";
import RulesTab from "../components/RulesTab";
import Intermission from "../components/Intermission";
import Trading from "../components/Trading";
import Results from "../components/Results";

export default function Room() {
  const { code } = useParams();
  const [seat, setSeat] = useState(() => loadSeat(code));

  // Arriving on a shared link with no seat yet: ask for a name, nothing more.
  if (!seat) {
    return (
      <>
        <LeaveTab />
        <RulesTab />
        <MuteToggle />
        <JoinGate
          code={code}
          onSeated={(next) => {
            saveSeat(next);
            setSeat(next);
          }}
        />
      </>
    );
  }

  return (
    <MatchProvider session={seat}>
      <Screen />
    </MatchProvider>
  );
}

function Screen() {
  const { phase, lobby, connected, error, dismissError } = useMatch();
  const current = phase?.phase ?? lobby?.phase ?? "LOBBY";

  return (
    <>
      {!connected && <div className="banner">Reconnecting…</div>}
      {error && (
        <button className="banner banner-bad" onClick={dismissError}>
          {error} <span className="muted">— dismiss</span>
        </button>
      )}

      <LeaveTab />
      <RulesTab />
      <MuteToggle />

      {/* Keyed on the phase so each change replays the entrance instead of hard-cutting. */}
      <div key={current} className="phase-swap">
        {current === "LOBBY" && <Lobby />}
        {current === "BRIEFING" && <Briefing />}
        {current === "INTERMISSION" && <Intermission />}
        {current === "TRADING" && <Trading />}
        {current === "FINISHED" && <Results />}
      </div>
    </>
  );
}
