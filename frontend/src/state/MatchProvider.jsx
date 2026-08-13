import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Client } from "@stomp/stompjs";
import { getLobby, socketUrl } from "../lib/api";
import { sound } from "../lib/sound";

const MatchContext = createContext(null);

export const useMatch = () => useContext(MatchContext);

const FEED_LIMIT = 60;

/**
 * Owns the socket and every piece of match state.
 *
 * Two things here are less obvious than they look:
 *
 * - The countdown runs on a server-clock offset, not the browser clock, which can be
 *   minutes out and would otherwise show the wrong time left.
 * - A settled round and the next round's rumour arrive milliseconds apart, so the card
 *   just played is copied into `lastRumor` before the new one lands. Without that the
 *   TRUE/LIE stamp would be overwritten before anyone saw it.
 */
export function MatchProvider({ session, children }) {
  const [connected, setConnected] = useState(false);
  const [phase, setPhase] = useState(null);
  const [tick, setTick] = useState(null);
  const [board, setBoard] = useState([]);
  const [feed, setFeed] = useState([]);
  const [series, setSeries] = useState([]);
  const [rumor, setRumor] = useState(null);
  const [lastRumor, setLastRumor] = useState(null);
  const [settled, setSettled] = useState(null);
  const [standings, setStandings] = useState([]);
  const [lobby, setLobby] = useState(null);
  const [error, setError] = useState(null);

  const clientRef = useRef(null);
  const offsetRef = useRef(0);
  const rumorRef = useRef(null);
  const roundRef = useRef(null);
  const settleRef = useRef(null);
  const feedId = useRef(0);

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

    const on = (dest, fn) => client.subscribe(dest, (m) => fn(JSON.parse(m.body)));
    const topic = (channel) => `/topic/match/${code}/${channel}`;

    client.onConnect = () => {
      setConnected(true);
      setError(null);

      on(topic("phase"), (next) => {
        offsetRef.current = next.serverTime - Date.now();
        setPhase(next);
        // Only a genuinely new round clears the chart. A resync re-sends the current
        // phase to everyone, which would otherwise wipe the round in progress.
        if (next.phase === "TRADING" && roundRef.current !== next.roundIndex) {
          roundRef.current = next.roundIndex;
          setSeries([]);
          setTick(null);
          sound.roundStart();
        }
        // The final settle lands immediately before this, so its totals are the standings.
        if (next.phase === "FINISHED") {
          const results = settleRef.current?.results ?? [];
          const top = results.reduce((a, b) => (b.totalScore > a.totalScore ? b : a), results[0]);
          sound.finish(top?.playerId === playerId);
        }
        // A rematch reopens the room, so the next round counts as new again.
        if (next.phase === "LOBBY") roundRef.current = null;
      });

      on(topic("price"), (next) => {
        setTick(next);
        setSeries((prev) => [...prev, { t: next.elapsedMillis, p: next.price }]);
      });

      on(topic("board"), setBoard);
      on(topic("standings"), setStandings);
      on(topic("lobby"), setLobby);

      on(topic("feed"), (item) => {
        feedId.current += 1;
        setFeed((prev) => [...prev.slice(-FEED_LIMIT), { ...item, id: feedId.current }]);
        if (item.kind === "LIQUIDATION") sound.liquidation(item.playerId === playerId);
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
        setRumor(next.text);
        sound.deal();
      });

      on("/user/queue/error", (next) => setError(next.error));

      client.publish({ destination: `/app/match/${code}/sync`, body: "{}" });
    };

    client.onWebSocketClose = () => setConnected(false);
    client.onStompError = (frame) =>
      setError(frame.headers?.message ?? "Lost the connection to the game.");

    client.activate();
    clientRef.current = client;

    return () => {
      clientRef.current = null;
      client.deactivate();
    };
  }, [code, playerId, token]);

  // Stable identity so countdown intervals aren't torn down on every render.
  const serverNow = useCallback(() => Date.now() + offsetRef.current, []);
  const dismissError = useCallback(() => setError(null), []);

  const publish = useCallback(
    (action, body) => {
      clientRef.current?.publish({
        destination: `/app/match/${code}/${action}`,
        body: JSON.stringify(body ?? {}),
      });
    },
    [code],
  );

  const me = board.find((row) => row.playerId === playerId) ?? null;

  const value = useMemo(
    () => ({
      session,
      connected,
      phase,
      tick,
      board,
      feed,
      series,
      rumor,
      lastRumor,
      settled,
      standings,
      lobby,
      error,
      dismissError,
      me,
      serverNow,
      start: () => publish("start"),
      rematch: (sameMarket) => publish("rematch", { sameMarket }),
      // Cued here rather than off the returning feed message, so your own trade answers
      // under your finger instead of after a round trip.
      open: (side, sizeFraction, leverage) => {
        sound.open(side);
        publish("open", { side, sizeFraction, leverage });
      },
      close: () => {
        sound.close(me?.position?.unrealisedPnl ?? 0);
        publish("close");
      },
      say: (text, claim) => publish("chat", { text, claim }),
    }),
    [session, connected, phase, tick, board, feed, series, rumor, lastRumor, settled,
      standings, lobby, error, me, publish, serverNow, dismissError],
  );

  return <MatchContext.Provider value={value}>{children}</MatchContext.Provider>;
}
