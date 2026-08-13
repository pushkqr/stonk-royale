import { useMatch } from "../state/MatchProvider";
import { pct, toneOf } from "../lib/format";
import Ledger from "./Ledger";

export default function Results() {
  const { standings, session, rematch, lobby, settled } = useMatch();
  const winner = standings[0];
  const iWon = winner?.playerId === session.playerId;
  const solo = standings.length < 2;

  return (
    <main className="center-page">
      <header className="hero">
        <p className="eyebrow">That's the match</p>
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
            <span className="podium-name">{row.nickname}</span>
            <span className="podium-scores">
              <span className={`display podium-total ${toneOf(row.totalScore)}`}>
                {pct(row.totalScore)}
              </span>
              <span className="eyebrow">best round {pct(row.bestRound)}</span>
            </span>
          </li>
        ))}
      </ol>

      {/* The last round has no intermission behind it, so this is the only place its lies
          ever surface — and it is the round people lie hardest in. */}
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

      <a className="link-btn muted" href="/">
        Leave
      </a>

      {lobby?.code && (
        <p className="footnote muted">
          Room <b className="room-code mono scream">{lobby.code}</b> is still open.
        </p>
      )}
    </main>
  );
}
