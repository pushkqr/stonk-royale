import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  TrendingUp,
  FileText,
  Trophy,
  MessageSquare,
  Flame,
  Zap,
  CheckCircle,
  AlertTriangle,
  Scale,
  Target,
  ShieldAlert,
} from "lucide-react";
import { useMatch } from "../state/MatchProvider";
import { sound } from "../lib/sound";
import { haptic } from "../lib/haptic";
import { telemetry } from "../lib/telemetry";
import { useCountdown } from "../lib/useCountdown";
import { clock, money } from "../lib/format";
import { REGIME_BIAS, evaluateCrossCheck } from "../lib/regime";
import { unrealisedPnl } from "../lib/pnl";
import { getLivePrice } from "../state/livePrice";
import PriceChart from "./PriceChart";
import Dossier from "./Dossier";
import Standings from "./Standings";
import TradeDeck from "./TradeDeck";
import Wire from "./Wire";
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
    const liquidations = feed.filter((f) => f.kind === "LIQUIDATION");
    const latest = liquidations.at(-1);
    if (!latest) return;

    if (latest.playerId === session.playerId && latest.id > seenJolt.current) {
      seenJolt.current = latest.id;
      setJolt((n) => n + 1);
    } else if (latest.playerId !== session.playerId && latest.id > seenRoomLiq.current) {
      seenRoomLiq.current = latest.id;
      setRoomLiq((n) => n + 1);
    }
  }, [feed, session.playerId]);

  useEffect(() => {
    if (jolt > 0) {
      haptic.liquidate();
    }
  }, [jolt]);

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

  const roundIndex = phase?.roundIndex;
  const prevRoundRef = useRef(roundIndex);
  if (roundIndex !== prevRoundRef.current) {
    prevRoundRef.current = roundIndex;
    setLiquidations([]);
    setFloaters([]);
  }

  const seenLiqMapRef = useRef(new Set());
  useEffect(() => {
    const liqEvents = feed.filter((f) => f.kind === "LIQUIDATION");
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
  }, [feed, left, roundMillis, session.playerId, startPrice, me?.nickname]);

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
    close();
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
        />
      </div>

      <section className={`panel stack floor ${surge ? `is-surging-${surge}` : ""}`}>
        <LiveFloorPrice startPrice={startPrice} />

        <div className="floor-intel-hud">
          <div className="intel-hud-top">
            {(lobby?.marketImpactMultiplier ?? lobby?.impact?.multiplier ?? 1.0) >= 2.0 && (
              <span className="intel-whale-badge" title="High PvP Market Impact Active">
                <Flame size={12} strokeWidth={2.4} /> WHALE IMPACT ({(lobby?.marketImpactMultiplier ?? lobby?.impact?.multiplier ?? 1.0).toFixed(1)}x)
              </span>
            )}
            {rumor?.claimedRegime && REGIME_BIAS[rumor.claimedRegime] ? (
              <span className={`intel-bias-badge tone-${REGIME_BIAS[rumor.claimedRegime].tone}`}>
                {REGIME_BIAS[rumor.claimedRegime].label}
              </span>
            ) : (
              <span className="intel-bias-badge">INTEL</span>
            )}
            <span className="intel-pill">
              {rumor?.text || "No active intel"}
            </span>
            {phase?.truthfulTips != null && (
              <span className="intel-count mono">
                {phase.truthfulTips}/{phase.totalPlayers ?? (board?.length || 2)} Truthful
              </span>
            )}
          </div>
          {crossCheckStatus && (
            <div className={`intel-cross-check tone-${crossCheckStatus.tone}`}>
              <span className="cross-check-icon">
                {crossCheckStatus.status === "MATCHING" && <CheckCircle size={13} strokeWidth={2.4} />}
                {crossCheckStatus.status === "CONFLICTING" && <AlertTriangle size={13} strokeWidth={2.4} />}
                {crossCheckStatus.status === "MIXED" && <Scale size={13} strokeWidth={2.4} />}
                {crossCheckStatus.status === "CONFIRMED" && <Target size={13} strokeWidth={2.4} />}
                {crossCheckStatus.status === "EXPOSED" && <ShieldAlert size={13} strokeWidth={2.4} />}
              </span>
              <span className="cross-check-text">{crossCheckStatus.text}</span>
            </div>
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
        />

        {waiting && (
          <p className="notice muted" role="status">
            You're in from the next round — this one was dealt before you arrived.
          </p>
        )}

        <TradeDeck
          me={me}
          onOpen={open}
          onClose={handleClosePosition}
          disabled={!me || waiting}
          impact={lobby?.impact}
        />
      </section>

      <Wire feed={feed} onSay={say} disabled={false} suspects={suspects} />

      {/* Mobile Dock Navigation */}
      <nav className="mobile-dock" aria-label="Mobile Navigation">
        <button
          type="button"
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
          </span>
          <span>Wire</span>
        </button>
      </nav>

      {/* A full-viewport red frame that snaps in on liquidation and fades out with screen shake. */}
      {jolt > 0 && (
        <div
          key={jolt}
          className="liquidation-flash liquidation-flash-shake"
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
