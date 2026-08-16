import { useEffect, useRef, useState } from "react";
import { useMatch } from "../state/MatchProvider";
import { sound } from "../lib/sound";
import { useCountdown } from "../lib/useCountdown";
import { clock, pct, toneOf } from "../lib/format";
import { REGIME_VERDICT, tipCountLine } from "../lib/regime";
import RumorCard from "./RumorCard";
import Ledger from "./Ledger";
import Wire from "./Wire";

const HOLD_ON_REVEAL_MS = 10000;

export default function Intermission() {
  const { phase, rumor, lastRumor, settled, standings, session, serverNow, feed, say, suspects } =
    useMatch();
  const left = useCountdown(phase?.endsAtMillis, serverNow);

  // Two beats: what just happened to you, then what's coming next. Without the pause the
  // stamp would be replaced by the next card before anyone read it.
  const [beat, setBeat] = useState(lastRumor ? "reveal" : "deal");

  const timerRef = useRef(null);

  useEffect(() => {
    if (!lastRumor) {
      setBeat("deal");
      return;
    }
    setBeat("reveal");
    sound.stamp(lastRumor.wasTrue);
    // Never spend the whole intermission looking backwards: a host can set it as low as a
    // second, and the next round's tip is the half that players still have to act on.
    const remaining = (phase?.endsAtMillis ?? 0) - Date.now();
    const hold = Math.max(1000, Math.min(HOLD_ON_REVEAL_MS, remaining * 0.4));
    timerRef.current = setTimeout(() => setBeat("deal"), hold);
    return () => clearTimeout(timerRef.current);
  }, [lastRumor, phase?.endsAtMillis]);

  const switchBeat = (nextBeat) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setBeat(nextBeat);
  };

  const myResult = settled?.results.find((r) => r.playerId === session.playerId);

  return (
    <main className="center-page">
      {lastRumor && settled && (
        <div className="intermission-tabs">
          <button
            type="button"
            className={`btn-tab ${beat === "reveal" ? "is-active" : ""}`}
            onClick={() => switchBeat("reveal")}
          >
            Round {settled.roundIndex + 1} Results
          </button>
          <button
            type="button"
            className={`btn-tab ${beat === "deal" ? "is-active" : ""}`}
            onClick={() => switchBeat("deal")}
          >
            Round {(phase?.roundIndex ?? 0) + 1} Intel (${phase?.asset?.ticker})
          </button>
        </div>
      )}
      {beat === "reveal" && settled ? (
        <>
          <header className="hero">
            <p className="eyebrow">Round {settled.roundIndex + 1} is done</p>
            <h1 className="display hero-verdict">{REGIME_VERDICT[settled.regime]}</h1>
            {myResult && (
              <p className={`display hero-score ${toneOf(myResult.roundScore)}`}>
                {pct(myResult.roundScore)}
              </p>
            )}
          </header>

          <RumorCard text={lastRumor.text} stamp={lastRumor.wasTrue ? "TRUE" : "LIE"} />

          {/* The three facts above are already on screen — the verdict, the score, the
              stamp — but as unrelated elements. Stated as one sentence they become the
              answer to "was my tip worth listening to", which is the thing that has to
              accumulate over five rounds for anyone to start using it. */}
          {myResult && (
            <p className="tip-lesson mono" role="status">
              Your tip said <strong>{myResult.rumorClaimed}</strong>. The round was{" "}
              <strong>{settled.regime}</strong>.{" "}
              {myResult.rumorWasTrue
                ? "Trusting it was the right call."
                : "Trusting it cost you."}
            </p>
          )}

          {/* The count told the room how many tips were real. This is where it gets settled. */}
          <Ledger results={settled.results} meId={session.playerId} suspects={suspects} />
        </>
      ) : (
        <>
          <header className="hero">
            <p className="eyebrow">
              Round {(phase?.roundIndex ?? 0) + 1} of {phase?.totalRounds ?? 5} · opens in{" "}
              {clock(left)}
            </p>
            <h1 className="display hero-ticker">${phase?.asset?.ticker}</h1>
            <p className="hero-blurb">{phase?.asset?.blurb}</p>
          </header>

          <RumorCard text={rumor?.text} claimedRegime={rumor?.claimedRegime} />

          {/* Withheld below two players, where the count would name its own holder. */}
          {phase?.truthfulTips != null && (
            <p className="tip-count mono" role="status">
              {tipCountLine(phase.truthfulTips)}
            </p>
          )}

          {standings.length > 0 && (
            <ol className="mini-standings">
              {standings.map((row) => (
                <li key={row.playerId} className={row.playerId === session.playerId ? "is-me" : ""}>
                  <span className="mini-rank display">{row.rank}</span>
                  <span className="mini-name">{row.nickname}</span>
                  <span className={`mono ${toneOf(row.totalScore)}`}>{pct(row.totalScore)}</span>
                </li>
              ))}
            </ol>
          )}

          <p className="footnote muted">Talk it over. Nobody has to tell the truth.</p>
        </>
      )}

      {/* Outside the beat switch on purpose: it stays mounted across the reveal, so nobody
          loses a half-typed accusation the moment the ledger names them. */}
      <Wire feed={feed} onSay={say} disabled={false} suspects={suspects} className="wire-talk" />
    </main>
  );
}
