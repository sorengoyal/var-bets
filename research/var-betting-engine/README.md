# VAR Betting Engine Research

This folder contains two deliberately separate components:

- `execution/`: a bet order execution engine scaffold for quoting, risk reservation, payments, hedging, and settlement;
- `simulation/`: a historical Monte Carlo model for the Argentina–Egypt VAR event.

The execution engine does not import or depend on the simulation.

## Execution engine

```bash
cd research/var-betting-engine/execution
python3 run_demo.py
```

See [`execution/README.md`](execution/README.md) for configuration, formulas, lifecycle, data sources, storage requirements, and the payment/hedge integration points.

The bundled payment, market-data, hedge, and ledger implementations are in-memory test adapters. They do not send money or place external trades.

## Historical simulation

```bash
python3 -m pip install numpy
python3 research/var-betting-engine/simulation/var_mc_goal_share_scenarios.py
```

The script pulls public Polymarket historical prices for the July 7, 2026 Argentina–Egypt market and runs 15 Goal-bet-share scenarios. It writes the scenario comparison to `simulation/outputs/var_mc_goal_share_scenarios.csv`.

An example result set is committed at `simulation/sample-results/var_mc_goal_share_scenarios.csv`.

## Important limitations

- The historical Polymarket endpoint provides minute-fidelity observations; the simulation interpolates within the VAR window.
- A match-winner probability is converted into a Goal/No-Goal signal and is not itself the probability that a goal will stand.
- The execution engine is an integration scaffold, not a licensed production gambling platform.
- Real-money deployment requires durable storage, provider reconciliation, KYC/AML, jurisdiction controls, responsible-gaming controls, audit logging, and legal review.
