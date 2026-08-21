# Module 01: Gameplay Loop & Deception Mechanics

Stonk Royale is a multiplayer deception game structured around social dynamics rather than traditional financial modeling. Matches last approximately 9–10 minutes across 5 rounds, where the primary objective is outmaneuvering opponents through information asymmetry, bluffing, and timely market execution.

---

## 1. The Core Match Lifecycle

A match cycles through five distinct phases, advancing deterministically on the server:

```
[LOBBY] ──► [BRIEFING] ──► [INTERMISSION (Round N)] ──► [TRADING (Round N)] ──► [SETTLE] ──► [FINISHED]
                               ▲                                                   │
                               └──────────────── (Rounds 1 to 4) ──────────────────┘
```

### Match Configuration & Presets
The host configures room parameters from the lobby before starting:

| Parameter | Standard (Default) | Quick Preset | Long Preset | Custom Range |
| :--- | :--- | :--- | :--- | :--- |
| **Total Rounds** | 5 | 3 | 7 | 1–8 rounds |
| **Round Length** | 90 seconds | 60 seconds | 90 seconds | 10–180 seconds |
| **Intermission** | 25 seconds | 15 seconds | 25 seconds | 5–60 seconds |
| **Starting Cash** | $10,000 | $10,000 | $10,000 | Cosmetic (PnL % scored) |
| **Max Players** | 12 | 12 | 12 | 2–12 players |

> **Cosmetic Starting Cash:** Starting cash is reset each round to ensure every player starts on equal footing. Scoring is measured as a percentage of starting capital, making cash amounts purely cosmetic without affecting outcome parity.

### Phase 1: The Briefing Gate
Before Round 1 begins, all players enter a briefing screen outlining the game rules:
- **Scroll Requirement:** The "Ready" button remains disabled until the player has scrolled through the entire rules panel, ensuring newcomer orientation.
- **Failsafe Timer:** A 90-second global countdown automatically advances the room to prevent an inactive player from locking the table indefinitely.
- **Client Cache:** Players who have previously completed the briefing on their browser skip directly to the waiting state.

### Phase 2: Intermission (Pre-Round Negotiation)
During the 25-second intermission between rounds:
- **Asset Reveal:** The next fictional asset and its contextual narrative blurb are revealed.
- **Private Rumour Deal:** Each player is privately dealt a unique rumour regarding the upcoming price regime.
- **True-Tip Count:** The room is publicly informed how many total true tips were dealt across all players.
- **Previous Round Review:** Previous rumour cards return stamped **TRUE** or **LIE**, and the social ledger displays what each player claimed versus what they actually held.
- **Open Wire:** The trade feed wire remains active for negotiation, chat, and false claims while the price chart is halted.

### Phase 3: Trading Floor (Live Execution)
A 90-second high-tempo trading round:
- **Position Sizing & Leverage:** Players choose long or short stances with 1x to 10x leverage. Exactly one open position is allowed per player at any time.
- **Visual Liquidation Price:** The exact liquidation boundary is rendered dynamically on the chart.
- **Persistent Dossier HUD:** Keeps private rumours, announced true counts, and breaking news headlines pinned beside the price action.
- **Order Flow Impact:** Trades push the asset price transiently, allowing coordinated action and liquidations to move the market.

### Phase 4: Settle & Round Scoring
At the buzzer:
- **Forced Close:** All open positions force-close at the final tick price.
- **Regime Reveal:** The hidden regime is revealed alongside the player's dealt rumour.
- **Scoring:** Round PnL is computed and added to cumulative match standings.

### Phase 5: Results, Rematches & Replays
On the final standings screen:
- **Podium & Ledger:** Displays final rankings and the final round's deception ledger.
- **Play Again:** Generates a new market (`generation++`) while preserving all player seats, room codes, and configurations.
- **Rerun Same Market:** Replays the exact identical seeded price paths, isolating trading execution and table bluffing from market variance.
- **Dynamic Host Tracking:** The results screen continuously synchronizes host migration so promoted hosts can start rematches without returning to the home screen.

---

## 2. Information Architecture & Deception Mechanics

```
┌────────────────────────────────────────────────────────┐
│                   INFORMATION ENGINE                   │
│                                                        │
│   Private Rumour (Dealt to You)                        │
│   "Insiders dumping $BAGZ ahead of regulatory audit"   │
│   Claimed Regime: DUMP                                 │
├──────────────────────────┬─────────────────────────────┤
│   Public True-Tip Count  │   Public Breaking Headlines │
│   Truthful Tips: 2 / 5   │   [0:32] "Whale accumulation"│
│                          │   [0:58] "Smart contract bug"│
└──────────────────────────┴─────────────────────────────┘
```

### Private Rumours & Truth Distribution
- **Roughly Half, Never Either End:** The number of truthful tips is drawn from a narrow band centred on half the room (`RoundPlanner.truthfulTipCount`), and excludes both extremes by construction rather than by clamping afterwards.
- **Why Not a Fixed Probability:** Tips were originally drawn independently at a 40% rate, which put the count on a binomial and let it land anywhere. That reads acceptably at twelve seats and collapses at four — it dealt a single true tip in 47% of rounds and made every tip true in a further 3%, so *half of all four-player rounds* arrived in a state where nobody had to deduce anything. Bots occupy seats too, so a solo practice match against three of them is a four-player room and was hitting that case constantly.
- **Both Ends End The Round:** If one tip in four is real, everybody correctly assumes theirs is the lie. If every tip is real, nobody has to lie. Both are the same failure — the announced count answers the question the round exists to ask.
- **Two Seats Collapse To One:** At two players the count is always 1, the only value that is neither nobody nor everybody.
- **Public Count:** The server broadcasts the total count of true tips in the room (`truthfulTips`), but never reveals who holds them.
- **The `ALL_LIES` Variant:** A host can deliberately re-enter the excluded end. Under it the count is zero and the room is *told* it is zero, which inverts the deduction: a tip stops naming what the market will do and starts naming one thing it will not.

### Headline Pairs
- Exactly two headlines are scheduled per round by `InformationScripter.java`: one is **TRUE** and one is **FALSE**.
- **Shock Lead Times:** Warning headlines regarding sudden regime events (such as crashes or squeezes) appear 2–4 seconds *before* the price movement begins, rewarding attentive readers.

### The Dossier HUD
To prevent interface friction during fast-paced rounds, the Dossier sits adjacent to the price chart and records:
1. The player's dealt tip and its explicit asserted regime.
2. The announced count of true tips dealt in the room.
3. Every headline published so far in the round.

### Structured Claims vs Free-Text Chat
- **The Wire Feed:** Integrates trade execution notices, news headlines, forced liquidations, and player chat into a single unified stream.
- **Structured Claims:** Quick-chat buttons record structured declarations (e.g., *"My tip says PUMP"*). These claims are parsed server-side and recorded in `PlayerRound.java`.
- **Free-Text Integrity:** Free-form chat messages remain unscored to allow natural social banter without artificial syntax constraints.

### The Zero-Point Social Scoring Philosophy
- Catching a liar awards **0 numerical points**.
- **Design Rationale:** In a deception game, the reward for catching a liar is social validation and market edge (e.g., fading their trade or positioning ahead of the true regime). Direct numerical penalties would incentivize silence and discourage active bluffing on the wire.
