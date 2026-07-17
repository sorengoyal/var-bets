"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { io } from "socket.io-client";

import { MATCH_TIMELINE, matchClockAt, quoteAt } from "./simulation";

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

type SettlementSummary = {
  totalStaked: number;
  payout: number;
  net: number;
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

function WalletConnectButton({ mounted }: { mounted: boolean }) {
  if (!mounted) {
    return (
      <button className="walletPlaceholder" disabled>
        Connect Phantom
      </button>
    );
  }

  return <WalletMultiButton />;
}

export default function Home() {
  const { connected, publicKey } = useWallet();
  const videoRef = useRef<HTMLVideoElement>(null);
  const settlementHandled = useRef(false);
  const [hasEntered, setHasEntered] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [poolAmount, setPoolAmount] = useState(STARTING_POOL);
  const [bets, setBets] = useState<BetRecord[]>([]);
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [demoWalletConnected, setDemoWalletConnected] = useState(false);
  const [usdcBalance, setUsdcBalance] = useState(0);
  const [stake, setStake] = useState("10");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [settlementSummary, setSettlementSummary] =
    useState<SettlementSummary | null>(null);

  const walletConnected = connected || demoWalletConnected;
  const walletAddress =
    publicKey?.toBase58() ?? (demoWalletConnected ? "Demo7xUSDC9Wallet" : "");
  const quote = useMemo(() => quoteAt(elapsed), [elapsed]);
  const goalOccurred = elapsed >= MATCH_TIMELINE.goalAt;
  const settled = elapsed >= MATCH_TIMELINE.decisionAt;
  const acceptingBets = goalOccurred && !settled;
  const score = goalOccurred && !settled ? "0 – 2" : "0 – 1";
  const matchClock = matchClockAt(elapsed);
  const stakeNumber = Number(stake);
  const validStake =
    Number.isFinite(stakeNumber) &&
    stakeNumber > 0 &&
    stakeNumber <= usdcBalance;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!hasEntered) return;
    void videoRef.current?.play().catch(() => setIsPlaying(false));
  }, [hasEntered]);

  useEffect(() => {
    setUsdcBalance(walletConnected ? 1000 : 0);
  }, [walletConnected]);

  useEffect(() => {
    if (walletConnected) {
      setHasEntered(true);
      return;
    }

    if (hasEntered) videoRef.current?.pause();
    setHasEntered(false);
  }, [hasEntered, walletConnected]);

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
    const totalStaked = bets.reduce((total, bet) => total + bet.amount, 0);

    if (bets.length > 0) {
      setSettlementSummary({
        totalStaked,
        payout: winnings,
        net: winnings - totalStaked,
      });
    }

    if (winnings > 0) {
      setUsdcBalance((current) => current + winnings);
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
  }, [bets, settled]);

  async function placeBet(side: Side) {
    if (!walletConnected || !walletAddress || !validStake || !acceptingBets)
      return;
    setSubmitting(true);
    const lockedOdds = side === "GOAL" ? quote.goalOdds : quote.noGoalOdds;

    try {
      if (API_URL) {
        const response = await fetch(`${API_URL}/api/bets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            poolId: LIVE_POOL_ID,
            wallet_address: walletAddress,
            amount: stakeNumber,
            option: side,
          }),
        });
        if (!response.ok) throw new Error("Bet request failed");
      }

      const bet: BetRecord = {
        id: Date.now(),
        poolId: LIVE_POOL_ID,
        side,
        amount: stakeNumber,
        odds: lockedOdds,
        payout: stakeNumber * lockedOdds,
        placedAt: matchClock,
      };
      setBets((current) => [bet, ...current]);
      setPoolAmount((current) => current + stakeNumber);
      setUsdcBalance((current) => current - stakeNumber);
      setToast(
        `${side === "GOAL" ? "Goal" : "No Goal"} bet accepted at ${lockedOdds.toFixed(2)}`,
      );
    } catch {
      setToast("Bet could not be submitted. Check the API connection.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!hasEntered) {
    return (
      <main className="entryShell simpleLanding">
        <div className="entryGlow entryGlowOne" />
        <div className="entryGlow entryGlowTwo" />
        <section className="landingContent">
          <Brand />
          <h1>
            Place a bet on whether a VAR will overturn the on-field decision
          </h1>

          <div className="landingWallet">
            <span>CONNECT WALLET</span>
            <div className="walletChoices">
              <WalletConnectButton mounted={mounted} />
              <button
                className="demoWalletButton"
                onClick={() => setDemoWalletConnected(true)}
              >
                Use demo wallet
              </button>
            </div>
            <small>Includes 1,000 USDC for testing</small>
          </div>
        </section>
        <p className="entryLegal">18+ · Play responsibly</p>
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
          <span className="balancePill">
            {money.format(usdcBalance)} <small>USDC</small>
          </span>
          {demoWalletConnected ? (
            <button
              className="demoHeaderWallet"
              onClick={() => setDemoWalletConnected(false)}
            >
              Demo7…llet
            </button>
          ) : (
            <WalletConnectButton mounted={mounted} />
          )}
        </div>
      </header>

      <section className="liveMarket">
        <div className="matchRow">
          <div>
            <p>FIFA WORLD CUP · LIVE</p>
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
              <i /> {isPlaying ? "LIVE" : "PAUSED"}
            </span>
            <span>{matchClock}</span>
          </div>
          <div className="scoreBug">
            ARG <strong>{score}</strong> EGY
          </div>
        </div>

        <section className="signalCard" aria-label="Interpolated market signal">
          <div className="signalHeader">
            <div>
              <span>POLYMARKET SIGNAL</span>
              <small>Live match winner probabilities</small>
            </div>
            <strong>{settled ? "UPDATED" : "LIVE"}</strong>
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

        {goalOccurred && (
          <section className={`featuredPool ${settled ? "resolved" : ""}`}>
            <div className="poolTopline">
              <span>{settled ? "RESOLVED POOL" : "ACTIVE POOL"}</span>
              <strong>{money.format(poolAmount)} USDC</strong>
            </div>
            <h3>Will Egypt&apos;s goal stand?</h3>
            <p>
              Pool #{LIVE_POOL_ID} · Launched at 57:55 ·{" "}
              {settled ? "Overturned and paid" : "Accepting bets"}
            </p>
            <div className="poolStake">
              <div className="poolStakeHeader">
                <label htmlFor="pool-stake">Your stake</label>
                <span>Available {money.format(usdcBalance)} USDC</span>
              </div>
              <div className="stakeField">
                <span>$</span>
                <input
                  id="pool-stake"
                  value={stake}
                  onChange={(event) =>
                    setStake(event.target.value.replace(/[^0-9.]/g, ""))
                  }
                  inputMode="decimal"
                  disabled={!walletConnected || settled}
                  aria-label="Bet stake"
                />
                <small>USDC</small>
              </div>
              <div className="stakeChips" aria-label="Quick stake amounts">
                {[1, 10, 100].map((amount) => (
                  <button
                    key={amount}
                    className={stakeNumber === amount ? "active" : ""}
                    disabled={!walletConnected || settled}
                    onClick={() => setStake(String(amount))}
                  >
                    ${amount}
                  </button>
                ))}
              </div>
            </div>
            <div className="quickOdds">
              <button
                data-testid="goal-bet"
                disabled={
                  !walletConnected ||
                  !acceptingBets ||
                  !validStake ||
                  submitting
                }
                onClick={() => placeBet("GOAL")}
              >
                <span>GOAL · CONFIRMED</span>
                <strong>
                  {submitting ? "···" : quote.goalOdds.toFixed(2)}
                </strong>
                <small>
                  {validStake
                    ? `${money.format(stakeNumber * quote.goalOdds)} return`
                    : "Enter a valid stake"}
                </small>
              </button>
              <button
                data-testid="no-goal-bet"
                disabled={
                  !walletConnected ||
                  !acceptingBets ||
                  !validStake ||
                  submitting
                }
                onClick={() => placeBet("NO_GOAL")}
              >
                <span>NO GOAL · OVERTURNED</span>
                <strong>
                  {submitting ? "···" : quote.noGoalOdds.toFixed(2)}
                </strong>
                <small>
                  {validStake
                    ? `${money.format(stakeNumber * quote.noGoalOdds)} return`
                    : "Enter a valid stake"}
                </small>
              </button>
            </div>
          </section>
        )}
      </section>

      <section className="contentSection">
        <div className="sectionHeading">
          <div>
            <span>UPCOMING</span>
            <h2>Next matches</h2>
          </div>
          <span className="countBadge">2</span>
        </div>

        <div className="poolList">
          <article className="poolListCard">
            <span className="poolState muted">NEXT</span>
            <div>
              <strong>France vs England</strong>
              <small>World Cup · Tomorrow 15:00</small>
            </div>
            <span>›</span>
          </article>
          <article className="poolListCard">
            <span className="poolState muted">NEXT</span>
            <div>
              <strong>Spain vs Argentina</strong>
              <small>World Cup · Tomorrow 19:30</small>
            </div>
            <span>›</span>
          </article>
        </div>
      </section>

      <section className="contentSection dashboard">
        <div className="sectionHeading">
          <div>
            <span>MY DASHBOARD</span>
            <h2>
              {walletConnected
                ? shortAddress(walletAddress)
                : "Connect your wallet"}
            </h2>
          </div>
          <span className="walletStatus">
            {walletConnected ? `${money.format(usdcBalance)} USDC` : "PHANTOM"}
          </span>
        </div>

        {!walletConnected ? (
          <div className="emptyState">
            <strong>Your bets and payouts will appear here.</strong>
            <p>Connect Phantom or a preloaded demo wallet to continue.</p>
            <div className="walletChoices dashboardWalletChoices">
              <WalletConnectButton mounted={mounted} />
              <button
                className="demoWalletButton"
                onClick={() => setDemoWalletConnected(true)}
              >
                Use demo wallet
              </button>
            </div>
          </div>
        ) : (
          <div className="dashboardGrid">
            <div className="dashboardColumn">
              <h3>{settled ? "Bet history" : "My active bets"}</h3>
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

      {settlementSummary && (
        <div className="settlementBackdrop">
          <section
            className="settlementModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settlement-title"
          >
            <span className="settlementIcon">✓</span>
            <p>OFFICIAL VAR DECISION</p>
            <h2 id="settlement-title">NO GOAL</h2>
            <small>The on-field goal has been overturned.</small>

            <div className="settlementBreakdown">
              <div>
                <span>Total bet</span>
                <strong>{money.format(settlementSummary.totalStaked)}</strong>
              </div>
              <div>
                <span>Total payout</span>
                <strong>{money.format(settlementSummary.payout)}</strong>
              </div>
            </div>

            <div
              className={`settlementNet ${settlementSummary.net >= 0 ? "won" : "lost"}`}
            >
              <span>{settlementSummary.net >= 0 ? "You won" : "You lost"}</span>
              <strong>{money.format(Math.abs(settlementSummary.net))}</strong>
            </div>

            <button onClick={() => setSettlementSummary(null)}>Done</button>
          </section>
        </div>
      )}

      <footer>
        <span>18+</span>
        <a href="#">Play responsibly</a>
        <a href="#">Terms</a>
        <small>Wallet balance shown in USDC</small>
      </footer>
    </main>
  );
}
