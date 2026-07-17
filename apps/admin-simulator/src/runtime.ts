import { randomInt, randomUUID } from "node:crypto";
import type {
  BetActivity,
  DashboardSnapshot,
  PricePoint,
} from "@var-bets/dashboard-contract";
import {
  BetExecutionEngine,
  ExecutionError,
  InMemoryLedger,
  InMemoryPayments,
  MutableMarketData,
  OrderStatus,
  Side,
  centsFromDollars,
  profitIfGoalCents,
  profitIfNoGoalCents,
  worstCaseProfitCents,
} from "@var-bets/execution-engine";
import {
  REVIEW_DECISION_SECOND,
  clockLabel,
  goalSignalProbability,
  polymarketPoint,
} from "./polymarket-path.ts";
import { SimulatedPolymarketHedge } from "./simulated-hedge.ts";

const MARKET_ID = "arg-egy-var-20260707";
const MODEL = {
  scenarioId: 10,
  simulations: 5000,
  meanProfit: 1321.6525690596134,
  medianProfit: 1273.8611246834907,
  p5Profit: 549.0773196707566,
  p1Profit: 251.17899917571572,
  worstProfit: -429.8981784263222,
  lossProbability: 0.0028,
  p99Liability: 1000,
  baseOverround: 0.25,
  minimumBookMargin: 0.2,
  maximumUnhedgedLoss: 1000,
  minimumDecimalOdds: 1.05,
};

class SeededRandom {
  private state: number;

  constructor(state: number) {
    this.state = state;
  }

  next(): number {
    this.state = (this.state * 1664525 + 1013904223) >>> 0;
    return this.state / 4294967296;
  }

  integer(minimum: number, maximum: number): number {
    return Math.floor(this.next() * (maximum - minimum + 1)) + minimum;
  }
}

export class SimulationRuntime {
  private readonly tickMilliseconds: number;
  private sequence = 0;
  private elapsedSecond = 0;
  private requestedHandleCents = 0;
  private rejectedHandleCents = 0;
  private goalRequestedCents = 0;
  private noGoalRequestedCents = 0;
  private rejectedBets = 0;
  private settled = false;
  private runMode: "REPEAT" | "RANDOM" = "REPEAT";
  private runSeed = 20260707;
  private timer: NodeJS.Timeout | null = null;
  private readonly history: PricePoint[] = [];
  private readonly recentBets: BetActivity[] = [];
  private random = new SeededRandom(20260707);
  private ledger!: InMemoryLedger;
  private marketData!: MutableMarketData;
  private payments!: InMemoryPayments;
  private hedging!: SimulatedPolymarketHedge;
  private engine!: BetExecutionEngine;

  constructor(tickMilliseconds: number) {
    this.tickMilliseconds = tickMilliseconds;
    this.reset();
  }

  start(): void {
    if (this.timer !== null) return;
    this.timer = setInterval(() => void this.tick(), this.tickMilliseconds);
  }

  pause(): void {
    if (this.timer === null) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  reset(mode: "repeat" | "random" = "repeat"): void {
    this.pause();
    this.sequence = 0;
    this.elapsedSecond = 0;
    this.requestedHandleCents = 0;
    this.rejectedHandleCents = 0;
    this.goalRequestedCents = 0;
    this.noGoalRequestedCents = 0;
    this.rejectedBets = 0;
    this.settled = false;
    this.history.splice(0);
    this.recentBets.splice(0);
    this.runMode = mode === "random" ? "RANDOM" : "REPEAT";
    this.runSeed = mode === "random" ? randomInt(1, 0x7fffffff) : 20260707;
    this.random = new SeededRandom(this.runSeed);
    const point = polymarketPoint(0);
    const now = new Date();
    this.ledger = new InMemoryLedger();
    this.marketData = new MutableMarketData({
      marketId: MARKET_ID,
      goalProbability: goalSignalProbability(point.argProbability),
      sourceVersion: "sim:0",
      observedAt: now,
      bettingClosesAt: new Date(now.getTime() + 10 * 60_000),
      isOpen: true,
    });
    this.payments = new InMemoryPayments();
    this.hedging = new SimulatedPolymarketHedge();
    this.hedging.argPrice = point.argProbability / 100;
    this.hedging.egyPrice = point.egyProbability / 100;
    this.engine = new BetExecutionEngine({
      config: {
        baseOverround: MODEL.baseOverround,
        inventorySensitivity: 0.08,
        minimumBookMargin: MODEL.minimumBookMargin,
        minimumDecimalOdds: MODEL.minimumDecimalOdds,
        maximumDecimalOdds: 20,
        minimumStakeCents: 100,
        maximumStakeCents: 50_000,
        maximumUnhedgedLossCents: centsFromDollars(MODEL.maximumUnhedgedLoss),
        quoteTtlMs: 800,
        requireHedgeFill: true,
      },
      signingSecret: "simulation-only-signing-secret",
      marketData: this.marketData,
      payments: this.payments,
      hedging: this.hedging,
      ledger: this.ledger,
    });
    this.history.push(point);
  }

  async tick(): Promise<void> {
    if (this.settled) return;
    this.elapsedSecond += 1;
    this.sequence += 1;
    const point = polymarketPoint(this.elapsedSecond);
    const now = new Date();
    this.history.push(point);
    this.history.splice(0, Math.max(0, this.history.length - 140));
    this.marketData.update({
      goalProbability: goalSignalProbability(point.argProbability),
      sourceVersion: `sim:${this.sequence}`,
      observedAt: now,
    });
    this.hedging.elapsedSecond = this.elapsedSecond;
    this.hedging.argPrice = point.argProbability / 100;
    this.hedging.egyPrice = point.egyProbability / 100;

    const betCount = this.random.integer(3, 11);
    for (let index = 0; index < betCount; index += 1) {
      await this.placeRandomBet(index);
    }

    if (this.elapsedSecond >= REVIEW_DECISION_SECOND) {
      this.marketData.update({ isOpen: false, bettingClosesAt: now });
      await this.engine.settleMarket(
        MARKET_ID,
        Side.NO_GOAL,
        "arg-egy-no-goal-59-45",
      );
      this.settled = true;
      this.pause();
    }
  }

  async snapshot(): Promise<DashboardSnapshot> {
    const point = polymarketPoint(this.elapsedSecond);
    const book = await this.ledger.getBook(MARKET_ID);
    const orders = await this.ledger.listOrders(MARKET_ID);
    const acceptedOrders = orders.filter(
      (order) =>
        order.status === OrderStatus.ACCEPTED ||
        order.status === OrderStatus.SETTLEMENT_PENDING ||
        order.status === OrderStatus.SETTLED,
    );
    const goalOrders = acceptedOrders.filter(
      (order) => order.side === Side.GOAL,
    );
    const noGoalOrders = acceptedOrders.filter(
      (order) => order.side === Side.NO_GOAL,
    );
    const latestGoal = [...this.recentBets].find(
      (bet) => bet.side === Side.GOAL && bet.accepted,
    );
    const latestNoGoal = [...this.recentBets].find(
      (bet) => bet.side === Side.NO_GOAL && bet.accepted,
    );
    const requestedTotal = Math.max(this.requestedHandleCents, 1);

    return {
      schemaVersion: 1,
      sequence: this.sequence,
      generatedAt: new Date().toISOString(),
      mode: "SIMULATION",
      source: "Execution engine + interpolated Polymarket replay",
      fixture: {
        competition: "FIFA WORLD CUP",
        homeTeam: "Argentina",
        awayTeam: "Egypt",
        homeScore: 0,
        awayScore: this.settled ? 1 : 2,
        matchClock: clockLabel(this.elapsedSecond),
      },
      market: {
        id: MARKET_ID,
        title: "Argentina advances vs Egypt advances",
        elapsedSeconds: this.elapsedSecond,
        argProbability: point.argProbability,
        egyProbability: point.egyProbability,
        goalSignalProbability: goalSignalProbability(point.argProbability),
        history: [...this.history],
      },
      pool: {
        id: "20260707",
        status: this.settled ? "SETTLED" : "OPEN",
        outcome: this.settled ? "NO_GOAL" : null,
        acceptedHandle: book.acceptedHandleCents / 100,
        rejectedHandle: this.rejectedHandleCents / 100,
        requestedHandle: this.requestedHandleCents / 100,
        acceptedBets: acceptedOrders.length,
        rejectedBets: this.rejectedBets,
        goalRequestedShare: this.goalRequestedCents / requestedTotal,
        noGoalRequestedShare: this.noGoalRequestedCents / requestedTotal,
        goalOdds: latestGoal?.odds ?? 0,
        noGoalOdds: latestNoGoal?.odds ?? 0,
        payoutIfGoal: book.payoutIfGoalCents / 100,
        payoutIfNoGoal: book.payoutIfNoGoalCents / 100,
        hedgePayoffIfGoal: book.hedgePayoffIfGoalCents / 100,
        hedgePayoffIfNoGoal: book.hedgePayoffIfNoGoalCents / 100,
        executionCost: book.reservedExecutionCostCents / 100,
        profitIfGoal: profitIfGoalCents(book) / 100,
        profitIfNoGoal: profitIfNoGoalCents(book) / 100,
        worstCaseProfit: worstCaseProfitCents(book) / 100,
      },
      model: {
        ...MODEL,
        runMode: this.runMode,
        runSeed: this.runSeed,
      },
      settlement: {
        userGoalBets: {
          count: goalOrders.length,
          amount:
            goalOrders.reduce((total, order) => total + order.stakeCents, 0) /
            100,
        },
        userNoGoalBets: {
          count: noGoalOrders.length,
          amount:
            noGoalOrders.reduce((total, order) => total + order.stakeCents, 0) /
            100,
        },
        polymarketGoalHedges: {
          count: this.hedging.totals.goal.count,
          amount: this.hedging.totals.goal.notionalCents / 100,
        },
        polymarketNoGoalHedges: {
          count: this.hedging.totals.noGoal.count,
          amount: this.hedging.totals.noGoal.notionalCents / 100,
        },
        totalPayout: (this.settled ? book.payoutIfNoGoalCents : 0) / 100,
        totalProfit:
          (this.settled
            ? profitIfNoGoalCents(book)
            : worstCaseProfitCents(book)) / 100,
      },
      recentBets: [...this.recentBets],
      recentHedges: [...this.hedging.activity],
    };
  }

  private async placeRandomBet(index: number): Promise<void> {
    const side = this.random.next() < 0.5 ? Side.GOAL : Side.NO_GOAL;
    const baseStake = 2 + Math.pow(this.random.next(), 2.1) * 38;
    const stake = Math.round(baseStake * 100) / 100;
    const stakeCents = centsFromDollars(stake);
    this.requestedHandleCents += stakeCents;
    if (side === Side.GOAL) this.goalRequestedCents += stakeCents;
    else this.noGoalRequestedCents += stakeCents;

    let odds: number | null = null;
    let accepted = false;
    try {
      const quote = await this.engine.createQuote({
        marketId: MARKET_ID,
        userId: `sim_user_${this.elapsedSecond}_${index}`,
        side,
        stakeCents,
      });
      odds = quote.decimalOdds;
      if (quote.accepted) {
        const order = await this.engine.executeQuote(
          quote.quoteId,
          `sim:${this.elapsedSecond}:${index}:${randomUUID()}`,
        );
        accepted = order.status === OrderStatus.ACCEPTED;
      }
    } catch (error) {
      if (!(error instanceof ExecutionError)) throw error;
    }

    if (!accepted) {
      this.rejectedHandleCents += stakeCents;
      this.rejectedBets += 1;
    }
    this.recentBets.unshift({
      id: `bet_${this.sequence}_${index}`,
      second: this.elapsedSecond,
      side,
      stake,
      odds,
      accepted,
    });
    this.recentBets.splice(40);
  }
}
