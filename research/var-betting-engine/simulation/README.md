# Historical Monte Carlo Simulation

This simulation is separate from the order execution engine.

It models the July 7, 2026 Argentina–Egypt VAR incident using the Argentina `Yes` outcome token on Polymarket:

- ball in net: `17:22:00Z`;
- referee at monitor: `17:23:00Z`;
- final decision: `17:24:00Z`;
- result: `NO_GOAL`.

## Run

```bash
python3 -m pip install numpy
python3 var_mc_goal_share_scenarios.py
```

The script uses only public Polymarket market-data endpoints; no trading API key is required.

## Scenario inputs

- 15 Goal-bet shares from 5% to 85%;
- 5,000 simulations per share;
- dynamic odds based on the interpolated match-price path;
- inventory-sensitive repricing;
- `$1,000` maximum unhedged loss;
- `1.05` minimum decimal odds;
- bet rejection when no compliant quote is available.

## Output columns

| Column | Meaning |
|---|---|
| `mean_profit` | Average platform result per VAR event |
| `p5_profit` / `p1_profit` | Downside percentiles |
| `loss_probability` | Share of simulations with negative platform P&L |
| `mean_acceptance_rate` | Percentage of requested bets accepted |
| `bettor_payout_per_dollar` | Blended dollars returned per accepted dollar |
| `no_goal_payout_per_dollar` | Dollars returned per accepted No-Goal dollar |
| `mean_max_liability` | Average maximum outcome liability |

The results are conditional on the known `NO_GOAL` outcome and are not a forecast of profitability across future VAR reviews.
