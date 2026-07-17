# VARBET Admin Web

Operator dashboard for engine quotes, VAR pools, dynamic pricing, liabilities, settlement, and hedge activity.

## Run with the replay simulator

Run these in separate terminals:

```sh
pnpm --filter admin-simulator start
pnpm --filter admin-web dev
```

Open `http://localhost:3003`. The dashboard polls the configured adapter once per second. Use **Restart replay** to reset the Argentina–Egypt incident.

Choose **Repeat scenario** to reuse deterministic seed `20260707`, or **New random run** to generate a fresh bet-arrival and stake sequence. The active seed is displayed in the model badge.

## Dashboard adapter

`lib/dashboard-adapter.ts` is the frontend boundary. It contains:

- `DashboardDataAdapter`: transport-independent interface;
- `HttpDashboardDataAdapter`: current REST implementation;
- `useDashboardData()`: one-second polling, connection state, and last-good-snapshot handling.

Set the server-side adapter base URL in `.env.local`:

```text
ADMIN_DATA_URL=http://localhost:4010
```

The adapter must expose:

```text
GET /v1/admin/dashboard
```

and return `DashboardSnapshot` from `@var-bets/dashboard-contract`. The browser calls the same-origin Next.js routes under `/api`; those routes proxy to the configured operator service so its network location and credentials are never exposed to browser code. Simulation controls are optional in production; the replay service also exposes `POST /v1/simulation/reset`.

## Production adapters to implement

The real operator API should aggregate the execution engine's existing ports and return the shared dashboard contract:

| Dashboard data                            | Production source                                                       |
| ----------------------------------------- | ----------------------------------------------------------------------- |
| Current prices and calibrated Goal signal | `MarketDataPort` backed by the Polymarket CLOB feed plus signal service |
| Accepted handle, payouts, and liabilities | `LedgerPort` backed by transactional database book state                |
| Quote odds and acceptance/rejections      | persisted `Quote` and `BetOrder` records                                |
| Hedge notional, price, status, and fees   | authenticated `HedgePort` venue adapter and hedge-order ledger          |
| Wallet captures and payouts               | licensed `PaymentPort` plus payment transaction ledger                  |
| Pool status and official outcome          | authoritative sports event feed and settlement event store              |

Do not connect provider credentials from the browser. The frontend calls an authenticated operator API; that API owns the engine, secrets, venue adapters, database transactions, and audit log.

## Model reference

The risk percentiles use scenario 10 from `research/var-betting-engine/simulation/sample-results/var_mc_goal_share_scenarios.csv`. Live handle, odds, liabilities, hedge costs, and event P&L come from the adapter snapshot.

The current engine configuration targets a `20%` theoretical gross margin. That requires a `25%` overround, so Goal and No-Goal implied quote probabilities sum to `125%` before inventory adjustments and hard risk caps. The target margin is not guaranteed realized profit; venue execution costs and the final book mix still determine event P&L.

The risk cap also requires worst-case book profit to remain above `20% × accepted handle − $1,000 startup risk buffer`. As handle grows, this floor forces exposed-side odds down and rejects additional bets once the minimum `1.05` quote cannot preserve the required profit.

When a pool settles, the dashboard automatically opens a modal showing accepted user bets by side, filled Polymarket hedge orders by side, total gross payout, and realized profit. The modal can be reopened from the settled pool. These totals come from the complete ledger and hedge aggregates, not the truncated recent-activity list.
