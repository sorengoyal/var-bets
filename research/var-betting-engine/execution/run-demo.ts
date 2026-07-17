import { readFile } from "node:fs/promises";

import {
  BetExecutionEngine,
  InMemoryLedger,
  InMemoryPayments,
  MutableMarketData,
  NoopHedge,
  Side,
  centsFromDollars,
  dollarsFromCents,
  engineConfigFromJson,
  type EngineConfigJson,
  type QuoteRequest,
} from "./engine.ts";

async function main(): Promise<void> {
  const configUrl = new URL("./config.example.json", import.meta.url);
  const config = engineConfigFromJson(
    JSON.parse(await readFile(configUrl, "utf8")) as EngineConfigJson,
  );
  const marketId = "argentina-egypt-var-57-55";
  const now = new Date();
  const marketData = new MutableMarketData({
    marketId,
    goalProbability: 0.8775,
    sourceVersion: "polymarket:2026-07-07T17:22:09Z",
    observedAt: now,
    bettingClosesAt: new Date(now.getTime() + 110_000),
    isOpen: true,
  });
  const ledger = new InMemoryLedger();
  const engine = new BetExecutionEngine({
    config,
    signingSecret: "replace-with-secret-manager-value",
    marketData,
    payments: new InMemoryPayments(),
    hedging: new NoopHedge(),
    ledger,
  });

  const requests: QuoteRequest[] = [
    {
      marketId,
      userId: "user-1",
      side: Side.GOAL,
      stakeCents: centsFromDollars(50),
    },
    {
      marketId,
      userId: "user-2",
      side: Side.NO_GOAL,
      stakeCents: centsFromDollars(75),
    },
    {
      marketId,
      userId: "user-3",
      side: Side.GOAL,
      stakeCents: centsFromDollars(120),
    },
  ];

  for (const [index, request] of requests.entries()) {
    const quote = await engine.createQuote(request);
    console.log(
      `quote=${quote.quoteId} side=${quote.side} stake=$${dollarsFromCents(quote.stakeCents)} odds=${quote.decimalOdds} accepted=${quote.accepted} reason=${quote.rejectionReason}`,
    );
    if (quote.accepted) {
      const order = await engine.executeQuote(
        quote.quoteId,
        `demo-order-${index + 1}`,
      );
      console.log(`order=${order.orderId} status=${order.status}`);
    }
  }

  marketData.update({ isOpen: false, bettingClosesAt: new Date() });
  const settled = await engine.settleMarket(
    marketId,
    Side.NO_GOAL,
    "official-var-decision-59-45",
  );
  for (const order of settled) {
    const payoutCents =
      order.side === Side.NO_GOAL ? order.potentialPayoutCents : 0;
    console.log(
      `settled_order=${order.orderId} side=${order.side} status=${order.status} payout=$${dollarsFromCents(payoutCents)}`,
    );
  }

  const book = await ledger.getBook(marketId);
  console.log(
    `book_handle=$${dollarsFromCents(book.acceptedHandleCents)} payout_goal=$${dollarsFromCents(book.payoutIfGoalCents)} payout_no_goal=$${dollarsFromCents(book.payoutIfNoGoalCents)}`,
  );
}

await main();
