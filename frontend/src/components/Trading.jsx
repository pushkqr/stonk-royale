import { useMatch } from "../state/MatchProvider";
import { useCountdown } from "../lib/useCountdown";
import { clock, pct, price as fmtPrice, toneOf } from "../lib/format";
import PriceChart from "./PriceChart";
import Standings from "./Standings";
import TradeDeck from "./TradeDeck";
import Wire from "./Wire";

export default function Trading() {
  const { phase, tick, series, board, feed, me, session, lobby, open, close, say, serverNow } =
    useMatch();
  const left = useCountdown(phase?.endsAtMillis, serverNow);

  // The chart's x-axis spans the whole round, so the empty space to the right of the
  // line is time remaining. That has to track the host's configured round length.
  const roundMillis = (lobby?.roundSeconds ?? 90) * 1000;

  const startPrice = phase?.asset?.startPrice ?? 0;
  const live = tick?.price ?? startPrice;
  const move = startPrice ? ((live - startPrice) / startPrice) * 100 : 0;
  const urgent = left > 0 && left <= 10_000;

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
          <span className={`display strip-score ${toneOf(me?.roundScore ?? 0)}`}>
            {pct(me?.roundScore ?? 0)}
          </span>
        </div>
      </header>

      <Standings rows={board} meId={session.playerId} />

      <section className="panel stack floor">
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

        <TradeDeck me={me} livePrice={live} onOpen={open} onClose={close} disabled={!me} />
      </section>

      <Wire feed={feed} onSay={say} disabled={false} />
    </div>
  );
}
