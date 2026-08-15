import { useCallback, useEffect, useState } from "react";

/**
 * The operator's view: who is playing right now, how much has ever been played, and how the
 * game is actually running on other people's machines.
 *
 * There is no login form. The endpoint answers 401 with a WWW-Authenticate header, so the
 * browser puts up its own credential prompt — which is one less password field to build and
 * one less place to get one wrong.
 */
const REFRESH_MS = 5000;

const duration = (ms) => {
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  return hours < 24 ? `${hours}h ${mins % 60}m` : `${Math.floor(hours / 24)}d ${hours % 24}h`;
};

function Figure({ label, value, note }) {
  return (
    <div className="admin-figure">
      <span className="eyebrow">{label}</span>
      <span className="display admin-value">{value}</span>
      {note && <span className="eyebrow muted">{note}</span>}
    </div>
  );
}

export default function Admin() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/stats", { credentials: "include" });
      if (res.status === 401) throw new Error("Wrong password, or the panel is disabled.");
      if (res.status === 403) throw new Error("ADMIN_PASSWORD is not set on the server.");
      if (!res.ok) throw new Error(`Server said ${res.status}.`);
      setData(await res.json());
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  // Both the first read and the repeats go through timers, so nothing sets state straight
  // out of the effect body. The first one lands on the next tick, which is imperceptible
  // next to the fetch it is waiting on anyway.
  useEffect(() => {
    const first = setTimeout(load, 0);
    const repeat = setInterval(load, REFRESH_MS);
    return () => {
      clearTimeout(first);
      clearInterval(repeat);
    };
  }, [load]);

  if (error) {
    return (
      <main className="center-page">
        <h1 className="display hero-verdict">No entry.</h1>
        <p className="notice muted">{error}</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="center-page">
        <p className="notice muted">Reading the room…</p>
      </main>
    );
  }

  const { rooms, playersNow, lifetime, server, recentTelemetry } = data;
  const slow = recentTelemetry.filter((r) => r.worstFrameMs > 100);

  return (
    <main className="admin">
      <header className="briefing-plate">
        <span className="briefing-plate-name">Back Office</span>
        <span className="briefing-plate-sub">refreshes every {REFRESH_MS / 1000}s</span>
      </header>

      <section className="admin-grid">
        <Figure label="Playing now" value={playersNow} note={`${rooms.length} rooms open`} />
        <Figure label="People ever" value={lifetime.devices} note={`${lifetime.seatsTaken} seats taken`} />
        <Figure label="Peak at once" value={lifetime.peakConcurrentPlayers} />
        <Figure
          label="Matches"
          value={lifetime.matchesCreated}
          note={`${lifetime.matchesFinished} finished`}
        />
        <Figure label="Rounds played" value={lifetime.roundsPlayed} />
        <Figure label="Liquidations" value={lifetime.liquidations} />
      </section>

      <section className="panel stack">
        <div className="panel-head">
          <h2 className="display pane-title">Live rooms</h2>
        </div>
        {rooms.length === 0 ? (
          <p className="notice muted">Nobody is playing.</p>
        ) : (
          <ul className="admin-rooms">
            {rooms.map((room) => (
              <li key={room.code}>
                <span className="mono scream">{room.code}</span>
                <span>{room.players} players</span>
                <span className="eyebrow">{room.phase}</span>
                <span className="mono muted">
                  round {room.round}/{room.totalRounds}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel stack">
        <div className="panel-head">
          <h2 className="display pane-title">How it is running</h2>
        </div>
        {recentTelemetry.length === 0 ? (
          <p className="notice muted">No reports yet. They arrive while a round is live.</p>
        ) : (
          <>
            {slow.length > 0 && (
              <p className="notice">
                <b className="dump">{slow.length}</b> of {recentTelemetry.length} recent reports
                saw a frame over 100ms.
              </p>
            )}
            <ul className="admin-rooms">
              {recentTelemetry
                .slice()
                .reverse()
                .slice(0, 12)
                .map((r) => (
                  <li key={`${r.atEpochMillis}-${r.matchCode}`}>
                    <span className="mono scream">{r.matchCode || "—"}</span>
                    <span className="eyebrow">
                      {r.platform} · {r.viewportWidth}px @{r.dpr}x
                    </span>
                    <span className="mono">
                      {r.medianFrameMs.toFixed(1)}ms median of {r.refreshMs.toFixed(1)}ms
                    </span>
                    <span className={`mono ${r.worstFrameMs > 100 ? "dump" : "muted"}`}>
                      worst {r.worstFrameMs.toFixed(0)}ms · {r.longFrames} hitches ·{" "}
                      {r.points} pts
                    </span>
                  </li>
                ))}
            </ul>
          </>
        )}
      </section>

      <p className="footnote muted">
        Up {duration(server.uptimeMillis)} · heap {server.heapUsedMb}/{server.heapMaxMb}MB ·{" "}
        {server.threads} threads · counting since{" "}
        {new Date(lifetime.firstSeenEpochMillis).toLocaleDateString()}
      </p>
    </main>
  );
}
