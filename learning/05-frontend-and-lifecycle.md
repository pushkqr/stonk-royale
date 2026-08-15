# Module 05: Frontend Architecture, 60fps Chart Rendering & Seat Lifecycle

Stonk Royale's client is built with React 19 and Vite, styled with vanilla CSS design tokens, and synchronized over WebSocket STOMP. This guide covers the frontend state model, canvas performance optimizations that eliminated garbage collection stutter, seat lifecycle edge cases, and zero-asset Web Audio synthesis.

---

## 1. Client Architecture & State Model

```
┌────────────────────────────────────────────────────────┐
│                   App.jsx (Router)                     │
│               Home.jsx  /  Room.jsx                    │
└──────────────────────────┬─────────────────────────────┘
                           │ (Provides Seat Token)
                           ▼
┌────────────────────────────────────────────────────────┐
│                   MatchProvider.jsx                    │
│   Owns single STOMP WebSocket client & clock offset    │
│   Subscriptions: /phase, /price, /board, /feed, etc.   │
├────────────────────────────────────────────────────────┤
│                       Phase Views                      │
│   Lobby.jsx  Briefing.jsx  Trading.jsx  Results.jsx    │
└────────────────────────────────────────────────────────┘
```

### Clock Synchronization
To keep countdown timers perfectly synchronized across all client devices despite network latency:
- On each incoming server message, `MatchProvider.jsx` calculates clock offset:
  $$\text{Offset} = \text{Server Time} - \text{Client Date.now()}$$
- `serverNow()` returns `Date.now() + offsetRef.current`, ensuring round transitions and countdown alarms fire uniformly across mobile and desktop browsers.

---

## 2. Canvas Chart Performance & Eliminating GC Stutter

The live price chart in `PriceChart.jsx` renders high-frequency 10Hz price updates alongside interactive crosshairs and liquidation lines.

### The Memory Allocation Problem
In early iterations, chart state was updated using standard immutable React array appending:
```javascript
// ANTIPATTERN: Triggered 800ms garbage collection pauses
setPriceHistory(prev => [...prev, newPoint]);
```
- Over a 90-second round at 10Hz price updates on high-refresh displays (144Hz / 180Hz), this created and discarded over **405,000 array and object instances**.
- The browser's garbage collector suffered periodic **800ms stop-the-world pauses**, causing noticeable chart freezing during critical trading moments.

### The In-Place Buffer Pattern
To eliminate allocation churn while preserving clean React component re-renders:

```javascript
// SOLUTION: In-place buffer wrapped in a lightweight identity container
const seriesRef = useRef({ points: new Array(1200), count: 0 });

function appendPoint(point) {
  const buf = seriesRef.current;
  buf.points[buf.count++] = point;
  // Trigger update with single stable container reference
  setVersion(v => v + 1);
}
```

### Additional Canvas Optimizations
1. **Canvas Gradient Caching:** Constructing linear and radial gradients inside the animation frame loop is expensive. Gradients are cached by height and color token in a key-value lookup.
2. **60 FPS Draw Throttling:** `requestAnimationFrame` is clamped with `MIN_FRAME_MS = 15` to prevent wasted canvas repaints on 240Hz monitors without sacrificing smoothness.
3. **Telemetry & Refresh Probing:** `probeRefresh()` detects device refresh rates and tracks rolling render duration in a 600-sample telemetry buffer.

---

## 3. Seat Lifecycle & Room Management

Network drops on mobile devices (e.g. phone lock, Wi-Fi handover, cellular tunnel) look identical to window closures at the instant they happen. Stonk Royale distinguishes transient drops from intentional departures.

```
                  ┌─────────────────────────────────────┐
                  │          Player Disconnect          │
                  └──────────────────┬──────────────────┘
                                     │
                 Is match in LOBBY / FINISHED phase?
                                ╱         ╲
                              YES          NO (Mid-Match)
                              ╱             ╲
              ┌──────────────┴───────┐   ┌───┴──────────────────┐
              │ 45s Grace Period     │   │ Permanent Seat Retain │
              │ Away badge in Lobby  │   │ Score stands in match │
              │ Freed if grace expires│   │ Reconnecting rejoins  │
              └──────────────────────┘   └──────────────────────┘
```

### 1. The 45-Second Disconnect Grace Period
- When a socket disconnects in the **LOBBY** or **FINISHED** state, the server keeps the seat reserved for **45 seconds**.
- The player appears with an `AWAY` tag on the lobby roster in real time.
- If the player returns within 45 seconds (e.g. after a page reload), they resume their seat immediately with their existing session token.

### 2. Mid-Match Leave & Seat Retirement
- If a player clicks **LEAVE** mid-match, `Match.leave` marks `player.hasLeft() = true`.
- **Seat Retirement:** The player's earned score is preserved on the leaderboard and final podium, but no further rumour cards or cash stacks are dealt to them.
- **Capacity Freeing:** Retiring a seat frees the room slot, allowing latecomers to join.

### 3. Latecomer Seating
- Arriving at a running match does not reject the player with "Game in Progress".
- The latecomer is seated immediately, watches the live chart and room wire as a spectator for the current round (`inRound = false`), and enters active trading starting in the next round when fresh stacks are dealt.

### 4. 2-Minute Abandonment Reaper
- Any room where all human players have disconnected for more than **120 seconds** is reaped automatically to reclaim memory.
- Bot-only rooms never stall the abandonment reaper.

### 5. Bot-Safe Host Migration (`nextHost()`)
When a host departs:
1. The server searches for another **connected human player**.
2. If none are connected, it promotes any remaining human player.
3. It **never promotes a bot** to host. If only bots remain, the room becomes hostless and is reaped by the abandonment clock.

---

## 4. Zero-Asset Web Audio API Synthesis

Stonk Royale includes audio feedback for countdown ticks, trades, liquidations, settle bells, and game completion without downloading MP3/WAV files (`sound.js`):

```javascript
const ctx = new (window.AudioContext || window.webkitAudioContext)();

export function playLiquidationBuzz() {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(80, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.35);
  gain.gain.setValueAtTime(0.3, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.35);
}
```

### Benefits of Synthetic Audio
- **0 KB Asset Downloads:** Audio code adds less than 3 KB to the JavaScript bundle with zero external asset requests.
- **Zero Licensing Overhead:** All sound waves (sines, squares, sawtooths) are generated procedurally at runtime.
- **Persistent User Mute:** Mute state is saved in `localStorage` and shared across all components via `MuteToggle.jsx`.
