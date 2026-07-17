import json
from datetime import timedelta
from decimal import Decimal
from pathlib import Path

from engine import (
    BetExecutionEngine,
    EngineConfig,
    InMemoryLedger,
    InMemoryPayments,
    MarketSnapshot,
    MutableMarketData,
    NoopHedge,
    QuoteRequest,
    Side,
    utc_now,
)


ROOT = Path(__file__).resolve().parent


def main() -> None:
    config = EngineConfig.from_dict(
        json.loads((ROOT / "config.example.json").read_text())
    )
    market_id = "argentina-egypt-var-57-55"
    snapshot = MarketSnapshot(
        market_id=market_id,
        goal_probability=Decimal("0.8775"),
        source_version="polymarket:2026-07-07T17:22:09Z",
        observed_at=utc_now(),
        betting_closes_at=utc_now() + timedelta(seconds=110),
        is_open=True,
    )
    market_data = MutableMarketData(snapshot)
    ledger = InMemoryLedger()
    payments = InMemoryPayments()
    engine = BetExecutionEngine(
        config=config,
        signing_secret="replace-with-secret-manager-value",
        market_data=market_data,
        payments=payments,
        hedging=NoopHedge(),
        ledger=ledger,
    )

    requests = [
        QuoteRequest(market_id, "user-1", Side.GOAL, Decimal("50")),
        QuoteRequest(market_id, "user-2", Side.NO_GOAL, Decimal("75")),
        QuoteRequest(market_id, "user-3", Side.GOAL, Decimal("120")),
    ]
    accepted_orders = []
    for index, request in enumerate(requests, start=1):
        quote = engine.create_quote(request)
        print(
            f"quote={quote.quote_id} side={quote.side.value} stake={quote.stake} "
            f"odds={quote.decimal_odds} accepted={quote.accepted} "
            f"reason={quote.rejection_reason}"
        )
        if quote.accepted:
            order = engine.execute_quote(quote.quote_id, f"demo-order-{index}")
            accepted_orders.append(order)
            print(f"order={order.order_id} status={order.status.value}")

    market_data.update(is_open=False, betting_closes_at=utc_now())
    settled = engine.settle_market(
        market_id=market_id,
        result=Side.NO_GOAL,
        settlement_event_id="official-var-decision-59-45",
    )
    for order in settled:
        payout = order.potential_payout if order.side == Side.NO_GOAL else Decimal("0")
        print(
            f"settled_order={order.order_id} side={order.side.value} "
            f"status={order.status.value} payout={payout}"
        )

    book = ledger.get_book(market_id)
    print(
        f"book_handle={book.accepted_handle} payout_goal={book.payout_if_goal} "
        f"payout_no_goal={book.payout_if_no_goal} "
        f"worst_case_profit={book.worst_case_profit()}"
    )


if __name__ == "__main__":
    main()
