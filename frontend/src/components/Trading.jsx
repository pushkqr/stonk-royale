import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  TrendingUp,
  FileText,
  Trophy,
  MessageSquare,
  Zap,
} from "lucide-react";
import { useMatch } from "../state/MatchProvider";
import { sound } from "../lib/sound";
import { haptic } from "../lib/haptic";
import { telemetry } from "../lib/telemetry";
import { useCountdown } from "../lib/useCountdown";
import { clock, money } from "../lib/format";
import { evaluateCrossCheck } from "../lib/regime";
import { minLeverageFor } from "../lib/matchSettings";
import { unrealisedPnl } from "../lib/pnl";
import { getLivePrice } from "../state/livePrice";
import PriceChart from "./PriceChart";
import Dossier from "./Dossier";
import Standings from "./Standings";
import TradeDeck from "./TradeDeck";
import Wire from "./Wire";
import LiveRank from "./LiveRank";
import LiveFloorPrice from "./LiveFloorPrice";
import LiveRoundScore from "./LiveRoundScore";

export default function Trading() {
  const {
    phase,
    board,
    feed,
    me,
    session,
    lobby,
    rumor,
    open,
    close,
    say,
    serverNow,
    suspects,
  } = useMatch();
  const left = useCountdown(phase?.endsAtMillis, serverNow);

  // Sets the chart's opening window, before enough of the round has elapsed to fill it.
  const roundMillis = (lobby?.roundSeconds ?? 90) * 1000;
  const startPrice = phase?.asset?.startPrice ?? 0;
  const urgent = left > 0 && left <= 10_000;

  /*
   * Declared up here because three effects below filter the feed by it.
   *
   * They have to. Room keys the phase wrapper on the phase name, so this whole screen
   * remounts when a round opens and every `seen…` ref below resets to zero — while `feed`
   * is match-wide and survives. Without the filter, the first pass of those effects finds
   * the previous round's liquidation still sitting in the feed, reads its id as newer than
   * zero, and replays the flash, the REKT floater and the haptic on a player who has not
   * traded yet this round.
   */
  const roundIndex = phase?.roundIndex ?? 0;

  // A latecomer holds a seat but no stack: the round was dealt before they arrived.
  const waiting = !!me && !me.inRound;

  // Only measured while a round is live, which is the only time the chart is animating and
  // the only time a stutter costs anybody anything.
  useEffect(() => {
    telemetry.start(session.code);
    return () => telemetry.stop();
  }, [session.code]);

  // Dynamic Web Audio background tension generator
  const isUrgentClimax = left > 0 && left <= 15_000;
  useEffect(() => {
    sound.bgm.start(isUrgentClimax ? "urgent" : "normal");
    return () => sound.bgm.stop();
  }, [isUrgentClimax]);

  // One tick per second over the closing ten, not one per render.
  const lastTick = useRef(null);
  useEffect(() => {
    if (!urgent) return;
    const second = Math.ceil(left / 1000);
    if (lastTick.current !== second) {
      lastTick.current = second;
      sound.tick(second);
      if (second <= 3 && second > 0) {
        haptic.tick();
      }
    }
  }, [left, urgent]);

  // Losing your margin is the loudest thing that happens to you, and until now it was one
  // grey line in a busy feed. Keyed remount is what replays the flash on a second blowup.
  const [jolt, setJolt] = useState(0);
  const seenJolt = useRef(0);
  const [roomLiq, setRoomLiq] = useState(0);
  const seenRoomLiq = useRef(0);

  useEffect(() => {
    const liquidations = feed.filter((f) => f.kind === "LIQUIDATION" && f.round === roundIndex);
    const latest = liquidations.at(-1);
    if (!latest) return;

    if (latest.playerId === session.playerId && latest.id > seenJolt.current) {
      seenJolt.current = latest.id;
      setJolt((n) => n + 1);
    } else if (latest.playerId !== session.playerId && latest.id > seenRoomLiq.current) {
      seenRoomLiq.current = latest.id;
      setRoomLiq((n) => n + 1);
    }
  }, [feed, session.playerId, roundIndex]);

  useEffect(() => {
    if (jolt > 0) {
      haptic.liquidate();
    }
  }, [jolt]);

  const [surge, setSurge] = useState(null);
  const seenSurge = useRef(0);
  useEffect(() => {
    const flows = feed.filter((f) => f.kind === "FLOW" && f.round === roundIndex);
    const latest = flows.at(-1);
    if (latest && latest.id > seenSurge.current) {
      seenSurge.current = latest.id;
      const isBuying = latest.text?.includes("PILING IN");
      setSurge(isBuying ? "pump" : "dump");
      const timer = setTimeout(() => setSurge(null), 1800);
      return () => clearTimeout(timer);
    }
  }, [feed, roundIndex]);

  // Built here rather than inside Wire so Wire can stay memoised — see the note on it.
  // Keyed off the lobby, not the board: both carry the avatar, but the board is rebroadcast
  // twice a second and the lobby only when the roster or somebody's pick actually changes.
  const avatars = useMemo(
    () => new Map((lobby?.players ?? []).map((p) => [p.playerId, p])),
    [lobby],
  );

  const { latestNews, crossCheckStatus } = useMemo(() => {
    const news = feed.filter(
      (f) => f.kind === "NEWS" && f.round === phase?.roundIndex
    );
    return {
      latestNews: news.length > 0 ? news[news.length - 1] : null,
      crossCheckStatus: evaluateCrossCheck(
        rumor?.claimedRegime,
        news.map((n) => n.text)
      ),
    };
  }, [feed, phase?.roundIndex, rumor?.claimedRegime]);

  const lastNewsIdRef = useRef(null);
  useEffect(() => {
    if (latestNews && latestNews.id !== lastNewsIdRef.current) {
      lastNewsIdRef.current = latestNews.id;
      sound.news();
    }
  }, [latestNews]);

  const [mobileTab, setMobileTab] = useState("trade");
  const [lastSeenFeedLen, setLastSeenFeedLen] = useState(feed?.length ?? 0);
  const hasUnreadWire = mobileTab !== "wire" && (feed?.length ?? 0) > lastSeenFeedLen;

  const [floaters, setFloaters] = useState([]);
  const [liquidations, setLiquidations] = useState([]);

  const addFloater = useCallback((floater) => {
    const id = Date.now() + Math.random();
    setFloaters((prev) => [...prev, { ...floater, id }]);
    setTimeout(() => {
      setFloaters((prev) => prev.filter((f) => f.id !== id));
    }, 1500);
  }, []);

  const prevRoundRef = useRef(roundIndex);
  if (roundIndex !== prevRoundRef.current) {
    prevRoundRef.current = roundIndex;
    setLiquidations([]);
    setFloaters([]);
  }

  const seenLiqMapRef = useRef(new Set());
  useEffect(() => {
    seenLiqMapRef.current.clear();
  }, [roundIndex]);

  useEffect(() => {
    // Only track liquidations that occurred in the CURRENT round
    const liqEvents = feed.filter((f) => f.kind === "LIQUIDATION" && f.round === roundIndex);
    if (liqEvents.length === 0) return;

    let hasNew = false;
    const newMarkers = [];
    const currentPrice = getLivePrice() || startPrice;
    const roundElapsed = left > 0 ? Math.max(0, roundMillis - left) : 0;

    liqEvents.forEach((ev) => {
      if (!seenLiqMapRef.current.has(ev.id)) {
        seenLiqMapRef.current.add(ev.id);
        hasNew = true;
        newMarkers.push({
          id: ev.id,
          nickname: ev.nickname || (ev.playerId === session.playerId ? me?.nickname : "Trader"),
          isMine: ev.playerId === session.playerId,
          t: roundElapsed,
          p: currentPrice,
        });
      }
    });

    if (hasNew) {
      setLiquidations((prev) => [...prev, ...newMarkers]);
    }
  }, [feed, left, roundMillis, roundIndex, session.playerId, startPrice, me?.nickname]);

  const prevJoltRef = useRef(0);
  useEffect(() => {
    if (jolt > prevJoltRef.current) {
      addFloater({
        text: "💥 REKT",
        subtext: "-100% MARGIN CALL",
        tone: "rekt",
      });
    }
    prevJoltRef.current = jolt;
  }, [jolt, addFloater]);

  const handleClosePosition = useCallback((pos, closePrice) => {
    // Publish first: the floater below is visual feedback and has no business sitting
    // between the click and the socket.
    close();

    if (pos) {
      const price = closePrice || getLivePrice() || startPrice;
      const realized = unrealisedPnl(pos, price);
      const margin = pos.margin || 1;
      const pnlPct = ((realized / margin) * 100).toFixed(1);
      const isProfit = realized >= 0;

      addFloater({
        text: `${isProfit ? "+" : ""}${money(realized)}`,
        subtext: `${isProfit ? "+" : ""}${pnlPct}%`,
        tone: isProfit ? "pump" : "dump",
      });
    }
  }, [close, addFloater, startPrice]);

  return (
    <div className={`table tab-${mobileTab}`}>
      <header className="strip">
        <div className="strip-round">
          <span className="eyebrow">
            Round {(phase?.roundIndex ?? 0) + 1}/{phase?.totalRounds ?? 5}
          </span>
          <span className="display strip-ticker">${phase?.asset?.ticker}</span>
        </div>

        <div className={`strip-clock display ${urgent ? "is-urgent" : ""}`}>{clock(left)}</div>

        <LiveRank rows={board} meId={session.playerId} />

        <LiveRoundScore
          me={me}
          startingCash={lobby?.startingCash}
          startPrice={startPrice}
        />
      </header>

      <div className="left-rail">
        <Standings rows={board} meId={session.playerId} suspects={suspects} />

        <Dossier
          rumor={rumor}
          truthfulTips={phase?.truthfulTips}
          feed={feed}
          roundIndex={phase?.roundIndex}
          impactMultiplier={lobby?.marketImpactMultiplier ?? lobby?.impact?.multiplier ?? 1}
        />
      </div>

      <section className={`panel stack floor ${surge ? `is-surging-${surge}` : ""}`}>
        <LiveFloorPrice startPrice={startPrice} />

        <div className="floor-intel-hud">
          <div className="intel-hud-top">
            {/* Only the tip stays. The bias badge and the truthful count that used to flank
                it are both on the Intel tab already, and rendered better there — the rumour
                card prints the same bias label with a primer explaining what the regime
                means. On desktop, where the rail and the floor are both on screen, they
                were being shown twice at once. The whale badge moved to the same place; it
                is a lobby setting that cannot change mid-round, so it was never live
                information. */}
            {/* A tag, not a card. This screen has had four passes to get its vertical
                budget under control and has none to spare — but a rule that is on for the
                whole round has to be visible during it. */}
            {lobby?.modifier && lobby.modifier !== "NONE" && (
              <span className="tag tag-scream" title={lobby.modifierBlurb}>
                {lobby.modifierLabel}
              </span>
            )}
            <span className="intel-pill">
              {rumor?.text || "No active intel"}
            </span>
          </div>
          {/* A stamped word rather than an icon. Five lucide glyphs in five tones read as a
              dashboard alert, which is the one thing this screen is not — and the verdict
              already has a name, so printing it says more than a symbol did. The stamp
              carries the tone and the sentence stays on paper white, which is both louder
              and easier to read than a whole tinted line. */}
          {crossCheckStatus && (
            <p className={`intel-cross-check tone-${crossCheckStatus.tone}`}>
              <span className="cross-check-stamp">{crossCheckStatus.status}</span>
              <span className="cross-check-text">{crossCheckStatus.text}</span>
            </p>
          )}
        </div>

        {latestNews && (
          <div className="in-chart-news-banner" role="alert">
            <span className="news-badge">
              <Zap size={12} strokeWidth={2.5} /> BREAKING NEWS
            </span>
            <span className="news-text">{latestNews.text}</span>
          </div>
        )}

        <PriceChart
          roundMillis={roundMillis}
          position={me?.position}
          startPrice={startPrice}
          liquidations={liquidations}
          floaters={floaters}
          volatility={lobby?.volatilityMultiplier ?? 1}
          impactMultiplier={lobby?.marketImpactMultiplier ?? lobby?.impact?.multiplier ?? 1}
        />

        {waiting && (
          <p className="notice muted" role="status">
            You're in from the next round — this one was dealt before you arrived.
          </p>
        )}

        <TradeDeck
          minLeverage={minLeverageFor(lobby?.modifier)}
          me={me}
          onOpen={open}
          onClose={handleClosePosition}
          disabled={!me || waiting}
          impact={lobby?.impact}
        />
      </section>

      <Wire feed={feed} onSay={say} disabled={false} suspects={suspects} avatars={avatars}
        roundIndex={phase?.roundIndex} />

      {/* A tab list rather than a nav landmark: these four switch which panel of this one
          screen is showing, they do not navigate anywhere. Marked up only this far on
          purpose — the panels they switch between are the same elements the desktop layout
          renders all three of at once, with no dock in sight, so calling them tabpanels
          would assert a relationship that is false at every width above 900px. The tabs
          themselves are safe: the dock is display:none on desktop, so the whole widget
          drops out of the accessibility tree there rather than lying about itself. */}
      <div className="mobile-dock" role="tablist" aria-label="Mobile Navigation">
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === "trade"}
          className={`mobile-dock-btn ${mobileTab === "trade" ? "is-active" : ""}`}
          onClick={() => {
            setMobileTab("trade");
            haptic.tap();
          }}
        >
          <span className="dock-icon"><TrendingUp size={18} strokeWidth={2.4} /></span>
          <span>Trade</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === "dossier"}
          className={`mobile-dock-btn ${mobileTab === "dossier" ? "is-active" : ""}`}
          onClick={() => {
            setMobileTab("dossier");
            haptic.tap();
          }}
        >
          <span className="dock-icon"><FileText size={18} strokeWidth={2.4} /></span>
          <span>Intel</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === "standings"}
          className={`mobile-dock-btn ${mobileTab === "standings" ? "is-active" : ""}`}
          onClick={() => {
            setMobileTab("standings");
            haptic.tap();
          }}
        >
          <span className="dock-icon"><Trophy size={18} strokeWidth={2.4} /></span>
          <span>Ranks</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === "wire"}
          className={`mobile-dock-btn ${mobileTab === "wire" ? "is-active" : ""}`}
          onClick={() => {
            setMobileTab("wire");
            setLastSeenFeedLen(feed?.length ?? 0);
            haptic.tap();
          }}
        >
          <span className="dock-icon" style={{ position: "relative" }}>
            <MessageSquare size={18} strokeWidth={2.4} />
            {hasUnreadWire && <span className="dock-badge-dot" />}
            {hasUnreadWire && <span className="sr-only">unread messages</span>}
          </span>
          <span>Wire</span>
        </button>
      </div>

      {/* A full-viewport red vignette that snaps in on liquidation and shakes out. One class:
          the shake used to live on a second one, where it was the same animation property at
          the same specificity and simply overwrote the first. */}
      {jolt > 0 && (
        <div
          key={jolt}
          className="liquidation-flash"
          aria-hidden="true"
        />
      )}
      {roomLiq > 0 && (
        <div
          key={`room-${roomLiq}`}
          className="liquidation-room-ping"
          style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 998 }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
