import { Crown, Heart } from "lucide-react";
import { useMatch } from "../state/MatchProvider";
import { pct, toneOf } from "../lib/format";
import CountUp from "./CountUp";
import Ledger from "./Ledger";
import Accolades from "./Accolades";
import Confetti from "./Confetti";
import Avatar from "./Avatar";
import { avatarOf, getMood } from "../lib/avatars";

export default function Results() {
  const { standings, session, rematch, lobby, settled, roundHistory, quit, feed, suspects, matchLiquidations } = useMatch();
  const winner = standings[0];
  const iWon = winner?.playerId === session.playerId;
  // Bots fill the practice room, so a headcount no longer tells you whether anyone was
  // actually playing against you.
  const solo = standings.filter((row) => !row.bot).length < 2;
  const myResult = settled?.results.find((r) => r.playerId === session.playerId);
  const mySeat = lobby?.players?.find((player) => player.playerId === session.playerId);
  const isHost = mySeat?.host ?? session.host;

  return (
    <main className="center-page">
      {iWon && <Confetti />}
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
            <span className="podium-rank display">
              {row.rank === 1 && <Crown size={14} strokeWidth={2.6} className="podium-crown-icon" />}
              {row.rank}
            </span>
            <span className="podium-name">
              <span className="podium-player-wrap">
                <Avatar
                  archetypeId={avatarOf(row)}
                  mood={getMood({ isWinner: row.rank === 1, pnl: row.totalScore })}
                  size={32}
                />
                <span>{row.nickname}</span>
              </span>
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

      <Accolades standings={standings} settled={settled} feed={feed}
        matchLiquidations={matchLiquidations} roundHistory={roundHistory} />

      {/* The last round has no intermission behind it, so this is the only place its lies
          ever surface — and it is the round people lie hardest in.

          Above the tip-lesson below it, for the same reason it leads the round reveal: the
          podium, the accolades and this table are what the room reads out to each other, and
          a sentence about one player's own tip in the middle of them breaks that run. */}
      <Ledger results={settled?.results} meId={session.playerId} suspects={suspects} />

      {/* The only place this round's tip-lesson sentence runs: Intermission never gets a
          turn to show it. */}
      {settled && myResult && (
        <p className="tip-lesson mono" role="status">
          Your tip said <strong>{myResult.rumorClaimed}</strong>. The round was{" "}
          <strong>{settled.regime}</strong>.{" "}
          {myResult.rumorWasTrue ? "Trusting it was the right call." : "Trusting it cost you."}
        </p>
      )}

      {/* The room stays open, so the group never has to regroup from the home page. */}
      {isHost ? (
        <div className="stack sheet" style={{ gap: "0.5rem" }}>
          <button className="btn btn-big btn-scream" onClick={() => rematch(false)}>
            {solo ? "Play with friends" : "Play again"}
          </button>
          {!solo && (
            <button className="btn" onClick={() => rematch(true)}>
              Rerun the same market
            </button>
          )}
          <button className="btn" onClick={quit}>
            Leave Room
          </button>
          <p className="footnote muted">
            Everyone keeps their seat, and anyone new can join before you start.
          </p>
        </div>
      ) : (
        <div className="stack sheet" style={{ gap: "0.5rem" }}>
          <p className="notice muted">Waiting for the host to start another one.</p>
          <button className="btn" onClick={quit}>
            Leave Room
          </button>
        </div>
      )}

      {lobby?.code && (
        <p className="footnote muted">
          Room <b className="room-code mono scream">{lobby.code}</b> is still open.
        </p>
      )}

      <footer className="footer-credit muted">
        <p className="footnote-disclaimer">
          Fake tickers, fake money, real lying. Nothing here is investment advice.
        </p>
        <p className="footnote-watermark">
          Made with <Heart size={11} fill="var(--dump)" stroke="var(--dump)" className="credit-heart" aria-hidden="true" /> by pushkqr
        </p>
      </footer>
    </main>
  );
}
