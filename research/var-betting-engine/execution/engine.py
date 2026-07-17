from __future__ import annotations

import hashlib
import hmac
import json
import threading
import uuid
from contextlib import contextmanager
from dataclasses import dataclass, replace
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from enum import Enum
from typing import Iterator, Protocol


MONEY = Decimal("0.01")
ODDS = Decimal("0.0001")


def money(value: Decimal | str | int | float) -> Decimal:
    return Decimal(str(value)).quantize(MONEY, rounding=ROUND_HALF_UP)


def odds(value: Decimal | str | int | float) -> Decimal:
    return Decimal(str(value)).quantize(ODDS, rounding=ROUND_HALF_UP)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Side(str, Enum):
    GOAL = "GOAL"
    NO_GOAL = "NO_GOAL"


class OrderStatus(str, Enum):
    RISK_RESERVED = "RISK_RESERVED"
    PAYMENT_AUTHORIZED = "PAYMENT_AUTHORIZED"
    HEDGED = "HEDGED"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    FAILED = "FAILED"
    SETTLEMENT_PENDING = "SETTLEMENT_PENDING"
    SETTLED = "SETTLED"
    VOIDED = "VOIDED"


@dataclass(frozen=True)
class EngineConfig:
    base_overround: Decimal
    inventory_sensitivity: Decimal
    minimum_decimal_odds: Decimal
    maximum_decimal_odds: Decimal
    minimum_stake: Decimal
    maximum_stake: Decimal
    maximum_unhedged_loss: Decimal
    quote_ttl_ms: int
    require_hedge_fill: bool

    @classmethod
    def from_dict(cls, values: dict) -> "EngineConfig":
        return cls(
            base_overround=Decimal(str(values["base_overround"])),
            inventory_sensitivity=Decimal(str(values["inventory_sensitivity"])),
            minimum_decimal_odds=odds(values["minimum_decimal_odds"]),
            maximum_decimal_odds=odds(values["maximum_decimal_odds"]),
            minimum_stake=money(values["minimum_stake"]),
            maximum_stake=money(values["maximum_stake"]),
            maximum_unhedged_loss=money(values["maximum_unhedged_loss"]),
            quote_ttl_ms=int(values["quote_ttl_ms"]),
            require_hedge_fill=bool(values["require_hedge_fill"]),
        )


@dataclass(frozen=True)
class MarketSnapshot:
    market_id: str
    goal_probability: Decimal
    source_version: str
    observed_at: datetime
    betting_closes_at: datetime
    is_open: bool


@dataclass(frozen=True)
class BookState:
    market_id: str
    accepted_handle: Decimal = Decimal("0.00")
    payout_if_goal: Decimal = Decimal("0.00")
    payout_if_no_goal: Decimal = Decimal("0.00")
    hedge_payoff_if_goal: Decimal = Decimal("0.00")
    hedge_payoff_if_no_goal: Decimal = Decimal("0.00")
    reserved_execution_cost: Decimal = Decimal("0.00")

    def profit_if_goal(self) -> Decimal:
        return money(
            self.accepted_handle
            - self.payout_if_goal
            + self.hedge_payoff_if_goal
            - self.reserved_execution_cost
        )

    def profit_if_no_goal(self) -> Decimal:
        return money(
            self.accepted_handle
            - self.payout_if_no_goal
            + self.hedge_payoff_if_no_goal
            - self.reserved_execution_cost
        )

    def worst_case_profit(self) -> Decimal:
        return min(self.profit_if_goal(), self.profit_if_no_goal())


@dataclass(frozen=True)
class QuoteRequest:
    market_id: str
    user_id: str
    side: Side
    stake: Decimal


@dataclass(frozen=True)
class Quote:
    quote_id: str
    market_id: str
    user_id: str
    side: Side
    stake: Decimal
    decimal_odds: Decimal | None
    potential_payout: Decimal | None
    goal_probability: Decimal
    market_source_version: str
    created_at: datetime
    expires_at: datetime
    accepted: bool
    rejection_reason: str | None
    signature: str


@dataclass(frozen=True)
class BetOrder:
    order_id: str
    idempotency_key: str
    quote_id: str
    market_id: str
    user_id: str
    side: Side
    stake: Decimal
    decimal_odds: Decimal
    potential_payout: Decimal
    status: OrderStatus
    created_at: datetime
    updated_at: datetime
    payment_authorization_id: str | None = None
    hedge_order_id: str | None = None
    settlement_event_id: str | None = None
    payout_transaction_id: str | None = None
    failure_reason: str | None = None


@dataclass(frozen=True)
class HedgeResult:
    hedge_order_id: str
    filled: bool
    payoff_if_goal: Decimal = Decimal("0.00")
    payoff_if_no_goal: Decimal = Decimal("0.00")
    reserved_cost: Decimal = Decimal("0.00")


class MarketDataPort(Protocol):
    def latest_snapshot(self, market_id: str) -> MarketSnapshot: ...


class PaymentPort(Protocol):
    def authorize(self, user_id: str, amount: Decimal, idempotency_key: str) -> str: ...

    def capture(self, authorization_id: str, idempotency_key: str) -> str: ...

    def void(self, authorization_id: str, idempotency_key: str) -> None: ...

    def credit_payout(
        self, user_id: str, amount: Decimal, idempotency_key: str
    ) -> str: ...


class HedgePort(Protocol):
    def execute(self, order: BetOrder, snapshot: MarketSnapshot) -> HedgeResult: ...

    def unwind(self, hedge_order_id: str, idempotency_key: str) -> None: ...


class LedgerPort(Protocol):
    @contextmanager
    def lock_market(self, market_id: str) -> Iterator[None]: ...

    def get_book(self, market_id: str) -> BookState: ...

    def save_book(self, book: BookState) -> None: ...

    def save_quote(self, quote: Quote) -> None: ...

    def get_quote(self, quote_id: str) -> Quote | None: ...

    def save_order(self, order: BetOrder) -> None: ...

    def get_order_by_idempotency_key(self, key: str) -> BetOrder | None: ...

    def list_orders(self, market_id: str) -> list[BetOrder]: ...

    def close_market(self, market_id: str, settlement_event_id: str) -> bool: ...


class ExecutionError(RuntimeError):
    pass


class BetExecutionEngine:
    def __init__(
        self,
        config: EngineConfig,
        signing_secret: str,
        market_data: MarketDataPort,
        payments: PaymentPort,
        hedging: HedgePort,
        ledger: LedgerPort,
    ) -> None:
        self.config = config
        self.signing_secret = signing_secret.encode("utf-8")
        self.market_data = market_data
        self.payments = payments
        self.hedging = hedging
        self.ledger = ledger

    def create_quote(self, request: QuoteRequest) -> Quote:
        stake = money(request.stake)
        snapshot = self.market_data.latest_snapshot(request.market_id)
        now = utc_now()
        rejection_reason = self._validate_quote_request(stake, snapshot, now)

        with self.ledger.lock_market(request.market_id):
            book = self.ledger.get_book(request.market_id)
            offered_odds = None
            if rejection_reason is None:
                requested_odds = self._inventory_adjusted_odds(
                    snapshot.goal_probability, request.side, book
                )
                offered_odds = self._risk_capped_odds(
                    requested_odds, request.side, stake, book
                )
                if offered_odds is None:
                    rejection_reason = "RISK_LIMIT_OR_MINIMUM_ODDS"

            quote = self._build_quote(
                request=request,
                stake=stake,
                snapshot=snapshot,
                now=now,
                offered_odds=offered_odds,
                rejection_reason=rejection_reason,
            )
            self.ledger.save_quote(quote)
            return quote

    def execute_quote(self, quote_id: str, idempotency_key: str) -> BetOrder:
        existing = self.ledger.get_order_by_idempotency_key(idempotency_key)
        if existing is not None:
            return existing

        quote = self.ledger.get_quote(quote_id)
        if quote is None or not self._valid_signature(quote):
            raise ExecutionError("INVALID_QUOTE")
        if not quote.accepted or quote.decimal_odds is None or quote.potential_payout is None:
            raise ExecutionError(quote.rejection_reason or "QUOTE_REJECTED")

        snapshot = self.market_data.latest_snapshot(quote.market_id)
        now = utc_now()
        if now > quote.expires_at:
            raise ExecutionError("QUOTE_EXPIRED")
        if not snapshot.is_open or now >= snapshot.betting_closes_at:
            raise ExecutionError("MARKET_CLOSED")

        order = BetOrder(
            order_id=str(uuid.uuid4()),
            idempotency_key=idempotency_key,
            quote_id=quote.quote_id,
            market_id=quote.market_id,
            user_id=quote.user_id,
            side=quote.side,
            stake=quote.stake,
            decimal_odds=quote.decimal_odds,
            potential_payout=quote.potential_payout,
            status=OrderStatus.RISK_RESERVED,
            created_at=now,
            updated_at=now,
        )

        with self.ledger.lock_market(order.market_id):
            existing = self.ledger.get_order_by_idempotency_key(idempotency_key)
            if existing is not None:
                return existing
            book = self.ledger.get_book(order.market_id)
            projected = self._apply_order_to_book(book, order)
            if projected.worst_case_profit() < -self.config.maximum_unhedged_loss:
                raise ExecutionError("RISK_CHANGED_REQUOTE_REQUIRED")
            self.ledger.save_book(projected)
            self.ledger.save_order(order)

        authorization_id = None
        hedge_result = None
        try:
            authorization_id = self.payments.authorize(
                order.user_id,
                order.stake,
                f"authorize:{order.idempotency_key}",
            )
            order = self._update_order(
                order,
                status=OrderStatus.PAYMENT_AUTHORIZED,
                payment_authorization_id=authorization_id,
            )

            hedge_result = self.hedging.execute(order, snapshot)
            if self.config.require_hedge_fill and not hedge_result.filled:
                raise ExecutionError("HEDGE_NOT_FILLED")
            order = self._update_order(
                order,
                status=OrderStatus.HEDGED,
                hedge_order_id=hedge_result.hedge_order_id,
            )

            self.payments.capture(
                authorization_id,
                f"capture:{order.idempotency_key}",
            )
            with self.ledger.lock_market(order.market_id):
                book = self.ledger.get_book(order.market_id)
                book = replace(
                    book,
                    hedge_payoff_if_goal=money(
                        book.hedge_payoff_if_goal + hedge_result.payoff_if_goal
                    ),
                    hedge_payoff_if_no_goal=money(
                        book.hedge_payoff_if_no_goal + hedge_result.payoff_if_no_goal
                    ),
                    reserved_execution_cost=money(
                        book.reserved_execution_cost + hedge_result.reserved_cost
                    ),
                )
                self.ledger.save_book(book)
                order = self._update_order(order, status=OrderStatus.ACCEPTED)
            return order
        except Exception as exc:
            if hedge_result is not None and hedge_result.filled:
                self.hedging.unwind(
                    hedge_result.hedge_order_id,
                    f"unwind:{order.idempotency_key}",
                )
            if authorization_id is not None:
                self.payments.void(
                    authorization_id,
                    f"void:{order.idempotency_key}",
                )
            self._rollback_reserved_order(order, str(exc))
            if isinstance(exc, ExecutionError):
                raise
            raise ExecutionError("ORDER_EXECUTION_FAILED") from exc

    def settle_market(
        self,
        market_id: str,
        result: Side,
        settlement_event_id: str,
    ) -> list[BetOrder]:
        with self.ledger.lock_market(market_id):
            first_processing = self.ledger.close_market(market_id, settlement_event_id)
            if not first_processing:
                return self.ledger.list_orders(market_id)
            orders = []
            for order in self.ledger.list_orders(market_id):
                if order.status == OrderStatus.ACCEPTED:
                    pending = self._update_order(
                        order,
                        status=OrderStatus.SETTLEMENT_PENDING,
                        settlement_event_id=settlement_event_id,
                    )
                    orders.append(pending)

        settled = []
        for order in orders:
            payout = order.potential_payout if order.side == result else Decimal("0.00")
            try:
                payout_transaction_id = None
                if payout > 0:
                    payout_transaction_id = self.payments.credit_payout(
                        order.user_id,
                        payout,
                        f"payout:{settlement_event_id}:{order.order_id}",
                    )
                order = self._update_order(
                    order,
                    status=OrderStatus.SETTLED,
                    payout_transaction_id=payout_transaction_id,
                )
            except Exception as exc:
                order = self._update_order(
                    order,
                    status=OrderStatus.SETTLEMENT_PENDING,
                    failure_reason=str(exc),
                )
            settled.append(order)
        return settled

    def _validate_quote_request(
        self, stake: Decimal, snapshot: MarketSnapshot, now: datetime
    ) -> str | None:
        if not snapshot.is_open or now >= snapshot.betting_closes_at:
            return "MARKET_CLOSED"
        if stake < self.config.minimum_stake:
            return "BELOW_MINIMUM_STAKE"
        if stake > self.config.maximum_stake:
            return "ABOVE_MAXIMUM_STAKE"
        if snapshot.goal_probability <= 0 or snapshot.goal_probability >= 1:
            return "INVALID_MARKET_PROBABILITY"
        return None

    def _inventory_adjusted_odds(
        self,
        goal_probability: Decimal,
        side: Side,
        book: BookState,
    ) -> Decimal:
        imbalance = (
            book.payout_if_goal - book.payout_if_no_goal
        ) / max(self.config.maximum_unhedged_loss, Decimal("1.00"))
        imbalance = max(Decimal("-1"), min(Decimal("1"), imbalance))
        overround_multiplier = Decimal("1") + self.config.base_overround
        q_goal = (
            goal_probability * overround_multiplier
            + self.config.inventory_sensitivity * imbalance
        )
        q_no_goal = (
            (Decimal("1") - goal_probability) * overround_multiplier
            - self.config.inventory_sensitivity * imbalance
        )
        selected = q_goal if side == Side.GOAL else q_no_goal
        selected = max(Decimal("0.01"), min(Decimal("0.99"), selected))
        return odds(Decimal("1") / selected)

    def _risk_capped_odds(
        self,
        requested_odds: Decimal,
        side: Side,
        stake: Decimal,
        book: BookState,
    ) -> Decimal | None:
        projected_handle = book.accepted_handle + stake
        existing_payout = (
            book.payout_if_goal if side == Side.GOAL else book.payout_if_no_goal
        )
        hedge_payoff = (
            book.hedge_payoff_if_goal
            if side == Side.GOAL
            else book.hedge_payoff_if_no_goal
        )
        maximum_safe_payout = (
            projected_handle
            + hedge_payoff
            - book.reserved_execution_cost
            + self.config.maximum_unhedged_loss
        )
        maximum_safe_odds = odds((maximum_safe_payout - existing_payout) / stake)
        offered = min(
            requested_odds,
            maximum_safe_odds,
            self.config.maximum_decimal_odds,
        )
        if offered < self.config.minimum_decimal_odds:
            return None
        return offered

    def _build_quote(
        self,
        request: QuoteRequest,
        stake: Decimal,
        snapshot: MarketSnapshot,
        now: datetime,
        offered_odds: Decimal | None,
        rejection_reason: str | None,
    ) -> Quote:
        potential_payout = money(stake * offered_odds) if offered_odds else None
        unsigned = Quote(
            quote_id=str(uuid.uuid4()),
            market_id=request.market_id,
            user_id=request.user_id,
            side=request.side,
            stake=stake,
            decimal_odds=offered_odds,
            potential_payout=potential_payout,
            goal_probability=snapshot.goal_probability,
            market_source_version=snapshot.source_version,
            created_at=now,
            expires_at=now + timedelta(milliseconds=self.config.quote_ttl_ms),
            accepted=offered_odds is not None and rejection_reason is None,
            rejection_reason=rejection_reason,
            signature="",
        )
        return replace(unsigned, signature=self._signature(unsigned))

    def _signature(self, quote: Quote) -> str:
        payload = {
            "quote_id": quote.quote_id,
            "market_id": quote.market_id,
            "user_id": quote.user_id,
            "side": quote.side.value,
            "stake": str(quote.stake),
            "decimal_odds": str(quote.decimal_odds),
            "potential_payout": str(quote.potential_payout),
            "market_source_version": quote.market_source_version,
            "expires_at": quote.expires_at.isoformat(),
            "accepted": quote.accepted,
        }
        encoded = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
        return hmac.new(self.signing_secret, encoded, hashlib.sha256).hexdigest()

    def _valid_signature(self, quote: Quote) -> bool:
        expected = self._signature(replace(quote, signature=""))
        return hmac.compare_digest(expected, quote.signature)

    def _apply_order_to_book(self, book: BookState, order: BetOrder) -> BookState:
        values = {"accepted_handle": money(book.accepted_handle + order.stake)}
        if order.side == Side.GOAL:
            values["payout_if_goal"] = money(
                book.payout_if_goal + order.potential_payout
            )
        else:
            values["payout_if_no_goal"] = money(
                book.payout_if_no_goal + order.potential_payout
            )
        return replace(book, **values)

    def _remove_order_from_book(self, book: BookState, order: BetOrder) -> BookState:
        values = {"accepted_handle": money(book.accepted_handle - order.stake)}
        if order.side == Side.GOAL:
            values["payout_if_goal"] = money(
                book.payout_if_goal - order.potential_payout
            )
        else:
            values["payout_if_no_goal"] = money(
                book.payout_if_no_goal - order.potential_payout
            )
        return replace(book, **values)

    def _rollback_reserved_order(self, order: BetOrder, reason: str) -> None:
        with self.ledger.lock_market(order.market_id):
            current = self.ledger.get_book(order.market_id)
            self.ledger.save_book(self._remove_order_from_book(current, order))
            self._update_order(
                order,
                status=OrderStatus.REJECTED,
                failure_reason=reason,
            )

    def _update_order(self, order: BetOrder, **values) -> BetOrder:
        updated = replace(order, updated_at=utc_now(), **values)
        self.ledger.save_order(updated)
        return updated


class InMemoryLedger:
    def __init__(self) -> None:
        self.books: dict[str, BookState] = {}
        self.quotes: dict[str, Quote] = {}
        self.orders: dict[str, BetOrder] = {}
        self.idempotency: dict[str, str] = {}
        self.market_locks: dict[str, threading.RLock] = {}
        self.closed_markets: dict[str, str] = {}

    @contextmanager
    def lock_market(self, market_id: str) -> Iterator[None]:
        lock = self.market_locks.setdefault(market_id, threading.RLock())
        with lock:
            yield

    def get_book(self, market_id: str) -> BookState:
        return self.books.setdefault(market_id, BookState(market_id=market_id))

    def save_book(self, book: BookState) -> None:
        self.books[book.market_id] = book

    def save_quote(self, quote: Quote) -> None:
        self.quotes[quote.quote_id] = quote

    def get_quote(self, quote_id: str) -> Quote | None:
        return self.quotes.get(quote_id)

    def save_order(self, order: BetOrder) -> None:
        self.orders[order.order_id] = order
        self.idempotency[order.idempotency_key] = order.order_id

    def get_order_by_idempotency_key(self, key: str) -> BetOrder | None:
        order_id = self.idempotency.get(key)
        return self.orders.get(order_id) if order_id else None

    def list_orders(self, market_id: str) -> list[BetOrder]:
        return [order for order in self.orders.values() if order.market_id == market_id]

    def close_market(self, market_id: str, settlement_event_id: str) -> bool:
        if market_id in self.closed_markets:
            return False
        self.closed_markets[market_id] = settlement_event_id
        return True


class MutableMarketData:
    def __init__(self, snapshot: MarketSnapshot) -> None:
        self.snapshot = snapshot

    def latest_snapshot(self, market_id: str) -> MarketSnapshot:
        if self.snapshot.market_id != market_id:
            raise ExecutionError("UNKNOWN_MARKET")
        return self.snapshot

    def update(self, **values) -> None:
        self.snapshot = replace(self.snapshot, **values)


class InMemoryPayments:
    def __init__(self) -> None:
        self.authorizations: dict[str, tuple[str, Decimal, str]] = {}
        self.captures: dict[str, str] = {}
        self.payouts: dict[str, tuple[str, Decimal]] = {}

    def authorize(self, user_id: str, amount: Decimal, idempotency_key: str) -> str:
        authorization_id = f"auth_{uuid.uuid4().hex}"
        self.authorizations[authorization_id] = (user_id, amount, idempotency_key)
        return authorization_id

    def capture(self, authorization_id: str, idempotency_key: str) -> str:
        if authorization_id not in self.authorizations:
            raise ExecutionError("UNKNOWN_AUTHORIZATION")
        capture_id = f"capture_{uuid.uuid4().hex}"
        self.captures[idempotency_key] = capture_id
        return capture_id

    def void(self, authorization_id: str, idempotency_key: str) -> None:
        self.authorizations.pop(authorization_id, None)

    def credit_payout(
        self, user_id: str, amount: Decimal, idempotency_key: str
    ) -> str:
        existing = self.payouts.get(idempotency_key)
        if existing:
            return existing[0]
        transaction_id = f"payout_{uuid.uuid4().hex}"
        self.payouts[idempotency_key] = (transaction_id, amount)
        return transaction_id


class NoopHedge:
    def execute(self, order: BetOrder, snapshot: MarketSnapshot) -> HedgeResult:
        return HedgeResult(
            hedge_order_id=f"hedge_{uuid.uuid4().hex}",
            filled=True,
        )

    def unwind(self, hedge_order_id: str, idempotency_key: str) -> None:
        return None
