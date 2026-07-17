"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { io } from "socket.io-client";

import { matchClockAt, quoteAt, reviewPhaseAt, SIMULATION } from "./simulation";

type Side = "GOAL" | "NO_GOAL";

type BetRecord = {
  id: number;
  poolId: number;
  side: Side;
  amount: number;
  odds: number;
  payout: number;
  placedAt: string;
};

type PayoutRecord = {
  id: number;
  poolId: number;
  amount: number;
  status: "CONFIRMED";
};

const LIVE_POOL_ID = 20260707;
const STARTING_POOL = 2840;
const API_URL = process.env.NEXT_PUBLIC_API_URL;

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

function Brand() {
  return (
    <div className="brand" aria-label="VARBET">
      <span className="brandMark">V</span>
      <span>VAR</span>
      <strong>BET</strong>
    </div>
  );
}

function percent(value: number) {
  return `${value.toFixed(1)}%`;
}

function shortAddress(address: string) {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export default function Home() {
  const { connected, publicKey } = useWallet();
  const videoRef = useRef<HTMLVideoElement>(null);
  const settlementHandled = useRef(false);
  const [hasEntered, setHasEntered] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [poolAmount, setPoolAmount] = useState(STARTING_POOL);
  const [bets, setBets] = useState<BetRecord[]>([]);
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [betSlipOpen, setBetSlipOpen] = useState(false);
  const [selectedSide, setSelectedSide] = useState<Side>("NO_GOAL");
  const [stake, setStake] = useState("10");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [socketState, setSocketState] = useState<"LIVE" | "SIMULATED">(
    API_URL ? "LIVE" : "SIMULATED",
  );

  const walletAddress = publicKey?.toBase58() ?? "";
  const quote = useMemo(() => quoteAt(elapsed), [elapsed]);
  const reviewPhase = useMemo(() => reviewPhaseAt(elapsed), [elapsed]);
  const goalOccurred = elapsed >= SIMULATION.goalAt;
  const settled = elapsed >= SIMULATION.decisionAt;
  const acceptingBets = goalOccurred && !settled;
  const score = goalOccurred && !settled ? "0 – 2" : "0 – 1";
  const matchClock = matchClockAt(elapsed);
  const secondsRemaining = Math.max(
    0,
    Math.ceil(
      (goalOccurred ? SIMULATION.decisionAt : SIMULATION.goalAt) - elapsed,
    ),
  );
  const stakeNumber = Number(stake);
  const selectedOdds =
    selectedSide === "GOAL" ? quote.goalOdds : quote.noGoalOdds;
  const validStake = Number.isFinite(stakeNumber) && stakeNumber > 0;
  const potentialPayout = validStake ? stakeNumber * selectedOdds : 0;

  useEffect(() => {
    if (!hasEntered) return;
    void videoRef.current?.play().catch(() => setIsPlaying(false));
  }, [hasEntered]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!API_URL) return;

    const socket = io(API_URL, {
      transports: ["websocket"],
      reconnectionAttempts: 3,
    });

    socket.on("connect", () => setSocketState("LIVE"));
    socket.on("connect_error", () => setSocketState("SIMULATED"));
    socket.on(
      "poolUpdated",
      (pool: {
        id?: number;
        amount?: number | string;
        acceptingBets?: boolean;
      }) => {
        const nextAmount = Number(pool.amount);
        if (pool.id === LIVE_POOL_ID && Number.isFinite(nextAmount)) {
          setPoolAmount(nextAmount);
        }
      },
    );
    socket.on(
      "payoutExecuted",
      (payout: { id: number; poolId: number; amount: number }) => {
        if (payout.poolId !== LIVE_POOL_ID) return;
        setPayouts((current) => [
          {
            id: payout.id,
            poolId: payout.poolId,
            amount: Number(payout.amount),
            status: "CONFIRMED",
          },
          ...current,
        ]);
      },
    );

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!settled || settlementHandled.current) return;
    settlementHandled.current = true;

    const winnings = bets
      .filter((bet) => bet.side === "NO_GOAL")
      .reduce((total, bet) => total + bet.payout, 0);

    if (winnings > 0) {
      setPayouts((current) => [
        {
          id: Date.now(),
          poolId: LIVE_POOL_ID,
          amount: winnings,
          status: "CONFIRMED",
        },
        ...current,
      ]);
      setToast(`VAR settled: ${money.format(winnings)} payout confirmed`);
    } else {
      setToast("Market closed automatically: NO GOAL");
    }
    setBetSlipOpen(false);
  }, [bets, settled]);

  function enterMarket() {
    setHasEntered(true);
  }

  function openBetSlip(side: Side) {
    if (!acceptingBets) return;
    setSelectedSide(side);
    setBetSlipOpen(true);
  }

  async function placeBet() {
    if (!connected || !walletAddress || !validStake || !acceptingBets) return;
    setSubmitting(true);
    const lockedOdds = selectedOdds;

    try {
      if (API_URL) {
        const response = await fetch(`${API_URL}/api/bets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            poolId: LIVE_POOL_ID,
            wallet_address: walletAddress,
            amount: stakeNumber,
            option: selectedSide,
          }),
        });
        if (!response.ok) throw new Error("Bet request failed");
      }

      const bet: BetRecord = {
        id: Date.now(),
        poolId: LIVE_POOL_ID,
        side: selectedSide,
        amount: stakeNumber,
        odds: lockedOdds,
        payout: stakeNumber * lockedOdds,
        placedAt: matchClock,
      };
      setBets((current) => [bet, ...current]);
      setPoolAmount((current) => current + stakeNumber);
      setToast(
        `${selectedSide === "GOAL" ? "Confirmed" : "Overturned"} bet accepted at ${lockedOdds.toFixed(2)}`,
      );
      setBetSlipOpen(false);
    } catch {
      setToast("Bet could not be submitted. Check the API connection.");
    } finally {
      setSubmitting(false);
    }
  }

  function replaySimulation() {
    settlementHandled.current = false;
    setElapsed(0);
    setPoolAmount(STARTING_POOL);
    setBets([]);
    setPayouts([]);
    setBetSlipOpen(false);
    setToast(null);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      void videoRef.current.play();
    }
  }

  if (!hasEntered) {
    return (
      <main className="entryShell">
        <div className="entryGlow entryGlowOne" />
        <div className="entryGlow entryGlowTwo" />
        <header className="entryHeader">
          <Brand />
          <span className="demoBadge">LIVE SIMULATION</span>
        </header>

        <section className="entryHero">
          <div className="livePill">
            <i /> VAR MARKET OPEN
          </div>
          <p className="eyebrow">
            ARGENTINA <span>VS</span> EGYPT
          </p>
          <h1>
            The ball is in.
            <br />
            The decision isn&apos;t.
          </h1>
          <p className="entryCopy">
            Follow the real review video, live prediction signal, and automatic
            settlement.
          </p>
        </section>

        <div className="phoneNotification" role="alert">
          <div className="notificationIcon">V</div>
          <div className="notificationCopy">
            <div className="notificationMeta">
              <strong>VARBET</strong>
              <span>now</span>
            </div>
            <h2>Goal under VAR review</h2>
            <p>Egypt lead 0–2. Will the goal be overturned?</p>
            <small>Argentina vs Egypt · 57:55</small>
          </div>
        </div>

        <button className="entryCta" onClick={enterMarket}>
          Watch and bet <span>›</span>
        </button>
        <p className="entryLegal">18+ · Play responsibly · Prototype market</p>
      </main>
    );
  }

  return (
    <main className="appShell">
      {toast && (
        <div className="toast" role="status">
          <span className="toastCheck">✓</span>
          <div>
            <strong>{toast}</strong>
            <p>Pool #{LIVE_POOL_ID}</p>
          </div>
        </div>
      )}

      <header className="appHeader">
        <Brand />
        <div className="headerActions">
          <span className={`connectionBadge ${socketState.toLowerCase()}`}>
            <i /> {socketState}
          </span>
          <WalletMultiButton />
        </div>
      </header>

      <section className="liveMarket">
        <div className="matchRow">
          <div>
            <p>FIFA WORLD CUP · LIVE VAR REVIEW</p>
            <h2>
              <span>ARG</span> {score} <span>EGY</span>
            </h2>
          </div>
          <div className={`matchClock ${settled ? "settled" : ""}`}>
            <i /> {matchClock}
          </div>
        </div>

        <div className="videoFrame realVideo">
          <video
            ref={videoRef}
            src="/argentina-egypt-var.mp4"
            playsInline
            muted
            controls
            preload="metadata"
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onTimeUpdate={(event) =>
              setElapsed(event.currentTarget.currentTime)
            }
            onEnded={() => setIsPlaying(false)}
          />
          <div className="videoTopline">
            <span className="broadcastLive">
              <i /> {isPlaying ? "LIVE SIM" : "PAUSED"}
            </span>
            <span>{matchClock}</span>
          </div>
          <div className="scoreBug">
            ARG <strong>{score}</strong> EGY
          </div>
        </div>

        <div className={`statusCard ${settled ? "statusSettled" : ""}`}>
          <div className="statusPulse">
            <span>{settled ? "✓" : goalOccurred ? "VAR" : "LIVE"}</span>
          </div>
          <div>
            <p>{reviewPhase.eyebrow}</p>
            <h3>{reviewPhase.title}</h3>
            <small>{reviewPhase.detail}</small>
          </div>
          <div className="closeTimer">
            <strong>{secondsRemaining}s</strong>
            <small>
              {!goalOccurred
                ? "to market"
                : acceptingBets
                  ? "to decision"
                  : "closed"}
            </small>
          </div>
        </div>

        <section className="signalCard" aria-label="Interpolated market signal">
          <div className="signalHeader">
            <div>
              <span>POLYMARKET SIGNAL</span>
              <small>Event-aligned linear interpolation</small>
            </div>
            <strong>
              {!goalOccurred
                ? "PRE-GOAL"
                : acceptingBets
                  ? "UPDATING"
                  : "FINAL"}
            </strong>
          </div>
          <div className="signalBar">
            <span style={{ width: `${quote.argentina}%` }} />
          </div>
          <div className="signalValues">
            <div>
              <span>Argentina advances</span>
              <strong>{percent(quote.argentina)}</strong>
            </div>
            <div>
              <span>Egypt advances</span>
              <strong>{percent(quote.egypt)}</strong>
            </div>
          </div>
        </section>

        <section className={`featuredPool ${settled ? "resolved" : ""}`}>
          <div className="poolTopline">
            <span>
              {settled
                ? "RESOLVED POOL"
                : acceptingBets
                  ? "ACTIVE POOL"
                  : "MARKET ARMED"}
            </span>
            <strong>{money.format(poolAmount)} USDC</strong>
          </div>
          <h3>Will Egypt&apos;s goal stand?</h3>
          <p>
            Pool #{LIVE_POOL_ID} · Launched at 57:55 ·{" "}
            {settled
              ? "Overturned and paid"
              : acceptingBets
                ? "Accepting bets"
                : "Opens when the goal occurs"}
          </p>
          <div className="quickOdds">
            <button
              data-testid="goal-bet"
              disabled={!acceptingBets}
              onClick={() => openBetSlip("GOAL")}
            >
              <span>GOAL · CONFIRMED</span>
              <strong>{quote.goalOdds.toFixed(2)}</strong>
              <small>{percent(quote.goalProbability * 100)} implied</small>
            </button>
            <button
              data-testid="no-goal-bet"
              disabled={!acceptingBets}
              onClick={() => openBetSlip("NO_GOAL")}
            >
              <span>NO GOAL · OVERTURNED</span>
              <strong>{quote.noGoalOdds.toFixed(2)}</strong>
              <small>{percent(quote.noGoalProbability * 100)} implied</small>
            </button>
          </div>
          {settled && (
            <button className="replayButton" onClick={replaySimulation}>
              Replay timed simulation
            </button>
          )}
        </section>
      </section>

      <section className="contentSection">
        <div className="sectionHeading">
          <div>
            <span>MARKETS</span>
            <h2>Current and historical pools</h2>
          </div>
          <span className="countBadge">3</span>
        </div>

        <div className="poolList">
          {!settled && (
            <button
              className={`poolListCard ${acceptingBets ? "active" : ""}`}
              disabled={!acceptingBets}
              onClick={() => openBetSlip("NO_GOAL")}
            >
              <span className={`poolState ${acceptingBets ? "" : "muted"}`}>
                {acceptingBets ? "LIVE" : "SOON"}
              </span>
              <div>
                <strong>Argentina vs Egypt</strong>
                <small>
                  {acceptingBets ? "Goal review" : "Waiting for goal"} ·{" "}
                  {matchClock} · {money.format(poolAmount)}
                </small>
              </div>
              <span>{acceptingBets ? "Open ›" : "Armed"}</span>
            </button>
          )}
          {settled && (
            <article className="poolListCard won">
              <span className="poolState">PAID</span>
              <div>
                <strong>Argentina vs Egypt</strong>
                <small>NO GOAL · Overturned · Pool #{LIVE_POOL_ID}</small>
              </div>
              <span>✓</span>
            </article>
          )}
          <article className="poolListCard">
            <span className="poolState muted">PAID</span>
            <div>
              <strong>Brazil vs France</strong>
              <small>GOAL · Confirmed · $8,420.00</small>
            </div>
            <span>✓</span>
          </article>
          <article className="poolListCard">
            <span className="poolState muted">PAID</span>
            <div>
              <strong>Spain vs Japan</strong>
              <small>NO GOAL · Overturned · $3,180.00</small>
            </div>
            <span>✓</span>
          </article>
        </div>
      </section>

      <section className="contentSection dashboard">
        <div className="sectionHeading">
          <div>
            <span>MY DASHBOARD</span>
            <h2>
              {connected ? shortAddress(walletAddress) : "Connect your wallet"}
            </h2>
          </div>
          <span className="walletStatus">
            {connected ? "CONNECTED" : "PHANTOM"}
          </span>
        </div>

        {!connected ? (
          <div className="emptyState">
            <strong>Your bets and payouts will appear here.</strong>
            <p>Connect Phantom to place a bet and track settlement.</p>
            <WalletMultiButton />
          </div>
        ) : (
          <div className="dashboardGrid">
            <div className="dashboardColumn">
              <h3>My active bets</h3>
              {bets.length === 0 ? (
                <p className="emptyLine">No active bets yet.</p>
              ) : (
                bets.map((bet) => (
                  <article key={bet.id} className="betRow">
                    <div>
                      <strong>
                        {bet.side === "GOAL" ? "Confirmed" : "Overturned"}
                      </strong>
                      <small>
                        Pool #{bet.poolId} · {bet.placedAt}
                      </small>
                    </div>
                    <span>
                      {money.format(bet.amount)} @ {bet.odds.toFixed(2)}
                    </span>
                  </article>
                ))
              )}
            </div>
            <div className="dashboardColumn">
              <h3>My payouts</h3>
              {payouts.length === 0 ? (
                <p className="emptyLine">No payouts received.</p>
              ) : (
                payouts.map((payout) => (
                  <article key={payout.id} className="payoutRow">
                    <div>
                      <strong>{money.format(payout.amount)}</strong>
                      <small>Pool #{payout.poolId}</small>
                    </div>
                    <span>{payout.status}</span>
                  </article>
                ))
              )}
            </div>
          </div>
        )}
      </section>

      <footer>
        <span>18+</span>
        <a href="#">Play responsibly</a>
        <a href="#">Terms</a>
        <small>Prototype · USDC display values</small>
      </footer>

      {betSlipOpen && (
        <div className="sheetBackdrop" onClick={() => setBetSlipOpen(false)}>
          <section
            className="betSheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bet-sheet-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sheetHandle" />
            <div className="sheetHeader">
              <div>
                <span>POOL #{LIVE_POOL_ID}</span>
                <h2 id="bet-sheet-title">Place your VAR bet</h2>
              </div>
              <button
                onClick={() => setBetSlipOpen(false)}
                aria-label="Close bet slip"
              >
                ×
              </button>
            </div>

            <div className="optionToggle">
              <button
                className={selectedSide === "GOAL" ? "selected goal" : ""}
                onClick={() => setSelectedSide("GOAL")}
              >
                Confirmed <strong>{quote.goalOdds.toFixed(2)}</strong>
              </button>
              <button
                className={selectedSide === "NO_GOAL" ? "selected noGoal" : ""}
                onClick={() => setSelectedSide("NO_GOAL")}
              >
                Overturned <strong>{quote.noGoalOdds.toFixed(2)}</strong>
              </button>
            </div>

            <label className="stakeLabel" htmlFor="stake-input">
              Amount in USDC
            </label>
            <div className="stakeField">
              <span>$</span>
              <input
                id="stake-input"
                value={stake}
                onChange={(event) =>
                  setStake(event.target.value.replace(/[^0-9.]/g, ""))
                }
                inputMode="decimal"
              />
              <small>USDC</small>
            </div>
            <div className="stakeChips">
              {[1, 10, 100].map((amount) => (
                <button
                  key={amount}
                  className={stakeNumber === amount ? "active" : ""}
                  onClick={() => setStake(String(amount))}
                >
                  ${amount}
                </button>
              ))}
            </div>

            <div className="betSummary">
              <span>Potential payout</span>
              <strong>{money.format(potentialPayout)}</strong>
            </div>

            {connected ? (
              <button
                className="placeBetButton"
                disabled={!validStake || submitting || !acceptingBets}
                onClick={placeBet}
              >
                {submitting
                  ? "Submitting…"
                  : `Place bet at ${selectedOdds.toFixed(2)}`}
              </button>
            ) : (
              <div className="connectPrompt">
                <p>Connect Phantom before placing this bet.</p>
                <WalletMultiButton />
              </div>
            )}
            <small className="lockNote">
              Odds lock when the backend accepts the order.
            </small>
          </section>
        </div>
      )}
    </main>
  );
}
