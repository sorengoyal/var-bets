import csv
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import numpy as np


CLOB_BASE = "https://clob.polymarket.com"
ARGENTINA_YES_TOKEN_ID = (
    "87390712702935875353084647255226721799646621048501318482801979643152933271064"
)
VAR_TIMES = {
    "ball_in_net": "2026-07-07T17:22:00Z",
    "ref_to_monitor": "2026-07-07T17:23:00Z",
    "no_goal_decision": "2026-07-07T17:24:00Z",
}
GOAL_SHARES = [
    0.05,
    0.10,
    0.15,
    0.20,
    0.25,
    0.30,
    0.35,
    0.40,
    0.45,
    0.50,
    0.55,
    0.60,
    0.70,
    0.80,
    0.85,
]
SIMULATIONS_PER_SCENARIO = 5000
OUTPUT_CSV = (
    Path(__file__).resolve().parent
    / "outputs"
    / "var_mc_goal_share_scenarios.csv"
)
MAX_UNHEDGED_LOSS = 1000.0
MIN_DECIMAL_ODDS = 1.05


def unix_timestamp(iso_timestamp):
    return int(datetime.fromisoformat(iso_timestamp.replace("Z", "+00:00")).timestamp())


def get_json(url, params):
    request = Request(
        f"{url}?{urlencode(params)}",
        headers={"Accept": "application/json", "User-Agent": "var-monte-carlo-model/1.0"},
    )
    try:
        with urlopen(request, timeout=20) as response:
            return json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, ValueError) as exc:
        raise RuntimeError("not able to pull data from polymarket") from exc


def pull_polymarket_prices():
    data = get_json(
        f"{CLOB_BASE}/prices-history",
        {
            "market": ARGENTINA_YES_TOKEN_ID,
            "startTs": unix_timestamp("2026-07-07T17:20:00Z"),
            "endTs": unix_timestamp("2026-07-07T17:26:00Z"),
            "fidelity": 1,
        },
    )
    history = []
    for point in data.get("history", []):
        try:
            history.append((int(float(point["t"])), float(point["p"])))
        except (KeyError, TypeError, ValueError):
            continue
    if not history:
        raise RuntimeError("not able to pull data from polymarket")

    prices = {}
    for name, iso_timestamp in VAR_TIMES.items():
        target = unix_timestamp(iso_timestamp)
        timestamp, price = min(history, key=lambda point: abs(point[0] - target))
        prices[name] = {
            "price": price,
            "observed_at": datetime.fromtimestamp(timestamp, tz=timezone.utc).isoformat(),
            "distance_seconds": abs(timestamp - target),
        }
    return prices


def match_price_to_goal_probability(
    match_price,
    goal_price_anchor,
    no_goal_price_anchor,
    prior_goal_probability=0.65,
    signal_strength=0.65,
):
    price_range = no_goal_price_anchor - goal_price_anchor
    if abs(price_range) < 1e-9:
        raise ValueError("Polymarket prices did not move enough to infer a VAR signal")
    raw_goal_signal = np.clip(
        (no_goal_price_anchor - match_price) / price_range,
        0.0,
        1.0,
    )
    probability = (
        (1.0 - signal_strength) * prior_goal_probability
        + signal_strength * raw_goal_signal
    )
    return float(np.clip(probability, 0.02, 0.98))


def dynamic_odds(
    p_goal,
    payout_if_goal,
    payout_if_nogoal,
    liability_cap=12000.0,
    overround=0.07,
    inventory_sensitivity=0.08,
):
    imbalance = np.clip(
        (payout_if_goal - payout_if_nogoal) / liability_cap,
        -1.0,
        1.0,
    )
    q_goal = np.clip(
        p_goal * (1.0 + overround) + inventory_sensitivity * imbalance,
        0.02,
        0.98,
    )
    q_nogoal = np.clip(
        (1.0 - p_goal) * (1.0 + overround) - inventory_sensitivity * imbalance,
        0.02,
        0.98,
    )
    return 1.0 / q_goal, 1.0 / q_nogoal


def risk_capped_odds(
    requested_odds,
    stake,
    handle,
    existing_side_payout,
    max_unhedged_loss=MAX_UNHEDGED_LOSS,
    minimum_odds=MIN_DECIMAL_ODDS,
):
    projected_handle = handle + stake
    maximum_safe_odds = (
        projected_handle + max_unhedged_loss - existing_side_payout
    ) / stake
    offered_odds = min(float(requested_odds), float(maximum_safe_odds))
    if offered_odds < minimum_odds:
        return None, float(maximum_safe_odds)
    return offered_odds, float(maximum_safe_odds)


def simulate_scenario(prices, goal_share, seed):
    rng = np.random.default_rng(seed)
    profits = np.empty(SIMULATIONS_PER_SCENARIO)
    handles = np.empty(SIMULATIONS_PER_SCENARIO)
    max_liabilities = np.empty(SIMULATIONS_PER_SCENARIO)
    acceptance_rates = np.empty(SIMULATIONS_PER_SCENARIO)
    rejected_handles = np.empty(SIMULATIONS_PER_SCENARIO)
    average_goal_odds = np.empty(SIMULATIONS_PER_SCENARIO)
    average_no_goal_odds = np.empty(SIMULATIONS_PER_SCENARIO)
    bettor_returns_per_dollar = np.empty(SIMULATIONS_PER_SCENARIO)
    no_goal_returns_per_dollar = np.empty(SIMULATIONS_PER_SCENARIO)
    price_times = np.array([0.0, 50.0, 110.0])
    price_path = np.array([
        prices["ball_in_net"]["price"],
        prices["ref_to_monitor"]["price"],
        prices["no_goal_decision"]["price"],
    ])
    goal_anchor = float(price_path[0])
    no_goal_anchor = float(price_path[-1])

    for simulation in range(SIMULATIONS_PER_SCENARIO):
        stakes = rng.exponential(80.0, 140)
        goal_sides = rng.random(140) < goal_share
        bet_times = np.sort(rng.uniform(0.0, 110.0, 140))
        handle = 0.0
        payout_if_goal = 0.0
        payout_if_nogoal = 0.0
        accepted_bets = 0
        rejected_handle = 0.0
        accepted_goal_odds = []
        accepted_no_goal_odds = []
        accepted_goal_handle = 0.0
        accepted_no_goal_handle = 0.0

        for stake, goal_side, bet_time in zip(stakes, goal_sides, bet_times):
            match_price = float(np.interp(bet_time, price_times, price_path))
            p_goal = match_price_to_goal_probability(
                match_price,
                goal_anchor,
                no_goal_anchor,
            )
            goal_odds, no_goal_odds = dynamic_odds(
                p_goal,
                payout_if_goal,
                payout_if_nogoal,
            )
            if goal_side:
                offered_odds, _ = risk_capped_odds(
                    requested_odds=goal_odds,
                    stake=float(stake),
                    handle=handle,
                    existing_side_payout=payout_if_goal,
                )
                if offered_odds is None:
                    rejected_handle += float(stake)
                    continue
                handle += float(stake)
                accepted_goal_handle += float(stake)
                payout_if_goal += float(stake) * offered_odds
                accepted_goal_odds.append(offered_odds)
            else:
                offered_odds, _ = risk_capped_odds(
                    requested_odds=no_goal_odds,
                    stake=float(stake),
                    handle=handle,
                    existing_side_payout=payout_if_nogoal,
                )
                if offered_odds is None:
                    rejected_handle += float(stake)
                    continue
                handle += float(stake)
                accepted_no_goal_handle += float(stake)
                payout_if_nogoal += float(stake) * offered_odds
                accepted_no_goal_odds.append(offered_odds)
            accepted_bets += 1

        max_liability = max(payout_if_goal - handle, payout_if_nogoal - handle, 0.0)
        hedged_notional = 0.80 * max_liability
        hedge_filled = bool(rng.random() < 0.90)
        fee_cost = hedged_notional * 0.015 if hedge_filled else 0.0
        slippage_cost = hedged_notional * 0.0055 if hedge_filled else 0.0
        unfilled_cost = 0.0 if hedge_filled else hedged_notional * 0.007
        execution_cost = fee_cost + slippage_cost + unfilled_cost

        profits[simulation] = handle - payout_if_nogoal - execution_cost
        handles[simulation] = handle
        max_liabilities[simulation] = max_liability
        acceptance_rates[simulation] = accepted_bets / len(stakes)
        rejected_handles[simulation] = rejected_handle
        average_goal_odds[simulation] = (
            float(np.mean(accepted_goal_odds)) if accepted_goal_odds else np.nan
        )
        average_no_goal_odds[simulation] = (
            float(np.mean(accepted_no_goal_odds)) if accepted_no_goal_odds else np.nan
        )
        bettor_returns_per_dollar[simulation] = payout_if_nogoal / handle if handle else 0.0
        no_goal_returns_per_dollar[simulation] = (
            payout_if_nogoal / accepted_no_goal_handle
            if accepted_no_goal_handle
            else np.nan
        )

    return {
        "mean_profit": float(np.mean(profits)),
        "median_profit": float(np.median(profits)),
        "p5_profit": float(np.percentile(profits, 5)),
        "p1_profit": float(np.percentile(profits, 1)),
        "worst_profit": float(np.min(profits)),
        "loss_probability": float(np.mean(profits < 0.0)),
        "mean_margin": float(np.mean(profits / handles)),
        "mean_handle": float(np.mean(handles)),
        "mean_max_liability": float(np.mean(max_liabilities)),
        "p99_liability": float(np.percentile(max_liabilities, 99)),
        "mean_acceptance_rate": float(np.mean(acceptance_rates)),
        "mean_rejected_handle": float(np.mean(rejected_handles)),
        "mean_goal_odds": float(np.nanmean(average_goal_odds)),
        "mean_no_goal_odds": float(np.nanmean(average_no_goal_odds)),
        "bettor_payout_per_dollar": float(np.mean(bettor_returns_per_dollar)),
        "bettor_net_per_dollar": float(np.mean(bettor_returns_per_dollar - 1.0)),
        "no_goal_payout_per_dollar": float(np.nanmean(no_goal_returns_per_dollar)),
    }


def run_scenarios(prices):
    results = []
    for scenario_id, goal_share in enumerate(GOAL_SHARES, start=1):
        result = simulate_scenario(prices, goal_share, 30_000 + scenario_id)
        result.update({
            "scenario_id": scenario_id,
            "goal_bet_share": goal_share,
            "no_goal_bet_share": 1.0 - goal_share,
            "simulations": SIMULATIONS_PER_SCENARIO,
        })
        results.append(result)
    return results


def write_results(results):
    columns = [
        "scenario_id",
        "goal_bet_share",
        "no_goal_bet_share",
        "simulations",
        "mean_profit",
        "median_profit",
        "p5_profit",
        "p1_profit",
        "worst_profit",
        "loss_probability",
        "mean_margin",
        "mean_handle",
        "mean_max_liability",
        "p99_liability",
        "mean_acceptance_rate",
        "mean_rejected_handle",
        "mean_goal_odds",
        "mean_no_goal_odds",
        "bettor_payout_per_dollar",
        "bettor_net_per_dollar",
        "no_goal_payout_per_dollar",
    ]
    OUTPUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_CSV, "w", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=columns)
        writer.writeheader()
        writer.writerows(results)


def print_results(results):
    print("=== GOAL-BET-SHARE SCENARIOS: ACTUAL OUTCOME NO_GOAL ===")
    print(
        "goal_share  mean_profit  median_profit  p5_profit  p1_profit  "
        "loss_prob  mean_margin  accepted  bettor_return/$1"
    )
    for result in results:
        print(
            f"{result['goal_bet_share']:>10.0%}  "
            f"{result['mean_profit']:>11,.2f}  "
            f"{result['median_profit']:>13,.2f}  "
            f"{result['p5_profit']:>9,.2f}  "
            f"{result['p1_profit']:>9,.2f}  "
            f"{result['loss_probability']:>9.1%}  "
            f"{result['mean_margin']:>11.1%}  "
            f"{result['mean_acceptance_rate']:>8.1%}  "
            f"{result['bettor_payout_per_dollar']:>16.3f}"
        )
    print(f"scenario_results_csv: {OUTPUT_CSV}")


def main():
    try:
        prices = pull_polymarket_prices()
    except RuntimeError as exc:
        print(str(exc))
        return 1

    print("Pulled Polymarket prices:")
    for name, point in prices.items():
        print(
            f"  {name}: {point['price']:.4f} at {point['observed_at']} "
            f"({point['distance_seconds']}s from requested time)"
        )
    print(
        f"Running {len(GOAL_SHARES)} scenarios with "
        f"{SIMULATIONS_PER_SCENARIO:,} simulations each..."
    )
    results = run_scenarios(prices)
    write_results(results)
    print_results(results)
    return 0


if __name__ == "__main__":
    sys.exit(main())
