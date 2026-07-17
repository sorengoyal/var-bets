import { randomUUID } from "node:crypto";
import type { HedgeActivity } from "@var-bets/dashboard-contract";
import type {
  BetOrder,
  HedgePort,
  HedgeResult,
  MarketSnapshot,
} from "@var-bets/execution-engine";
import { Side } from "@var-bets/execution-engine";
import { clockLabel } from "./polymarket-path.ts";

export class SimulatedPolymarketHedge implements HedgePort {
  readonly activity: HedgeActivity[] = [];
  elapsedSecond = 0;
  private orderCount = 0;

  async execute(
    order: BetOrder,
    snapshot: MarketSnapshot,
  ): Promise<HedgeResult> {
    const hedgeOrderId = `sim_hedge_${randomUUID()}`;
    this.orderCount += 1;
    const filled = this.orderCount % 10 !== 0;
    const selectedProbability =
      order.side === Side.GOAL
        ? snapshot.goalProbability
        : 1 - snapshot.goalProbability;
    const uncoveredLiability = Math.max(
      0,
      order.potentialPayoutCents - order.stakeCents,
    );
    const grossPayoffCents = Math.round(uncoveredLiability * 0.42);
    const premiumCents = Math.round(
      grossPayoffCents * selectedProbability * 1.006,
    );

    this.activity.unshift({
      id: hedgeOrderId,
      second: this.elapsedSecond,
      timeLabel: clockLabel(this.elapsedSecond),
      side: order.side,
      notional: grossPayoffCents / 100,
      venuePrice: selectedProbability,
      status: filled ? "FILLED" : "REJECTED",
    });
    this.activity.splice(30);

    return {
      hedgeOrderId,
      filled,
      payoffIfGoalCents:
        filled && order.side === Side.GOAL ? grossPayoffCents : 0,
      payoffIfNoGoalCents:
        filled && order.side === Side.NO_GOAL ? grossPayoffCents : 0,
      reservedCostCents: filled ? premiumCents : 0,
    };
  }

  async unwind(hedgeOrderId: string): Promise<void> {
    const activity = this.activity.find((item) => item.id === hedgeOrderId);
    if (activity) activity.status = "UNWOUND";
  }
}
