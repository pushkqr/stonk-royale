# Module 04: Practice Bots & Deterministic Scripting

Stonk Royale includes an autonomous opponent subsystem designed to make single-player practice sessions mechanically identical to full multiplayer matches. Bots trade on the order book, bluff in chat, react to market events, and appear on the end-of-round social ledger.

---

## 1. Practice Mode Philosophy

A solo trading environment without opponents breaks the core mechanics of Stonk Royale:
- There would be no other order flow moving the price.
- There would be no private rumour holders to compare claims against.
- The social ledger at round settle would be empty.

### Deterministic Pre-Scripting vs Runtime AI
Bots do not run heavy neural models or make dynamic decisions on each tick:
1. **Pre-Authored Actions:** During the intermission, `BotScripter.java` authors a complete deterministic action script for each bot based on the round seed.
2. **Resource Efficiency:** Pre-scripting requires negligible CPU overhead during live trading rounds.
3. **Reproducibility:** A match replayed with the same seed will produce the exact same bot order flow, bluffs, and reactions.

---

## 2. Bot Personas & Archetypes

Bots are assigned behavioral archetypes defined in `BotPersona.java`:

```
┌────────────────────────────────────────────────────────┐
│                      BOT PERSONAS                      │
├───────────────┬────────────────────────────────────────┤
│   SHARP       │  Disciplined trend follower            │
│               │  Trades paying direction, 4x, 70% size │
├───────────────┼────────────────────────────────────────┤
│   MARK        │  Reckless degen trader                 │
│               │  Trades losing direction, 7x, 90% size │
├───────────────┼────────────────────────────────────────┤
│   CHOPPER     │  Conservative scalper                  │
│               │  Two short trades per round, 2x, 35%   │
└───────────────┴────────────────────────────────────────┘
```

### Archetype Mechanics

1. **`SHARP` (Informed/Savvy):**
   - Stance: Aligns with the true underlying market regime.
   - Leverage: 4x.
   - Sizing: 70% of available cash.
   - Entry Timing: Enters after an initial shock lag (at ~30% into the round) to simulate reading confirmed price momentum.

2. **`MARK` (The Sucker):**
   - Stance: Positions directly against the true regime (e.g., going long during a `DUMP` or short during a `PUMP`).
   - Leverage: High 7x leverage with aggressive 90% size.
   - Entry Timing: Enters early (at ~10% into the round) and holds stubbornly until liquidation or the final buzzer.

3. **`CHOPPER` (The Scalper):**
   - Stance: Scalps short movements with 2x leverage and 35% size.
   - Execution: Executes two distinct trades per round, taking quick profits or small losses.

### Persona Rotation & Independent Liar Selection
- **Rotation:** Personas rotate among bot names each round based on the round index:
  $$\text{Persona Index} = \text{floorMod}(\text{Bot Index} + \text{Round Index},\, 3)$$
  This prevents a human player from trivially memorizing that *"Vega is always right"*.
- **The Liar Bot:** Exactly one bot per round is designated as the **Liar**. During the intermission, this bot broadcasts a false claim on the trade wire about its dealt rumour. Liar selection is chosen independently from trading persona.

---

## 3. Reactive Chatter (`BotChatter.java`)

To bring the room feed to life during live trading, `BotChatter.java` injects reactive comments when market events occur:
- **Triggers:** Sharp market plunges, sudden squeeze spikes, large whale entries, and player liquidations.
- **Cooldown Throttle:** Enforces a minimum 4-second delay between reactive comments to avoid spamming the feed.
- **Speaker Isolation:** A bot never reacts to its own liquidation or trade.
- **Rotating Speaker Cursor:** Reactions cycle through available seated bots to ensure conversational variety.

---

## 4. Bot Seating & Safety Invariants (`Bots.java`)

Opponent bots are seated via `Bots.java` using a predefined name catalog:

```java
public static final List<String> NAMES = List.of("Vega", "Kite", "Moss", "Pike", "Otto");
```

### Key Safety Invariants
1. **Unique ID Assignment:** Bots receive deterministic IDs (`bot:0`, `bot:1`, `bot:2`) and are tagged with `isBot = true`.
2. **Name Collision Avoidance:** `Bots.seat(match)` ensures a bot never takes a nickname currently held by an active human player (evaluated case-insensitively).
3. **No Host Privileges:** Bots are **never promoted to host** (`Match.nextHost()`). If all humans leave a room containing bots, the room becomes hostless and is reaped by the abandonment reaper.
4. **Briefing Bypass:** Bots do not require manual ready-ups and never hold the briefing gate shut (`!player.isBot()`).
5. **On-Demand Seating & Removal:** Lobby hosts can add bots on-demand via the "Add a bot" button and remove them using the standard kick action.
