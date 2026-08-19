import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Client } from "@stomp/stompjs";
import { getLobby, socketUrl } from "../lib/api";
import { clearSeat } from "../lib/session";
import { isSeatExpired } from "../lib/stompError";
import { sound } from "../lib/sound";

import { setLivePrice } from "./livePrice";

const MatchContext = createContext(null);
const PriceContext = createContext(null);

// eslint-disable-next-line react-refresh/only-export-components
export const useMatch = () => useContext(MatchContext);

/**
 * The live price, kept apart from everything else because it moves ten times a second.
 * Only the trading screen reads it; anything else subscribing would repaint at that rate
 * for a number it never shows.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const usePrice = () => useContext(PriceContext);

const FEED_LIMIT = 60;

/**
 * Owns the socket and every piece of match state.
 *
 * Three things here are less obvious than they look:
 *
 * - The countdown runs on a server-clock offset, not the browser clock, which can be
 *   minutes out and would otherwise show the wrong time left.
 * - A settled round and the next round's rumour arrive milliseconds apart, so the card
 *   just played is copied into `lastRumor` before the new one lands. Without that the
 *   TRUE/LIE stamp would be overwritten before anyone saw it.
 * - Price sits in its own context. With it in the main one, every consumer re-rendered on
 *   every tick — the whole tree, ten times a second, including the corner tabs and the
 *   wire, none of which show a price.
 */
export function MatchProvider({ session, children }) {
  const [connected, setConnected] = useState(false);
  const [phase, setPhase] = useState(null);
  const [tick, setTick] = useState(null);
  const [board, setBoard] = useState([]);
  const [feed, setFeed] = useState([]);
  const [series, setSeries] = useState({ points: [], count: 0 });
  const [rumor, setRumor] = useState(null);
  const [lastRumor, setLastRumor] = useState(null);
  const [settled, setSettled] = useState(null);
  const [standings, setStandings] = useState([]);
  const [matchLiquidations, setMatchLiquidations] = useState({});
  const [lobby, setLobby] = useState(null);
  const [error, setError] = useState(null);
  const [readyState, setReadyState] = useState(null);
  const [suspects, setSuspects] = useState({});

  const clientRef = useRef(null);
  const offsetRef = useRef(0);
  const rumorRef = useRef(null);
  const roundRef = useRef(null);
  const settleRef = useRef(null);
  const feedId = useRef(0);
  const readyRef = useRef(0);

  const { code, playerId, token } = session;

  useEffect(() => {
    getLobby(code).then(setLobby).catch(() => {});
  }, [code]);

  useEffect(() => {
    const client = new Client({
      webSocketFactory: () => new WebSocket(socketUrl()),
      connectHeaders: { token },
      reconnectDelay: 3000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      debug: () => {},
    });

    const subscriptions = [];
    const on = (dest, fn) => {
      const sub = client.subscribe(dest, (m) => fn(JSON.parse(m.body)));
      subscriptions.push(sub);
      return sub;
    };
    const topic = (channel) => `/topic/match/${code}/${channel}`;

    client.onConnect = () => {
      while (subscriptions.length > 0) {
        try {
          subscriptions.pop().unsubscribe();
        } catch {
          // ignore
        }
      }

      setConnected(true);
      setError(null);

      on(topic("phase"), (next) => {
        offsetRef.current = next.serverTime - Date.now();
        setPhase(next);
        // Only a genuinely new round clears the chart. A resync re-sends the current
        // phase to everyone, which would otherwise wipe the round in progress.
        if (next.phase === "TRADING" && roundRef.current !== next.roundIndex) {
          roundRef.current = next.roundIndex;
          setSeries({ points: [], count: 0 });
          setTick(null);
          sound.roundStart();
        }
        // The final settle lands immediately before this, so its totals are the standings.
        if (next.phase === "FINISHED") {
          const results = settleRef.current?.results ?? [];
          const top = results.reduce((a, b) => (b.totalScore > a.totalScore ? b : a), results[0]);
          sound.finish(top?.playerId === playerId);
        }
        /*
          A rematch reopens the room, and everything below is scoped to the match that just
          ended. Leaving it in place meant the next match opened by replaying the old one:
          Intermission starts on its reveal beat whenever a lastRumor exists, so round one
          of the rematch showed the previous match's final card, verdict and ledger before
          dealing anything, over standings still holding the old totals.
        */
        if (next.phase === "LOBBY") {
          roundRef.current = null;
          rumorRef.current = null;
          settleRef.current = null;
          readyRef.current = 0;
          setSettled(null);
          setLastRumor(null);
          setRumor(null);
          setSeries({ points: [], count: 0 });
          setTick(null);
          setBoard([]);
          setFeed([]);
          setReadyState(null);
          setSuspects({});
        }
      });

      on(topic("price"), (next) => {
        setLivePrice(next.price);
        setTick(next);
        // Mutate the array in place and bump the count so React notices.
        //
        // Copying a growing array ten times a second allocates ~405,000 objects across a
        // single 90s round. Nothing else reads the old array snapshot, so the copies were
        // pure garbage churn — and on a 180Hz screen the GC pauses regularly swallowed
        // three or four frames in a row.
        setSeries((prev) => {
          prev.points[prev.count] = { t: next.elapsedMillis, p: next.price };
          return { points: prev.points, count: prev.count + 1 };
        });
      });

      on(topic("board"), setBoard);
      on(topic("standings"), setStandings);
      on(topic("lobby"), setLobby);
      on(topic("ready"), (next) => {
        // Only the climb. The count also lands on first sync and on a rematch reset,
        // neither of which is somebody pressing the button.
        if (next.ready > readyRef.current) {
          sound.ready(next.total ? next.ready / next.total : 0);
        }
        readyRef.current = next.ready;
        setReadyState(next);
      });

      on(topic("feed"), (item) => {
        if (item.kind === "LIQUIDATION" && item.playerId) {
          setMatchLiquidations((prev) => ({
            ...prev,
            [item.playerId]: (prev[item.playerId] || 0) + 1,
          }));
        }
        setFeed((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.kind === item.kind && last.text === item.text && last.playerId === item.playerId) {
            return prev;
          }
          feedId.current += 1;
          return [
            ...prev.slice(-FEED_LIMIT),
            { ...item, id: feedId.current, round: roundRef.current },
          ];
        });
        if (item.kind === "LIQUIDATION") sound.liquidation(item.playerId === playerId);
        else if (item.kind === "NEWS") sound.news();
        // Your own line needs no announcing — you just typed it.
        else if (item.kind === "CHAT" && item.playerId !== playerId) sound.chatter();
      });

      on(topic("settled"), (next) => {
        settleRef.current = next;
        setSettled(next);
        const mine = next.results.find((r) => r.playerId === playerId);
        sound.settle(mine?.roundScore ?? 0);
        if (rumorRef.current) {
          setLastRumor({ text: rumorRef.current, wasTrue: mine?.rumorWasTrue ?? false });
        }
      });

      on("/user/queue/rumor", (next) => {
        rumorRef.current = next.text;
        setRumor({ text: next.text, claimedRegime: next.claimedRegime });
        sound.deal();
      });

      on("/user/queue/error", (next) => setError(next.error));

      on("/user/queue/kicked", () => {
        // The host cleared this seat. The token is already dead server-side, so retrying
        // is pointless — drop it and go back to the front page.
        clearSeat(code);
        window.location.assign("/");
      });

      client.publish({ destination: `/app/match/${code}/sync`, body: "{}" });
    };

    client.onWebSocketClose = () => setConnected(false);
    client.onStompError = (frame) => {
      // The one failure that means the seat is really gone: the registry no longer holds
      // the token, so retrying can never succeed. Drop the dead seat and reload cleanly
      // into the JoinGate. Matched on a code rather than on the sentence it used to carry —
      // this once tested six loose substrings, and "session" and "channel" match plenty of
      // Spring messaging errors that have nothing to do with the seat, every one of which
      // threw a live player out of the room.
      if (isSeatExpired(frame)) {
        clearSeat(code);
        window.location.reload();
        return;
      }
      setError("Lost connection to the room. Retrying…");
    };

    const handleWakeup = () => {
      if (
        document.visibilityState === "visible" &&
        (typeof navigator === "undefined" || navigator.onLine !== false)
      ) {
        if (!client.active || !client.connected) {
          client.activate();
        } else {
          client.publish({ destination: `/app/match/${code}/sync`, body: "{}" });
        }
      }
    };

    document.addEventListener("visibilitychange", handleWakeup);
    window.addEventListener("online", handleWakeup);

    client.activate();
    clientRef.current = client;

    return () => {
      document.removeEventListener("visibilitychange", handleWakeup);
      window.removeEventListener("online", handleWakeup);
      while (subscriptions.length > 0) {
        try {
          subscriptions.pop().unsubscribe();
        } catch {
          // ignore
        }
      }
      clientRef.current = null;
      client.deactivate();
    };
  }, [code, playerId, token]);

  // Stable identity so countdown intervals aren't torn down on every render.
  const serverNow = useCallback(() => Date.now() + offsetRef.current, []);
  const dismissError = useCallback(() => setError(null), []);

  /**
   * Give the seat back, then go home. The short pause lets the frame reach the socket
   * before navigation tears the connection down. Mid-match the server keeps the seat on
   * purpose, so this is a way out of the room rather than a way to forfeit.
   */
  const quit = useCallback(() => {
    try {
      if (clientRef.current?.connected) {
        clientRef.current.publish({ destination: `/app/match/${code}/leave`, body: "{}" });
      }
    } catch {
      // Ignored
    }
    clearSeat(code);
    setTimeout(() => window.location.assign("/"), 120);
  }, [code]);

  const publish = useCallback(
    (action, body) => {
      const client = clientRef.current;
      if (!client?.connected) {
        return;
      }
      try {
        client.publish({
          destination: `/app/match/${code}/${action}`,
          body: JSON.stringify(body ?? {}),
        });
      } catch (err) {
        console.warn("Failed to publish STOMP action:", action, err);
      }
    },
    [code],
  );

  const me = board.find((row) => row.playerId === playerId) ?? null;

  /*
    The actions below are wrapped so their identities survive a board update, which lands
    twice a second. Without that they were new functions on every one, and the memoised
    Wire and TradeDeck they are passed to re-rendered anyway — the memo was there but
    never held.

    `close` needs the current position to pick its sound, and reading that from a ref
    rather than a dependency is what keeps it stable; a cue being one render behind is not
    something an ear can hear.
  */
  const meRef = useRef(null);
  useEffect(() => {
    meRef.current = me;
  }, [me]);

  const ready = useCallback(() => publish("ready"), [publish]);
  const start = useCallback(() => publish("start"), [publish]);
  const rematch = useCallback(
    (sameMarket) => {
      setMatchLiquidations({});
      publish("rematch", { sameMarket });
    },
    [publish],
  );
  const kick = useCallback((playerId) => publish("kick", { playerId }), [publish]);
  const addBot = useCallback(() => publish("bot"), [publish]);
  const configure = useCallback((settings) => publish("config", settings), [publish]);
  const setAvatar = useCallback((id) => publish("avatar", { avatar: id }), [publish]);
  const say = useCallback((text, claim) => publish("chat", { text, claim }), [publish]);

  // Cued here rather than off the returning feed message, so your own trade answers under
  // your finger instead of after a round trip.
  const open = useCallback(
    (side, sizeFraction, leverage) => {
      sound.open(side);
      publish("open", { side, sizeFraction, leverage });
    },
    [publish],
  );

  const close = useCallback(() => {
    sound.close(meRef.current?.position?.unrealisedPnl ?? 0);
    publish("close");
  }, [publish]);

  const toggleSuspect = useCallback((targetPlayerId, tag) => {
    setSuspects((prev) => {
      const current = prev[targetPlayerId];
      if (current === tag) {
        const next = { ...prev };
        delete next[targetPlayerId];
        return next;
      }
      return { ...prev, [targetPlayerId]: tag };
    });
  }, []);

  const value = useMemo(
    () => ({
      session,
      connected,
      phase,
      board,
      feed,
      rumor,
      lastRumor,
      settled,
      standings,
      matchLiquidations,
      lobby,
      error,
      dismissError,
      me,
      serverNow,
      readyState,
      ready,
      start,
      rematch,
      open,
      close,
      say,
      kick,
      addBot,
      configure,
      setAvatar,
      quit,
      suspects,
      toggleSuspect,
    }),
    [session, connected, phase, board, feed, rumor, lastRumor, settled, standings, matchLiquidations, lobby,
      error, me, serverNow, dismissError, quit, readyState, ready, start, rematch, open,
      close, say, kick, addBot, configure, setAvatar, suspects, toggleSuspect],
  );

  const priceValue = useMemo(() => ({ tick, series }), [tick, series]);

  return (
    <MatchContext.Provider value={value}>
      <PriceContext.Provider value={priceValue}>{children}</PriceContext.Provider>
    </MatchContext.Provider>
  );
}
