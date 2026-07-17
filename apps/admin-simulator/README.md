# Admin Dashboard Simulator

This service replays the Argentina–Egypt VAR window and drives the real TypeScript execution engine once per simulated second.

Each tick:

1. interpolates the supplied Polymarket Argentina/Egypt probabilities;
2. calibrates a simulation-only Goal signal from the match-price move;
3. generates `3–11` deterministic pseudo-random bet requests with `$2–$40` stakes;
4. asks `BetExecutionEngine` for inventory-sensitive quotes;
5. executes accepted bets through in-memory payment and ledger adapters;
6. records a simulated Polymarket hedge attempt and rejects every tenth order to model venue liquidity/fill risk;
7. closes and settles the pool as `NO_GOAL` at `59:45`.

Quotes target a `20%` theoretical gross margin, which requires a `25%` base overround. The two quoted implied probabilities therefore begin with a combined target of `125%`, before inventory pressure and hard liability caps alter the side-specific prices. This is a pricing target, not a guarantee of 20% realized profit after hedge costs, slippage, rejection mix, and settlement outcome.

The replay hedges `15%` of each accepted order's uncovered payout liability. This keeps hedge orders visible while avoiding the unrealistic cost of attempting to reinsure nearly half of every individual order. A production adapter should hedge net book exposure rather than copy this demonstration ratio.

At settlement, the snapshot reports accepted user bet counts and stakes by side, filled Polymarket hedge-order counts and notional by side, gross winning-user payout, and realized event profit from the engine book.

## Run

```bash
pnpm --filter admin-simulator start
```

The service listens on `http://localhost:4010`. Set `SIM_TICK_MS` to replay faster than real time.

## Endpoints

- `GET /health`
- `GET /v1/admin/dashboard`
- `POST /v1/simulation/reset`
- `POST /v1/simulation/pause`
- `POST /v1/simulation/resume`

This is not a profitability forecast or a production hedge implementation. Its market-to-Goal calibration and hedge ratio are explicitly simulation-only.
