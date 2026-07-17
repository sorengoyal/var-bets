import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export const Side = {
  GOAL: "GOAL",
  NO_GOAL: "NO_GOAL",
} as const;

export type Side = (typeof Side)[keyof typeof Side];

export const OrderStatus = {
  RISK_RESERVED: "RISK_RESERVED",
  PAYMENT_AUTHORIZED: "PAYMENT_AUTHORIZED",
  HEDGED: "HEDGED",
  ACCEPTED: "ACCEPTED",
  REJECTED: "REJECTED",
  FAILED: "FAILED",
  SETTLEMENT_PENDING: "SETTLEMENT_PENDING",
  SETTLED: "SETTLED",
  VOIDED: "VOIDED",
} as const;

export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];
export type Cents = number;

export function centsFromDollars(value: number): Cents {
  return Math.round(value * 100);
}

export function dollarsFromCents(value: Cents): string {
  return (value / 100).toFixed(2);
}

function roundOdds(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export interface EngineConfigJson {
  base_overround: number;
  inventory_sensitivity: number;
  minimum_book_margin: number;
  minimum_decimal_odds: number;
  maximum_decimal_odds: number;
  minimum_stake: number;
  maximum_stake: number;
  maximum_unhedged_loss: number;
  quote_ttl_ms: number;
  require_hedge_fill: boolean;
}

export interface EngineConfig {
  baseOverround: number;
  inventorySensitivity: number;
  minimumBookMargin: number;
  minimumDecimalOdds: number;
  maximumDecimalOdds: number;
  minimumStakeCents: Cents;
  maximumStakeCents: Cents;
  maximumUnhedgedLossCents: Cents;
  quoteTtlMs: number;
  requireHedgeFill: boolean;
}

export function engineConfigFromJson(values: EngineConfigJson): EngineConfig {
  return {
    baseOverround: values.base_overround,
    inventorySensitivity: values.inventory_sensitivity,
    minimumBookMargin: values.minimum_book_margin,
    minimumDecimalOdds: values.minimum_decimal_odds,
    maximumDecimalOdds: values.maximum_decimal_odds,
    minimumStakeCents: centsFromDollars(values.minimum_stake),
    maximumStakeCents: centsFromDollars(values.maximum_stake),
    maximumUnhedgedLossCents: centsFromDollars(values.maximum_unhedged_loss),
    quoteTtlMs: values.quote_ttl_ms,
    requireHedgeFill: values.require_hedge_fill,
  };
}

export interface MarketSnapshot {
  marketId: string;
  goalProbability: number;
  sourceVersion: string;
  observedAt: Date;
  bettingClosesAt: Date;
  isOpen: boolean;
}

export interface BookState {
  marketId: string;
  acceptedHandleCents: Cents;
  payoutIfGoalCents: Cents;
  payoutIfNoGoalCents: Cents;
  hedgePayoffIfGoalCents: Cents;
  hedgePayoffIfNoGoalCents: Cents;
  reservedExecutionCostCents: Cents;
}

export function emptyBook(marketId: string): BookState {
  return {
    marketId,
    acceptedHandleCents: 0,
    payoutIfGoalCents: 0,
    payoutIfNoGoalCents: 0,
    hedgePayoffIfGoalCents: 0,
    hedgePayoffIfNoGoalCents: 0,
    reservedExecutionCostCents: 0,
  };
}

export function profitIfGoalCents(book: BookState): Cents {
  return (
    book.acceptedHandleCents -
    book.payoutIfGoalCents +
    book.hedgePayoffIfGoalCents -
    book.reservedExecutionCostCents
  );
}

export function profitIfNoGoalCents(book: BookState): Cents {
  return (
    book.acceptedHandleCents -
    book.payoutIfNoGoalCents +
    book.hedgePayoffIfNoGoalCents -
    book.reservedExecutionCostCents
  );
}

export function worstCaseProfitCents(book: BookState): Cents {
  return Math.min(profitIfGoalCents(book), profitIfNoGoalCents(book));
}

export interface QuoteRequest {
  marketId: string;
  userId: string;
  side: Side;
  stakeCents: Cents;
}

export interface Quote {
  quoteId: string;
  marketId: string;
  userId: string;
  side: Side;
  stakeCents: Cents;
  decimalOdds: number | null;
  potentialPayoutCents: Cents | null;
  goalProbability: number;
  marketSourceVersion: string;
  createdAt: Date;
  expiresAt: Date;
  accepted: boolean;
  rejectionReason: string | null;
  signature: string;
}

export interface BetOrder {
  orderId: string;
  idempotencyKey: string;
  quoteId: string;
  marketId: string;
  userId: string;
  side: Side;
  stakeCents: Cents;
  decimalOdds: number;
  potentialPayoutCents: Cents;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
  paymentAuthorizationId: string | null;
  hedgeOrderId: string | null;
  settlementEventId: string | null;
  payoutTransactionId: string | null;
  failureReason: string | null;
}

export interface HedgeResult {
  hedgeOrderId: string;
  filled: boolean;
  payoffIfGoalCents: Cents;
  payoffIfNoGoalCents: Cents;
  reservedCostCents: Cents;
}

export interface MarketDataPort {
  latestSnapshot(marketId: string): Promise<MarketSnapshot>;
}

export interface PaymentPort {
  authorize(
    userId: string,
    amountCents: Cents,
    idempotencyKey: string,
  ): Promise<string>;
  capture(authorizationId: string, idempotencyKey: string): Promise<string>;
  void(authorizationId: string, idempotencyKey: string): Promise<void>;
  creditPayout(
    userId: string,
    amountCents: Cents,
    idempotencyKey: string,
  ): Promise<string>;
}

export interface HedgePort {
  execute(order: BetOrder, snapshot: MarketSnapshot): Promise<HedgeResult>;
  unwind(hedgeOrderId: string, idempotencyKey: string): Promise<void>;
}

export interface LedgerPort {
  withMarketLock<T>(marketId: string, operation: () => Promise<T>): Promise<T>;
  getBook(marketId: string): Promise<BookState>;
  saveBook(book: BookState): Promise<void>;
  saveQuote(quote: Quote): Promise<void>;
  getQuote(quoteId: string): Promise<Quote | null>;
  saveOrder(order: BetOrder): Promise<void>;
  getOrderByIdempotencyKey(key: string): Promise<BetOrder | null>;
  getOrderByQuoteId(quoteId: string): Promise<BetOrder | null>;
  listOrders(marketId: string): Promise<BetOrder[]>;
  closeMarket(marketId: string, settlementEventId: string): Promise<boolean>;
}

export class ExecutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExecutionError";
  }
}

export class BetExecutionEngine {
  private readonly config: EngineConfig;
  private readonly signingSecret: string;
  private readonly marketData: MarketDataPort;
  private readonly payments: PaymentPort;
  private readonly hedging: HedgePort;
  private readonly ledger: LedgerPort;

  constructor(options: {
    config: EngineConfig;
    signingSecret: string;
    marketData: MarketDataPort;
    payments: PaymentPort;
    hedging: HedgePort;
    ledger: LedgerPort;
  }) {
    this.config = options.config;
    this.signingSecret = options.signingSecret;
    this.marketData = options.marketData;
    this.payments = options.payments;
    this.hedging = options.hedging;
    this.ledger = options.ledger;
  }

  async createQuote(request: QuoteRequest): Promise<Quote> {
    const snapshot = await this.marketData.latestSnapshot(request.marketId);
    const now = new Date();
    let rejectionReason = this.validateQuoteRequest(
      request.stakeCents,
      snapshot,
      now,
    );

    return this.ledger.withMarketLock(request.marketId, async () => {
      const book = await this.ledger.getBook(request.marketId);
      let offeredOdds: number | null = null;
      if (rejectionReason === null) {
        const requestedOdds = this.inventoryAdjustedOdds(
          snapshot.goalProbability,
          request.side,
          book,
        );
        offeredOdds = this.riskCappedOdds(
          requestedOdds,
          request.side,
          request.stakeCents,
          book,
        );
        if (offeredOdds === null) {
          rejectionReason = "RISK_LIMIT_OR_MINIMUM_ODDS";
        }
      }

      const quote = this.buildQuote({
        request,
        snapshot,
        now,
        offeredOdds,
        rejectionReason,
      });
      await this.ledger.saveQuote(quote);
      return quote;
    });
  }

  async executeQuote(
    quoteId: string,
    idempotencyKey: string,
  ): Promise<BetOrder> {
    const idempotentOrder =
      await this.ledger.getOrderByIdempotencyKey(idempotencyKey);
    if (idempotentOrder !== null) return idempotentOrder;

    const quote = await this.ledger.getQuote(quoteId);
    if (quote === null || !this.validSignature(quote)) {
      throw new ExecutionError("INVALID_QUOTE");
    }
    if (
      !quote.accepted ||
      quote.decimalOdds === null ||
      quote.potentialPayoutCents === null
    ) {
      throw new ExecutionError(quote.rejectionReason ?? "QUOTE_REJECTED");
    }

    const snapshot = await this.marketData.latestSnapshot(quote.marketId);
    const now = new Date();
    if (now.getTime() > quote.expiresAt.getTime()) {
      throw new ExecutionError("QUOTE_EXPIRED");
    }
    if (
      !snapshot.isOpen ||
      now.getTime() >= snapshot.bettingClosesAt.getTime()
    ) {
      throw new ExecutionError("MARKET_CLOSED");
    }

    let order: BetOrder = {
      orderId: randomUUID(),
      idempotencyKey,
      quoteId: quote.quoteId,
      marketId: quote.marketId,
      userId: quote.userId,
      side: quote.side,
      stakeCents: quote.stakeCents,
      decimalOdds: quote.decimalOdds,
      potentialPayoutCents: quote.potentialPayoutCents,
      status: OrderStatus.RISK_RESERVED,
      createdAt: now,
      updatedAt: now,
      paymentAuthorizationId: null,
      hedgeOrderId: null,
      settlementEventId: null,
      payoutTransactionId: null,
      failureReason: null,
    };

    const reservation = await this.ledger.withMarketLock(
      order.marketId,
      async () => {
        const existingByKey =
          await this.ledger.getOrderByIdempotencyKey(idempotencyKey);
        if (existingByKey !== null) {
          return { order: existingByKey, shouldExecute: false };
        }
        const existingByQuote = await this.ledger.getOrderByQuoteId(quoteId);
        if (existingByQuote !== null) {
          return { order: existingByQuote, shouldExecute: false };
        }

        const book = await this.ledger.getBook(order.marketId);
        const projected = this.applyOrderToBook(book, order);
        if (
          worstCaseProfitCents(projected) < this.minimumBookProfit(projected)
        ) {
          throw new ExecutionError("RISK_CHANGED_REQUOTE_REQUIRED");
        }
        await this.ledger.saveBook(projected);
        await this.ledger.saveOrder(order);
        return { order, shouldExecute: true };
      },
    );

    order = reservation.order;
    if (!reservation.shouldExecute) return order;

    let authorizationId: string | null = null;
    let hedgeResult: HedgeResult | null = null;
    try {
      authorizationId = await this.payments.authorize(
        order.userId,
        order.stakeCents,
        `authorize:${order.idempotencyKey}`,
      );
      order = await this.updateOrder(order, {
        status: OrderStatus.PAYMENT_AUTHORIZED,
        paymentAuthorizationId: authorizationId,
      });

      hedgeResult = await this.hedging.execute(order, snapshot);
      if (this.config.requireHedgeFill && !hedgeResult.filled) {
        throw new ExecutionError("HEDGE_NOT_FILLED");
      }
      order = await this.updateOrder(order, {
        status: OrderStatus.HEDGED,
        hedgeOrderId: hedgeResult.hedgeOrderId,
      });

      await this.payments.capture(
        authorizationId,
        `capture:${order.idempotencyKey}`,
      );
      const completedHedge = hedgeResult;
      if (completedHedge === null) {
        throw new ExecutionError("MISSING_HEDGE_RESULT");
      }
      return this.ledger.withMarketLock(order.marketId, async () => {
        const book = await this.ledger.getBook(order.marketId);
        await this.ledger.saveBook({
          ...book,
          hedgePayoffIfGoalCents:
            book.hedgePayoffIfGoalCents + completedHedge.payoffIfGoalCents,
          hedgePayoffIfNoGoalCents:
            book.hedgePayoffIfNoGoalCents + completedHedge.payoffIfNoGoalCents,
          reservedExecutionCostCents:
            book.reservedExecutionCostCents + completedHedge.reservedCostCents,
        });
        order = await this.updateOrder(order, {
          status: OrderStatus.ACCEPTED,
        });
        return order;
      });
    } catch (error) {
      if (hedgeResult?.filled) {
        await this.hedging.unwind(
          hedgeResult.hedgeOrderId,
          `unwind:${order.idempotencyKey}`,
        );
      }
      if (authorizationId !== null) {
        await this.payments.void(
          authorizationId,
          `void:${order.idempotencyKey}`,
        );
      }
      await this.rollbackReservedOrder(
        order,
        error instanceof Error ? error.message : String(error),
      );
      if (error instanceof ExecutionError) throw error;
      throw new ExecutionError("ORDER_EXECUTION_FAILED");
    }
  }

  async settleMarket(
    marketId: string,
    result: Side,
    settlementEventId: string,
  ): Promise<BetOrder[]> {
    const pending = await this.ledger.withMarketLock(marketId, async () => {
      const firstProcessing = await this.ledger.closeMarket(
        marketId,
        settlementEventId,
      );
      if (!firstProcessing) return this.ledger.listOrders(marketId);

      const orders = await this.ledger.listOrders(marketId);
      const settlementPending: BetOrder[] = [];
      for (const order of orders) {
        if (order.status !== OrderStatus.ACCEPTED) continue;
        settlementPending.push(
          await this.updateOrder(order, {
            status: OrderStatus.SETTLEMENT_PENDING,
            settlementEventId,
          }),
        );
      }
      return settlementPending;
    });

    const settled: BetOrder[] = [];
    for (let order of pending) {
      if (order.status !== OrderStatus.SETTLEMENT_PENDING) {
        settled.push(order);
        continue;
      }
      const payoutCents =
        order.side === result ? order.potentialPayoutCents : 0;
      try {
        let payoutTransactionId: string | null = null;
        if (payoutCents > 0) {
          payoutTransactionId = await this.payments.creditPayout(
            order.userId,
            payoutCents,
            `payout:${settlementEventId}:${order.orderId}`,
          );
        }
        order = await this.updateOrder(order, {
          status: OrderStatus.SETTLED,
          payoutTransactionId,
          failureReason: null,
        });
      } catch (error) {
        order = await this.updateOrder(order, {
          status: OrderStatus.SETTLEMENT_PENDING,
          failureReason: error instanceof Error ? error.message : String(error),
        });
      }
      settled.push(order);
    }
    return settled;
  }

  private validateQuoteRequest(
    stakeCents: Cents,
    snapshot: MarketSnapshot,
    now: Date,
  ): string | null {
    if (!Number.isSafeInteger(stakeCents)) return "INVALID_STAKE";
    if (
      !snapshot.isOpen ||
      now.getTime() >= snapshot.bettingClosesAt.getTime()
    ) {
      return "MARKET_CLOSED";
    }
    if (stakeCents < this.config.minimumStakeCents) {
      return "BELOW_MINIMUM_STAKE";
    }
    if (stakeCents > this.config.maximumStakeCents) {
      return "ABOVE_MAXIMUM_STAKE";
    }
    if (snapshot.goalProbability <= 0 || snapshot.goalProbability >= 1) {
      return "INVALID_MARKET_PROBABILITY";
    }
    return null;
  }

  private inventoryAdjustedOdds(
    goalProbability: number,
    side: Side,
    book: BookState,
  ): number {
    const imbalance = clamp(
      (book.payoutIfGoalCents - book.payoutIfNoGoalCents) /
        Math.max(this.config.maximumUnhedgedLossCents, 1),
      -1,
      1,
    );
    const overroundMultiplier = 1 + this.config.baseOverround;
    const goalQuoteProbability =
      goalProbability * overroundMultiplier +
      this.config.inventorySensitivity * imbalance;
    const noGoalQuoteProbability =
      (1 - goalProbability) * overroundMultiplier -
      this.config.inventorySensitivity * imbalance;
    const selected = clamp(
      side === Side.GOAL ? goalQuoteProbability : noGoalQuoteProbability,
      0.01,
      0.99,
    );
    return roundOdds(1 / selected);
  }

  private riskCappedOdds(
    requestedOdds: number,
    side: Side,
    stakeCents: Cents,
    book: BookState,
  ): number | null {
    const projectedHandleCents = book.acceptedHandleCents + stakeCents;
    const existingPayoutCents =
      side === Side.GOAL ? book.payoutIfGoalCents : book.payoutIfNoGoalCents;
    const hedgePayoffCents =
      side === Side.GOAL
        ? book.hedgePayoffIfGoalCents
        : book.hedgePayoffIfNoGoalCents;
    const maximumSafePayoutCents =
      projectedHandleCents +
      hedgePayoffCents -
      book.reservedExecutionCostCents -
      this.minimumBookProfit({
        ...book,
        acceptedHandleCents: projectedHandleCents,
      });
    const maximumSafeOdds = roundOdds(
      (maximumSafePayoutCents - existingPayoutCents) / stakeCents,
    );
    const offeredOdds = Math.min(
      requestedOdds,
      maximumSafeOdds,
      this.config.maximumDecimalOdds,
    );
    if (offeredOdds < this.config.minimumDecimalOdds) return null;
    return roundOdds(offeredOdds);
  }

  private minimumBookProfit(book: BookState): Cents {
    return (
      Math.round(book.acceptedHandleCents * this.config.minimumBookMargin) -
      this.config.maximumUnhedgedLossCents
    );
  }

  private buildQuote(options: {
    request: QuoteRequest;
    snapshot: MarketSnapshot;
    now: Date;
    offeredOdds: number | null;
    rejectionReason: string | null;
  }): Quote {
    const unsigned: Quote = {
      quoteId: randomUUID(),
      marketId: options.request.marketId,
      userId: options.request.userId,
      side: options.request.side,
      stakeCents: options.request.stakeCents,
      decimalOdds: options.offeredOdds,
      potentialPayoutCents:
        options.offeredOdds === null
          ? null
          : Math.round(options.request.stakeCents * options.offeredOdds),
      goalProbability: options.snapshot.goalProbability,
      marketSourceVersion: options.snapshot.sourceVersion,
      createdAt: options.now,
      expiresAt: new Date(options.now.getTime() + this.config.quoteTtlMs),
      accepted:
        options.offeredOdds !== null && options.rejectionReason === null,
      rejectionReason: options.rejectionReason,
      signature: "",
    };
    return { ...unsigned, signature: this.signature(unsigned) };
  }

  private signature(quote: Quote): string {
    const payload = JSON.stringify({
      quoteId: quote.quoteId,
      marketId: quote.marketId,
      userId: quote.userId,
      side: quote.side,
      stakeCents: quote.stakeCents,
      decimalOdds: quote.decimalOdds,
      potentialPayoutCents: quote.potentialPayoutCents,
      marketSourceVersion: quote.marketSourceVersion,
      expiresAt: quote.expiresAt.toISOString(),
      accepted: quote.accepted,
    });
    return createHmac("sha256", this.signingSecret)
      .update(payload)
      .digest("hex");
  }

  private validSignature(quote: Quote): boolean {
    const expected = this.signature({ ...quote, signature: "" });
    if (expected.length !== quote.signature.length) return false;
    return timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(quote.signature, "hex"),
    );
  }

  private applyOrderToBook(book: BookState, order: BetOrder): BookState {
    return {
      ...book,
      acceptedHandleCents: book.acceptedHandleCents + order.stakeCents,
      payoutIfGoalCents:
        book.payoutIfGoalCents +
        (order.side === Side.GOAL ? order.potentialPayoutCents : 0),
      payoutIfNoGoalCents:
        book.payoutIfNoGoalCents +
        (order.side === Side.NO_GOAL ? order.potentialPayoutCents : 0),
    };
  }

  private removeOrderFromBook(book: BookState, order: BetOrder): BookState {
    return {
      ...book,
      acceptedHandleCents: book.acceptedHandleCents - order.stakeCents,
      payoutIfGoalCents:
        book.payoutIfGoalCents -
        (order.side === Side.GOAL ? order.potentialPayoutCents : 0),
      payoutIfNoGoalCents:
        book.payoutIfNoGoalCents -
        (order.side === Side.NO_GOAL ? order.potentialPayoutCents : 0),
    };
  }

  private async rollbackReservedOrder(
    order: BetOrder,
    reason: string,
  ): Promise<void> {
    await this.ledger.withMarketLock(order.marketId, async () => {
      const book = await this.ledger.getBook(order.marketId);
      await this.ledger.saveBook(this.removeOrderFromBook(book, order));
      await this.updateOrder(order, {
        status: OrderStatus.REJECTED,
        failureReason: reason,
      });
    });
  }

  private async updateOrder(
    order: BetOrder,
    values: Partial<BetOrder>,
  ): Promise<BetOrder> {
    const updated = { ...order, ...values, updatedAt: new Date() };
    await this.ledger.saveOrder(updated);
    return updated;
  }
}

export class InMemoryLedger implements LedgerPort {
  private readonly books = new Map<string, BookState>();
  private readonly quotes = new Map<string, Quote>();
  private readonly orders = new Map<string, BetOrder>();
  private readonly idempotency = new Map<string, string>();
  private readonly quoteOrders = new Map<string, string>();
  private readonly locks = new Map<string, Promise<void>>();
  private readonly closedMarkets = new Map<string, string>();

  async withMarketLock<T>(
    marketId: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const previous = this.locks.get(marketId) ?? Promise.resolve();
    let release = (): void => undefined;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const queue = previous.then(() => current);
    this.locks.set(marketId, queue);
    await previous;
    try {
      return await operation();
    } finally {
      release();
      if (this.locks.get(marketId) === queue) this.locks.delete(marketId);
    }
  }

  async getBook(marketId: string): Promise<BookState> {
    const existing = this.books.get(marketId);
    if (existing !== undefined) return existing;
    const created = emptyBook(marketId);
    this.books.set(marketId, created);
    return created;
  }

  async saveBook(book: BookState): Promise<void> {
    this.books.set(book.marketId, book);
  }

  async saveQuote(quote: Quote): Promise<void> {
    this.quotes.set(quote.quoteId, quote);
  }

  async getQuote(quoteId: string): Promise<Quote | null> {
    return this.quotes.get(quoteId) ?? null;
  }

  async saveOrder(order: BetOrder): Promise<void> {
    this.orders.set(order.orderId, order);
    this.idempotency.set(order.idempotencyKey, order.orderId);
    this.quoteOrders.set(order.quoteId, order.orderId);
  }

  async getOrderByIdempotencyKey(key: string): Promise<BetOrder | null> {
    const orderId = this.idempotency.get(key);
    return orderId === undefined ? null : (this.orders.get(orderId) ?? null);
  }

  async getOrderByQuoteId(quoteId: string): Promise<BetOrder | null> {
    const orderId = this.quoteOrders.get(quoteId);
    return orderId === undefined ? null : (this.orders.get(orderId) ?? null);
  }

  async listOrders(marketId: string): Promise<BetOrder[]> {
    return [...this.orders.values()].filter(
      (order) => order.marketId === marketId,
    );
  }

  async closeMarket(
    marketId: string,
    settlementEventId: string,
  ): Promise<boolean> {
    if (this.closedMarkets.has(marketId)) return false;
    this.closedMarkets.set(marketId, settlementEventId);
    return true;
  }
}

export class MutableMarketData implements MarketDataPort {
  private snapshot: MarketSnapshot;

  constructor(snapshot: MarketSnapshot) {
    this.snapshot = snapshot;
  }

  async latestSnapshot(marketId: string): Promise<MarketSnapshot> {
    if (this.snapshot.marketId !== marketId) {
      throw new ExecutionError("UNKNOWN_MARKET");
    }
    return this.snapshot;
  }

  update(values: Partial<MarketSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...values };
  }
}

export class InMemoryPayments implements PaymentPort {
  private readonly authorizations = new Map<
    string,
    { userId: string; amountCents: Cents; idempotencyKey: string }
  >();
  private readonly captures = new Map<string, string>();
  private readonly payouts = new Map<
    string,
    { transactionId: string; amountCents: Cents }
  >();

  async authorize(
    userId: string,
    amountCents: Cents,
    idempotencyKey: string,
  ): Promise<string> {
    const authorizationId = `auth_${randomUUID()}`;
    this.authorizations.set(authorizationId, {
      userId,
      amountCents,
      idempotencyKey,
    });
    return authorizationId;
  }

  async capture(
    authorizationId: string,
    idempotencyKey: string,
  ): Promise<string> {
    if (!this.authorizations.has(authorizationId)) {
      throw new ExecutionError("UNKNOWN_AUTHORIZATION");
    }
    const existing = this.captures.get(idempotencyKey);
    if (existing !== undefined) return existing;
    const captureId = `capture_${randomUUID()}`;
    this.captures.set(idempotencyKey, captureId);
    return captureId;
  }

  async void(authorizationId: string): Promise<void> {
    this.authorizations.delete(authorizationId);
  }

  async creditPayout(
    _userId: string,
    amountCents: Cents,
    idempotencyKey: string,
  ): Promise<string> {
    const existing = this.payouts.get(idempotencyKey);
    if (existing !== undefined) return existing.transactionId;
    const transactionId = `payout_${randomUUID()}`;
    this.payouts.set(idempotencyKey, { transactionId, amountCents });
    return transactionId;
  }
}

export class NoopHedge implements HedgePort {
  async execute(): Promise<HedgeResult> {
    return {
      hedgeOrderId: `hedge_${randomUUID()}`,
      filled: true,
      payoffIfGoalCents: 0,
      payoffIfNoGoalCents: 0,
      reservedCostCents: 0,
    };
  }

  async unwind(): Promise<void> {
    return undefined;
  }
}
