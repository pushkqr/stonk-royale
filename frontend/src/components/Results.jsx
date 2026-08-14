import { useMatch } from "../state/MatchProvider";
import { pct, toneOf } from "../lib/format";
import CountUp from "./CountUp";
import Ledger from "./Ledger";

export default function Results() {
  const { standings, session, rematch, lobby, settled, quit } = useMatch();
  const winner = standings[0];
  const iWon = winner?.playerId === session.playerId;
  // Bots fill the practice room, so a headcount no longer tells you whether anyone was
  // actually playing against you.
  const solo = standings.filter((row) => !row.bot).length < 2;
  const myResult = settled?.results.find((r) => r.playerId === session.playerId);

  return (
    <main className="center-page">
      <header className="hero">
        <h1 className="display hero-verdict">
          {solo
            ? "That's practice done."
            : iWon
              ? "You took it."
              : `${winner?.nickname ?? "Nobody"} took it.`}
        </h1>
      </header>

      <ol className="panel sheet podium">
        {standings.map((row) => (
          <li
            key={row.playerId}
            className={`podium-row ${row.playerId === session.playerId ? "is-me" : ""}`}
          >
            <span className="podium-rank display">{row.rank}</span>
            <span className="podium-name">
              {row.nickname}
              {row.bot && <span className="tag tag-bot">BOT</span>}
            </span>
            <span className="podium-scores">
              {/* The one number worth counting to: it is final, and everyone is looking. */}
              <CountUp
                value={row.totalScore}
                format={pct}
                className={`display podium-total ${toneOf(row.totalScore)}`}
              />
              <span className="eyebrow">best round {pct(row.bestRound)}</span>
            </span>
          </li>
        ))}
      </ol>

      {/* The last round has no intermission behind it, so this is the only place its lies
          ever surface — and it is the round people lie hardest in. Same reason this is also
          the only place that round's tip-lesson sentence runs: Intermission never gets a
          turn to show it. */}
      {settled && myResult && (
        <p className="tip-lesson mono" role="status">
          Your tip said <strong>{myResult.rumorClaimed}</strong>. The round was{" "}
          <strong>{settled.regime}</strong>.{" "}
          {myResult.rumorWasTrue ? "Trusting it was the right call." : "Trusting it cost you."}
        </p>
      )}

      <Ledger results={settled?.results} meId={session.playerId} />

      {/* The room stays open, so the group never has to regroup from the home page. */}
      {session.host ? (
        <div className="stack sheet" style={{ gap: "0.5rem" }}>
          <button className="btn btn-big btn-scream" onClick={() => rematch(false)}>
            {solo ? "Play with friends" : "Play again"}
          </button>
          {!solo && (
            <button className="btn" onClick={() => rematch(true)}>
              Rerun the same market
            </button>
          )}
          <p className="footnote muted">
            Everyone keeps their seat, and anyone new can join before you start.
          </p>
        </div>
      ) : (
        <p className="notice muted">Waiting for the host to start another one.</p>
      )}

      <button className="link-btn muted" onClick={quit}>
        Leave
      </button>

      {lobby?.code && (
        <p className="footnote muted">
          Room <b className="room-code mono scream">{lobby.code}</b> is still open.
        </p>
      )}
    </main>
  );
}
