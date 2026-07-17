"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Side = "GOAL" | "NO_GOAL";
type MarketState = "OPEN" | "SETTLED";

type PlacedBet = {
  id: number;
  side: Side;
  stake: number;
  odds: number;
  payout: number;
  placedAt: string;
};

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

function Icon({
  name,
}: {
  name: "wallet" | "volume" | "signal" | "check" | "chevron";
}) {
  const paths = {
    wallet: (
      <>
        <path d="M3 6.5h15a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2h11" />
        <path d="M15 11h5v4h-5a2 2 0 0 1 0-4Z" />
      </>
    ),
    volume: (
      <>
        <path d="M11 5 6.5 9H3v6h3.5L11 19V5Z" />
        <path d="M15 9.5a4 4 0 0 1 0 5" />
        <path d="M17.8 7a7.5 7.5 0 0 1 0 10" />
      </>
    ),
    signal: (
      <>
        <path d="M4 17v2" />
        <path d="M9 13v6" />
        <path d="M14 9v10" />
        <path d="M19 5v14" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    chevron: <path d="m9 18 6-6-6-6" />,
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

function Brand() {
  return (
    <div className="brand" aria-label="VARBET">
      <span className="brandMark">V</span>
      <span>VAR</span>
      <strong>BET</strong>
    </div>
  );
}

export default function Home() {
  const [hasEntered, setHasEntered] = useState(false);
  const [stake, setStake] = useState("25");
  const [goalOdds, setGoalOdds] = useState(1.72);
  const [noGoalOdds, setNoGoalOdds] = useState(2.1);
  const [oddsTick, setOddsTick] = useState(0);
  const [balance, setBalance] = useState(1250);
  const [bets, setBets] = useState<PlacedBet[]>([]);
  const [toastBet, setToastBet] = useState<PlacedBet | null>(null);
  const [submitting, setSubmitting] = useState<Side | null>(null);
  const [marketState, setMarketState] = useState<MarketState>("OPEN");
  const [result, setResult] = useState<Side | null>(null);
  const [feedState, setFeedState] = useState<"LIVE" | "STALE">("LIVE");
  const [demoOpen, setDemoOpen] = useState(false);
  const marketRef = useRef<HTMLElement>(null);

  const stakeNumber = Number(stake);
  const validStake =
    Number.isFinite(stakeNumber) && stakeNumber >= 1 && stakeNumber <= balance;

  useEffect(() => {
    if (!hasEntered || marketState !== "OPEN" || feedState !== "LIVE") return;

    const timer = window.setInterval(() => {
      setGoalOdds((current) =>
        Number(
          Math.max(1.05, current + (Math.random() - 0.48) * 0.12).toFixed(2),
        ),
      );
      setNoGoalOdds((current) =>
        Number(
          Math.max(1.05, current + (Math.random() - 0.52) * 0.12).toFixed(2),
        ),
      );
      setOddsTick((tick) => tick + 1);
    }, 2200);

    return () => window.clearInterval(timer);
  }, [feedState, hasEntered, marketState]);

  useEffect(() => {
    if (!toastBet) return;
    const timer = window.setTimeout(() => setToastBet(null), 3600);
    return () => window.clearTimeout(timer);
  }, [toastBet]);

  const selectedPayouts = useMemo(
    () => ({
      GOAL: validStake ? stakeNumber * goalOdds : 0,
      NO_GOAL: validStake ? stakeNumber * noGoalOdds : 0,
    }),
    [goalOdds, noGoalOdds, stakeNumber, validStake],
  );

  function enterMarket() {
    setHasEntered(true);
    window.setTimeout(
      () => marketRef.current?.scrollIntoView({ behavior: "smooth" }),
      50,
    );
  }

  function placeBet(side: Side) {
    if (
      !validStake ||
      marketState !== "OPEN" ||
      feedState !== "LIVE" ||
      submitting
    )
      return;
    setSubmitting(side);
    const lockedOdds = side === "GOAL" ? goalOdds : noGoalOdds;

    window.setTimeout(() => {
      const bet: PlacedBet = {
        id: Date.now(),
        side,
        stake: stakeNumber,
        odds: lockedOdds,
        payout: stakeNumber * lockedOdds,
        placedAt: new Date().toLocaleTimeString([], {
          minute: "2-digit",
          second: "2-digit",
        }),
      };
      setBets((current) => [bet, ...current]);
      setBalance((current) => current - stakeNumber);
      setToastBet(bet);
      setSubmitting(null);
    }, 480);
  }

  function settle(decision: Side) {
    if (marketState === "SETTLED") return;
    const winnings = bets
      .filter((bet) => bet.side === decision)
      .reduce((total, bet) => total + bet.payout, 0);
    setBalance((current) => current + winnings);
    setResult(decision);
    setMarketState("SETTLED");
    setDemoOpen(false);
  }

  function resetDemo() {
    setStake("25");
    setGoalOdds(1.72);
    setNoGoalOdds(2.1);
    setBalance(1250);
    setBets([]);
    setToastBet(null);
    setMarketState("OPEN");
    setResult(null);
    setFeedState("LIVE");
    setDemoOpen(false);
  }

  if (!hasEntered) {
    return (
      <main className="entryShell">
        <div className="entryGlow entryGlowOne" />
        <div className="entryGlow entryGlowTwo" />
        <header className="entryHeader">
          <Brand />
          <span className="demoBadge">LIVE DEMO</span>
        </header>

        <section className="entryHero">
          <div className="livePill">
            <i /> LIVE NOW
          </div>
          <p className="eyebrow">
            ARGENTINA <span>VS</span> EGYPT
          </p>
          <h1>
            The net
            <br />
            moved.
            <br />
            The decision
            <br />
            hasn&apos;t.
          </h1>
          <p className="entryCopy">
            Bet the next 60 seconds. Will VAR let the goal stand?
          </p>
        </section>

        <div className="phoneNotification" role="alert">
          <div className="notificationIcon">V</div>
          <div className="notificationCopy">
            <div className="notificationMeta">
              <strong>VARBET</strong>
              <span>now</span>
            </div>
            <h2>⚽ VAR market open</h2>
            <p>The ball is in the net. Will the goal stand?</p>
            <small>Argentina vs Egypt · 58:02</small>
          </div>
          <button onClick={enterMarket} aria-label="Open betting market">
            <Icon name="chevron" />
          </button>
        </div>

        <button className="entryCta" onClick={enterMarket}>
          Bet the decision{" "}
          <span>
            <Icon name="chevron" />
          </span>
        </button>
        <p className="entryLegal">18+ · Play responsibly · Demo experience</p>
      </main>
    );
  }

  const winningBets = result ? bets.filter((bet) => bet.side === result) : [];
  const settledPayout = winningBets.reduce(
    (total, bet) => total + bet.payout,
    0,
  );

  return (
    <main className="appShell">
      {toastBet && (
        <div className="toast" role="status">
          <span className="toastCheck">
            <Icon name="check" />
          </span>
          <div>
            <strong>Bet placed successfully</strong>
            <p>
              {money.format(toastBet.stake)} on{" "}
              {toastBet.side === "GOAL" ? "Goal" : "No Goal"} at{" "}
              {toastBet.odds.toFixed(2)}
            </p>
          </div>
          <span className="toastPayout">{money.format(toastBet.payout)}</span>
        </div>
      )}

      <header className="appHeader">
        <Brand />
        <div className="headerActions">
          <button
            className="walletButton"
            aria-label={`Wallet balance ${money.format(balance)}`}
          >
            <Icon name="wallet" />
            <span>{money.format(balance)}</span>
          </button>
          <button
            className="moreButton"
            onClick={() => setDemoOpen(true)}
            aria-label="Open demo controls"
          >
            •••
          </button>
        </div>
      </header>

      {feedState === "STALE" && (
        <div className="staleBanner">
          <Icon name="signal" /> Connection delayed. Betting is temporarily
          paused.
        </div>
      )}

      <section className="market" ref={marketRef}>
        <div className="matchRow">
          <div>
            <p>FIFA WORLD CUP · GROUP C</p>
            <h2>
              <span>ARG</span> 2 <b>–</b> 2 <span>EGY</span>
            </h2>
          </div>
          <div className="matchClock">
            <i /> 58:42
          </div>
        </div>

        <div className="videoFrame">
          <div className="stadiumLights" />
          <div className="pitch">
            <div className="centreCircle" />
            <div className="penaltyBox" />
            <div className="goalNet" />
            <div className="referee">
              <span />
            </div>
            <div className="player playerOne" />
            <div className="player playerTwo" />
          </div>
          <div className="videoTopline">
            <span className="broadcastLive">
              <i /> LIVE
            </span>
            <span>58:42</span>
          </div>
          <div className="reviewGraphic">
            <span className="reviewIcon">VAR</span>
            <div>
              <strong>
                {marketState === "OPEN"
                  ? "Decision pending"
                  : "Decision confirmed"}
              </strong>
              <small>
                {marketState === "OPEN"
                  ? "Referee at the monitor"
                  : result === "GOAL"
                    ? "Goal awarded"
                    : "Goal overturned"}
              </small>
            </div>
          </div>
          <button className="volumeButton" aria-label="Toggle volume">
            <Icon name="volume" />
          </button>
        </div>

        <div
          className={`statusCard ${marketState === "SETTLED" ? "statusSettled" : ""}`}
        >
          <div className="statusPulse">
            <span>
              {marketState === "OPEN" ? "VAR" : <Icon name="check" />}
            </span>
          </div>
          <div>
            <p>
              {marketState === "OPEN"
                ? "VAR REVIEW · MARKET OPEN"
                : "OFFICIAL DECISION · SETTLED"}
            </p>
            <h3>
              {marketState === "OPEN"
                ? "Will the goal stand?"
                : result === "GOAL"
                  ? "GOAL CONFIRMED"
                  : "NO GOAL"}
            </h3>
            <small>
              {marketState === "OPEN"
                ? "Betting closes on the referee’s signal"
                : result === "GOAL"
                  ? "The goal has been awarded"
                  : "The goal has been overturned"}
            </small>
          </div>
        </div>

        {marketState === "OPEN" ? (
          <section className="betPanel" aria-label="Place bet">
            <div className="panelHeading">
              <div>
                <span>YOUR STAKE</span>
                <small>Available {money.format(balance)}</small>
              </div>
              <div className="oddsLive">
                <i /> Odds updating live
              </div>
            </div>

            <div className="stakeField">
              <span>$</span>
              <input
                value={stake}
                onChange={(event) =>
                  setStake(event.target.value.replace(/[^0-9.]/g, ""))
                }
                inputMode="decimal"
                aria-label="Bet stake"
              />
              <button onClick={() => setStake(String(Math.floor(balance)))}>
                MAX
              </button>
            </div>

            <div className="stakeChips" aria-label="Quick stake amounts">
              {[5, 10, 25, 50].map((amount) => (
                <button
                  key={amount}
                  className={stakeNumber === amount ? "active" : ""}
                  onClick={() => setStake(String(amount))}
                >
                  ${amount}
                </button>
              ))}
            </div>

            <div className="betButtons">
              <button
                className="betButton goalButton"
                data-testid="goal-bet"
                onClick={() => placeBet("GOAL")}
                disabled={
                  !validStake || feedState === "STALE" || Boolean(submitting)
                }
              >
                <span>
                  <small>GOAL</small>
                  <b>Confirmed</b>
                </span>
                <strong key={`goal-${oddsTick}`} className="oddsFlash">
                  {submitting === "GOAL" ? "···" : goalOdds.toFixed(2)}
                </strong>
                <em>
                  {validStake
                    ? `${money.format(selectedPayouts.GOAL)} return`
                    : "Enter stake"}
                </em>
              </button>
              <button
                className="betButton noGoalButton"
                data-testid="no-goal-bet"
                onClick={() => placeBet("NO_GOAL")}
                disabled={
                  !validStake || feedState === "STALE" || Boolean(submitting)
                }
              >
                <span>
                  <small>NO GOAL</small>
                  <b>Overturned</b>
                </span>
                <strong key={`no-goal-${oddsTick}`} className="oddsFlash">
                  {submitting === "NO_GOAL" ? "···" : noGoalOdds.toFixed(2)}
                </strong>
                <em>
                  {validStake
                    ? `${money.format(selectedPayouts.NO_GOAL)} return`
                    : "Enter stake"}
                </em>
              </button>
            </div>

            <p className="lockedNote">
              <span>◆</span> Your displayed odds lock when the bet is accepted.
            </p>
          </section>
        ) : (
          <section className="settlementPanel">
            <div className="settlementAmount">
              <span>TOTAL PAYOUT</span>
              <strong>{money.format(settledPayout)}</strong>
              <small>
                {winningBets.length} winning{" "}
                {winningBets.length === 1 ? "bet" : "bets"}
              </small>
            </div>
            <button onClick={resetDemo}>Return to match</button>
          </section>
        )}

        {bets.length > 0 && (
          <section className="openBets">
            <div className="sectionTitle">
              <h3>
                {marketState === "OPEN" ? "Your live bets" : "Bet history"}
              </h3>
              <span>{bets.length}</span>
            </div>
            <div className="betList">
              {bets.map((bet) => {
                const won = marketState === "SETTLED" && bet.side === result;
                const lost = marketState === "SETTLED" && bet.side !== result;
                return (
                  <article
                    key={bet.id}
                    className={won ? "won" : lost ? "lost" : ""}
                  >
                    <div>
                      <span
                        className={
                          bet.side === "GOAL" ? "goalDot" : "noGoalDot"
                        }
                      />{" "}
                      <strong>
                        {bet.side === "GOAL" ? "Goal" : "No Goal"}
                      </strong>
                      <small>{bet.placedAt}</small>
                    </div>
                    <div>
                      <span>
                        {money.format(bet.stake)} at {bet.odds.toFixed(2)}
                      </span>
                      <strong>
                        {lost ? "$0.00" : money.format(bet.payout)}
                      </strong>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </section>

      <footer>
        <span>18+</span>
        <a href="#">Play responsibly</a>
        <a href="#">Terms</a>
        <small>Demo market · No real money</small>
      </footer>

      {demoOpen && (
        <div className="sheetBackdrop" onClick={() => setDemoOpen(false)}>
          <section
            className="demoSheet"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sheetHandle" />
            <span className="sheetEyebrow">PROTOTYPE CONTROLS</span>
            <h2>Simulate the live market</h2>
            <p>
              Test settlement and feed protection states without waiting for a
              real decision.
            </p>
            <button
              className="sheetDecision goalDecision"
              onClick={() => settle("GOAL")}
            >
              Award goal <span>GOAL</span>
            </button>
            <button
              className="sheetDecision noGoalDecision"
              onClick={() => settle("NO_GOAL")}
            >
              Overturn goal <span>NO GOAL</span>
            </button>
            <button
              className="sheetSecondary"
              onClick={() => {
                setFeedState((current) =>
                  current === "LIVE" ? "STALE" : "LIVE",
                );
                setDemoOpen(false);
              }}
            >
              Toggle delayed feed
            </button>
            <button className="sheetSecondary" onClick={resetDemo}>
              Reset experience
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
