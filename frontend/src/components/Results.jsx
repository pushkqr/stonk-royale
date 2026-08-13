import { useMatch } from "../state/MatchProvider";
import { pct, toneOf } from "../lib/format";

export default function Results() {
  const { standings, session } = useMatch();
  const winner = standings[0];
  const iWon = winner?.playerId === session.playerId;

  return (
    <main className="center-page">
      <header className="hero">
        <p className="eyebrow">That's the match</p>
        <h1 className="display hero-verdict">
          {iWon ? "You took it." : `${winner?.nickname ?? "Nobody"} took it.`}
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

      <a className="btn btn-big btn-scream" href="/">
        Play again
      </a>
    </main>
  );
}
