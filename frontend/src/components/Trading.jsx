import { useEffect, useRef, useState } from "react";
import { useMatch, usePrice } from "../state/MatchProvider";
import { sound } from "../lib/sound";
import { telemetry } from "../lib/telemetry";
import { useCountdown } from "../lib/useCountdown";
import { clock, pct, price as fmtPrice, toneOf } from "../lib/format";
import { liveRoundScore } from "../lib/pnl";
import PriceChart from "./PriceChart";
import Dossier from "./Dossier";
import Standings from "./Standings";
import TradeDeck from "./TradeDeck";
import Wire from "./Wire";

export default function Trading() {
  const { phase, board, feed, me, session, lobby, rumor, open, close, say, serverNow } = useMatch();
  const { tick, series } = usePrice();
  const left = useCountdown(phase?.endsAtMillis, serverNow);

  // Sets the chart's opening window, before enough of the round has elapsed to fill it.
  const roundMillis = (lobby?.roundSeconds ?? 90) * 1000;

  const startPrice = phase?.asset?.startPrice ?? 0;
  const live = tick?.price ?? startPrice;
  const move = startPrice ? ((live - startPrice) / startPrice) * 100 : 0;
  const urgent = left > 0 && left <= 10_000;

  // Derived rather than read off the board, so it agrees with the chart and the deck. The
  // board's own roundScore is half a second old by the time it lands. A latecomer sitting
  // out the round has no stack to score against, hence the inRound guard.
  const myScore = me?.inRound ? liveRoundScore(me, live, lobby?.startingCash ?? 0) : 0;

  // A latecomer holds a seat but no stack: the round was dealt before they arrived.
  const waiting = !!me && !me.inRound;

  // Only measured while a round is live, which is the only time the chart is animating and
  // the only time a stutter costs anybody anything.
  useEffect(() => {
    telemetry.start(session.code);
    return () => telemetry.stop();
  }, [session.code]);

  // One tick per second over the closing ten, not one per render.
  const lastTick = useRef(null);
  useEffect(() => {
    if (!urgent) return;
    const second = Math.ceil(left / 1000);
    if (lastTick.current !== second) {
      lastTick.current = second;
      sound.tick(second);
    }
  }, [left, urgent]);

  // Losing your margin is the loudest thing that happens to you, and until now it was one
  // grey line in a busy feed. Keyed remount is what replays the flash on a second blowup.
  const [jolt, setJolt] = useState(0);
  const seenJolt = useRef(0);
  useEffect(() => {
    const mine = feed.filter((f) => f.kind === "LIQUIDATION" && f.playerId === session.playerId);
    const latest = mine.at(-1)?.id ?? 0;
    if (latest > seenJolt.current) {
      seenJolt.current = latest;
      setJolt((n) => n + 1);
    }
  }, [feed, session.playerId]);

  const [surge, setSurge] = useState(null);
  const seenSurge = useRef(0);
  useEffect(() => {
    const flows = feed.filter((f) => f.kind === "FLOW");
    const latest = flows.at(-1);
    if (latest && latest.id > seenSurge.current) {
      seenSurge.current = latest.id;
      const isBuying = latest.text?.includes("PILING IN");
      setSurge(isBuying ? "pump" : "dump");
      const timer = setTimeout(() => setSurge(null), 1800);
      return () => clearTimeout(timer);
    }
  }, [feed]);

  return (
    <div className="table">
      <header className="strip">
        <div className="strip-round">
          <span className="eyebrow">
            Round {(phase?.roundIndex ?? 0) + 1}/{phase?.totalRounds ?? 5}
          </span>
          <span className="display strip-ticker">${phase?.asset?.ticker}</span>
        </div>

        <div className={`strip-clock display ${urgent ? "is-urgent" : ""}`}>{clock(left)}</div>

        <div className="strip-me">
          <span className="eyebrow">This round</span>
          <span className={`display strip-score ${toneOf(myScore)}`}>
            {pct(myScore)}
          </span>
        </div>
      </header>

      <Standings rows={board} meId={session.playerId} />

      <Dossier
        rumor={rumor}
        truthfulTips={phase?.truthfulTips}
        feed={feed}
        roundIndex={phase?.roundIndex}
      />

      <section className={`panel stack floor ${surge ? `is-surging-${surge}` : ""}`}>
        <div className="floor-price">
          <span className={`display price-now ${move >= 0 ? "pump" : "dump"}`}>
            {fmtPrice(live)}
          </span>
          <span className={`mono price-move ${toneOf(move)}`}>{pct(move)}</span>
        </div>

        <PriceChart
          series={series}
          roundMillis={roundMillis}
          position={me?.position}
          startPrice={startPrice}
        />

        {waiting && (
          <p className="notice muted" role="status">
            You're in from the next round — this one was dealt before you arrived.
          </p>
        )}

        <TradeDeck
          me={me}
          onOpen={open}
          onClose={close}
          disabled={!me || waiting}
          impact={lobby?.impact}
        />
      </section>

      <Wire feed={feed} onSay={say} disabled={false} />

      {jolt > 0 && <div className="jolt" key={jolt} aria-hidden="true" />}
    </div>
  );
}
