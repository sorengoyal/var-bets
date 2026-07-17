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
  readonly totals = {
    goal: { count: 0, notionalCents: 0 },
    noGoal: { count: 0, notionalCents: 0 },
  };
  elapsedSecond = 0;
  argPrice = 0.4272;
  egyPrice = 0.5318;
  private orderCount = 0;

  async execute(
    order: BetOrder,
    _snapshot: MarketSnapshot,
  ): Promise<HedgeResult> {
    const hedgeOrderId = `sim_hedge_${randomUUID()}`;
    this.orderCount += 1;
    const filled = this.orderCount % 10 !== 0;
    const venuePrice = order.side === Side.GOAL ? this.egyPrice : this.argPrice;
    const expectedExitPrice = order.side === Side.GOAL ? 0.7557 : 0.5045;
    const expectedPriceMove = Math.max(expectedExitPrice - venuePrice, 0.02);
    const uncoveredLiability = Math.max(
      0,
      order.potentialPayoutCents - order.stakeCents,
    );
    const expectedHedgeProfitCents = Math.round(uncoveredLiability * 0.15);
    const hedgeNotionalCents = Math.round(
      (expectedHedgeProfitCents / expectedPriceMove) * venuePrice,
    );
    const executionCostCents = Math.round(hedgeNotionalCents * 0.006);

    this.activity.unshift({
      id: hedgeOrderId,
      second: this.elapsedSecond,
      timeLabel: clockLabel(this.elapsedSecond),
      side: order.side,
      notional: hedgeNotionalCents / 100,
      venuePrice,
      status: filled ? "FILLED" : "REJECTED",
    });
    this.activity.splice(30);

    if (filled) {
      const total =
        order.side === Side.GOAL ? this.totals.goal : this.totals.noGoal;
      total.count += 1;
      total.notionalCents += hedgeNotionalCents;
    }

    return {
      hedgeOrderId,
      filled,
      payoffIfGoalCents:
        filled && order.side === Side.GOAL ? expectedHedgeProfitCents : 0,
      payoffIfNoGoalCents:
        filled && order.side === Side.NO_GOAL ? expectedHedgeProfitCents : 0,
      reservedCostCents: filled ? executionCostCents : 0,
    };
  }

  async unwind(hedgeOrderId: string): Promise<void> {
    const activity = this.activity.find((item) => item.id === hedgeOrderId);
    if (activity) activity.status = "UNWOUND";
  }
}
