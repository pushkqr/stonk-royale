# Module 02: Market Simulation & Order Flow Impact

Stonk Royale generates synthetic price action using precomputed, deterministic Geometric Brownian Motion (GBM) combined with a real-time, decaying order flow impact model. This architecture enables reproducible matches while allowing player trades to move the market dynamically.

---

## 1. Seeded Geometric Brownian Motion (GBM)

Prices are not streamed from external live markets. Instead, each round generates a 900-point price trajectory (90 seconds sampled at 10Hz) during the intermission prior to market open.

### Mathematical Formulation
The price path evolves according to stochastic differential steps:

$$\Delta S_t = S_t \left( \mu \Delta t + \sigma \sqrt{\Delta t} \, Z_t \right)$$

Where:
- $S_t$ is the price at time step $t$.
- $\Delta t = 0.1\,\text{seconds}$ (100ms per tick).
- $\mu$ is the drift parameter dictated by the chosen regime.
- $\sigma$ is the volatility parameter.
- $Z_t \sim \mathcal{N}(0, 1)$ is standard normal noise generated from a seeded `Random` instance.

### Precomputation & Information Integrity
By generating the entire 900-point future path during the intermission:
1. **Verifiable Truth:** A rumour asserting that a stock will crash is objectively truthful because the server has already calculated the crash in the baseline curve.
2. **Synchronized News:** Breaking news shock headlines can be scheduled to trigger exactly 2–4 seconds before a sharp price movement occurs.

---

## 2. The Five Market Regimes

Each round selects one hidden market regime from `Regime.java`. Over 2,000 empirical seeded simulations per regime, price behaviors exhibit the following statistical profiles:

| Regime | Visual Character | Median Range | Median Return | 10th Percentile | 90th Percentile |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`PUMP`** | Steady upward drift | **38.7%** | **+27.7%** | +0.5% | +61.0% |
| **`DUMP`** | Steady downward bleed | **31.4%** | **−22.6%** | −39.0% | −2.4% |
| **`CHOP`** | High volatility, zero drift | **43.3%** | **−2.7%** | −34.7% | +43.1% |
| **`RUG`** | Extended pump, then sudden −40% plunge | **51.9%** | **−26.9%** | −40.1% | −11.3% |
| **`SQUEEZE`** | Extended bleed, then sudden +40% spike | **45.1%** | **+20.2%** | −1.5% | +45.8% |

> **Volatility Calibration:** Real-world crypto assets move under 1% in 90 seconds. To make rounds decisive and competitive, volatility is tuned so that 90 seconds covers a 30% to 50% price range.

---

## 3. Order Flow & Market Impact (`MarketImpact.java`)

While the seeded GBM path represents the underlying macro tide, player trades create dynamic chop on top of it.

```
       Actual Price = Baseline Seeded Price × (1.0 + Net Impact)
```

### Exponential Decay Model
When a player opens, closes, or is liquidated from a position, a transient impulse kick is added to the market:

$$\text{Impact}(t) = \sum_{i} \text{Kick}_i \cdot \exp\left( -\frac{t - t_i}{\tau} \right)$$

Where:
- $\text{Kick}_i = \pm (\text{Notional Size} / \text{Reference Depth}) \cdot \text{Multiplier}$.
- $\tau = 4.0\,\text{seconds}$ is the exponential decay time constant.
- $t - t_i$ is elapsed time since order execution.

```
Impact (+%)
  ▲
  │   ▲ Trade Fill
  │  ╱ ╲
  │ ╱   ╲
  │╱     └───► Exponential Decay (tau = 4.0s)
  └──────────────────────────────► Time
```

### Key Mechanical Invariants
1. **Transient, Not Permanent:** Because impact decays exponentially back to 0, player actions cannot permanently alter the round's preordained outcome or invalidate the underlying truth of dealt rumours.
2. **Safety Clamping ($\pm 4\%$):** Net impact is hard-clamped to $[-0.04, +0.04]$. This prevents coordinated whale manipulation from artificially forcing immediate liquidations on other players.
3. **Liquidation Cascades:** Forced liquidations execute an immediate market close (a forced sell for long positions or buy for short positions), creating authentic chain-reaction liquidation cascades when crowded trades turn adverse.
4. **Slippage Transparency:** The frontend `TradeDeck` calculates expected market impact before submission, allowing traders to see exact expected fill prices including slippage.

---

## 4. Leverage, Margin & Liquidation

Players trade using notional size scaled by integer leverage multipliers ($1\text{x}$ to $10\text{x}$).

### Maintenance Margin Rule
Liquidation is triggered whenever adverse price movement from entry exceeds the maintenance margin buffer:

$$\text{Adverse Price Move Limit} = \frac{0.90}{\text{Leverage}}$$

- **10x Leverage:** Liquidates on a **9.0%** adverse price move.
- **5x Leverage:** Liquidates on an **18.0%** adverse price move.
- **2x Leverage:** Liquidates on a **45.0%** adverse price move.

### Empirical Survival Horizons
Because market regimes exhibit high short-term volatility, leverage functions as a statement of holding horizon rather than pure direction:

| Hold Duration | 2x Leverage | 3x Leverage | 5x Leverage | 10x Leverage |
| :--- | :--- | :--- | :--- | :--- |
| **10 seconds** | 100% | 98% | 96% | **82%** |
| **20 seconds** | 100% | 94% | 89% | **65%** |
| **30 seconds** | 99% | 91% | 78% | **55%** |
| **45 seconds** | 98% | 84% | 69% | **44%** |

### Liquidation Penalty & Capital Preservation
- **90% Margin Forfeit:** Liquidation claims exactly 90% of posted margin, leaving 10% in cash to re-enter positions.
- **No Player Elimination:** Because cash resets to $10,000 at the beginning of each round, a complete blowup in Round 1 only impacts that round's score without eliminating the player from the remainder of the match.
