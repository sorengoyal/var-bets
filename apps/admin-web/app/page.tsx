"use client";

import { useEffect, useRef, useState } from "react";
import type {
  DashboardSnapshot,
  PricePoint,
  ReviewOutcome,
} from "@var-bets/dashboard-contract";
import { useDashboardData } from "../lib/dashboard-adapter";

type Series = "ARG" | "EGY" | "ALL";
type ReplayMode = "repeat" | "random";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

function signedMoney(value: number): string {
  return `${value >= 0 ? "+" : ""}${money.format(value)}`;
}

function Brand() {
  return (
    <div className="brand">
      <span>V</span>
      <div>
        VAR<strong>BET</strong>
      </div>
      <small>ADMIN</small>
    </div>
  );
}

function linePoints(
  history: PricePoint[],
  probability: "argProbability" | "egyProbability",
): string {
  const maxSecond = Math.max(139, history.at(-1)?.second ?? 139);
  return history
    .map((point) => {
      const x = 46 + (point.second / maxSecond) * 770;
      const y = 270 - point[probability] * 2.35;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function areaPath(points: string): string {
  if (!points) return "";
  const coordinates = points.split(" ");
  return `M${coordinates.join(" L")} L${coordinates.at(-1)?.split(",")[0]} 270 L46 270 Z`;
}

function OddsChart({
  series,
  history,
  outcome,
}: {
  series: Series;
  history: PricePoint[];
  outcome: ReviewOutcome;
}) {
  const showArg = series === "ARG" || series === "ALL";
  const showEgy = series === "EGY" || series === "ALL";
  const argPoints = linePoints(history, "argProbability");
  const egyPoints = linePoints(history, "egyProbability");
  const latest = history.at(-1);
  const maxSecond = Math.max(139, latest?.second ?? 139);
  const latestX = latest ? 46 + (latest.second / maxSecond) * 770 : 46;
  const labelsOverlap = latest
    ? Math.abs(latest.argProbability - latest.egyProbability) < 12
    : false;
  const argY = latest ? 270 - latest.argProbability * 2.35 : 270;
  const egyY = latest ? 270 - latest.egyProbability * 2.35 : 270;
  const labelX = Math.min(latestX + 9, 741);
  const currentSecond = latest?.second ?? 0;
  const showGoalAnimation = currentSecond <= 12;
  const showVarAnimation = currentSecond >= 50 && currentSecond < 64;
  const showDecisionAnimation = currentSecond >= 110 && outcome !== null;

  return (
    <div className="chartWrap">
      <svg
        viewBox="0 0 840 300"
        role="img"
        aria-label="Argentina and Egypt Polymarket price history"
      >
        <defs>
          <linearGradient id="argFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#1677c8" stopOpacity=".22" />
            <stop offset="1" stopColor="#1677c8" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="egyFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#d84253" stopOpacity=".16" />
            <stop offset="1" stopColor="#d84253" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[60, 120, 180, 240].map((y) => (
          <line key={y} x1="46" x2="816" y1={y} y2={y} className="gridLine" />
        ))}
        {[80, 60, 40, 20].map((value, index) => (
          <text key={value} x="8" y={64 + index * 60}>
            {value}%
          </text>
        ))}
        {showArg && <path d={areaPath(argPoints)} fill="url(#argFill)" />}
        {showEgy && <path d={areaPath(egyPoints)} fill="url(#egyFill)" />}
        {showArg && <polyline points={argPoints} className="argLine" />}
        {showEgy && <polyline points={egyPoints} className="egyLine" />}
        {latest && showArg && (
          <g
            className="chartValueLabel argValueLabel"
            transform={`translate(${labelX} ${argY - (labelsOverlap ? 20 : 0)})`}
          >
            <rect width="76" height="24" rx="7" y="-12" />
            <text x="38" y="4" textAnchor="middle">
              ARG {latest.argProbability.toFixed(1)}%
            </text>
          </g>
        )}
        {latest && showEgy && (
          <g
            className="chartValueLabel egyValueLabel"
            transform={`translate(${labelX} ${egyY + (labelsOverlap ? 20 : 0)})`}
          >
            <rect width="76" height="24" rx="7" y="-12" />
            <text x="38" y="4" textAnchor="middle">
              EGY {latest.egyProbability.toFixed(1)}%
            </text>
          </g>
        )}
        <line x1="46" x2="46" y1="35" y2="270" className="eventLine goal" />
        <line
          x1="323"
          x2="323"
          y1="35"
          y2="270"
          className="eventLine monitor"
        />
        <line
          x1="655"
          x2="655"
          y1="35"
          y2="270"
          className="eventLine decision"
        />
        <line x1="816" x2="816" y1="35" y2="270" className="currentLine" />
        <text x="46" y="289" textAnchor="middle">
          57:55
        </text>
        <text x="323" y="289" textAnchor="middle">
          58:45
        </text>
        <text x="655" y="289" textAnchor="middle">
          59:45
        </text>
        <text x="816" y="289" textAnchor="end">
          60:14
        </text>
      </svg>
      {showGoalAnimation && (
        <div className="chartEventAnimation goalScoredAnimation">
          <div className="goalImpactScene" aria-hidden="true">
            <span className="animatedFootball">⚽</span>
            <span className="animatedNet" />
          </div>
          <strong>GOAL SCORED</strong>
          <small>Ball hits the net</small>
        </div>
      )}
      {showVarAnimation && (
        <div className="chartEventAnimation varSignalAnimation">
          <div className="varReferee" aria-hidden="true">
            <span className="varScreenSignal" />
            <span className="refereeHead" />
            <span className="refereeBody" />
            <span className="refereeArm leftArm" />
            <span className="refereeArm rightArm" />
            <span className="refereeWhistle" />
          </div>
          <strong>VAR CHECK</strong>
          <small>Referee signals a review</small>
        </div>
      )}
      {showDecisionAnimation && outcome === "GOAL" && (
        <div className="chartEventAnimation finalDecisionAnimation goalDecisionAnimation">
          <div className="decisionConfetti" aria-hidden="true">
            {Array.from({ length: 12 }, (_, index) => (
              <i key={index} />
            ))}
          </div>
          <div className="decisionGoalIcon" aria-hidden="true">
            <span>⚽</span>
          </div>
          <strong>GOAL</strong>
          <small>Final decision</small>
        </div>
      )}
      {showDecisionAnimation && outcome === "NO_GOAL" && (
        <div className="chartEventAnimation finalDecisionAnimation noGoalDecisionAnimation">
          <span className="decisionCross" aria-hidden="true">
            ×
          </span>
          <strong>NO GOAL</strong>
          <small>Final decision</small>
        </div>
      )}
      <div className="chartAnnotations">
        <span>
          <i className="goalDot" />
          Ball in net
        </span>
        <span>
          <i className="monitorDot" />
          Monitor check
        </span>
        <span>
          <i className="decisionDot" />
          NO GOAL
        </span>
      </div>
    </div>
  );
}

function SettlementSummary({ snapshot }: { snapshot: DashboardSnapshot }) {
  const requiredBookProfit =
    snapshot.pool.acceptedHandle * snapshot.model.minimumBookMargin -
    snapshot.model.maximumUnhedgedLoss;
  const totalHedged =
    snapshot.settlement.polymarketGoalHedges.amount +
    snapshot.settlement.polymarketNoGoalHedges.amount;
  const totalHedgeOrders =
    snapshot.settlement.polymarketGoalHedges.count +
    snapshot.settlement.polymarketNoGoalHedges.count;
  const realizedHedgeGain =
    snapshot.pool.outcome === "GOAL"
      ? snapshot.pool.hedgePayoffIfGoal
      : snapshot.pool.hedgePayoffIfNoGoal;

  return (
    <>
      <div className="settlementTitle">
        <div>
          <span>FINAL SETTLEMENT</span>
          <h4>Simulation totals</h4>
        </div>
        <b>NO GOAL</b>
      </div>
      <div className="settlementCategories">
        <section>
          <span>BETS</span>
          <dl>
            <div>
              <dt>Total pool size</dt>
              <dd>{money.format(snapshot.pool.acceptedHandle)}</dd>
            </div>
            <div>
              <dt>Goal bets</dt>
              <dd>{money.format(snapshot.settlement.userGoalBets.amount)}</dd>
            </div>
            <div>
              <dt>No Goal bets</dt>
              <dd>{money.format(snapshot.settlement.userNoGoalBets.amount)}</dd>
            </div>
          </dl>
        </section>
        <section>
          <span>HEDGE</span>
          <dl>
            <div>
              <dt>Total amount hedged</dt>
              <dd>{money.format(totalHedged)}</dd>
            </div>
            <div>
              <dt>Hedge orders</dt>
              <dd>{totalHedgeOrders.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Hedge gains</dt>
              <dd className={realizedHedgeGain >= 0 ? "wonText" : "lostText"}>
                {signedMoney(realizedHedgeGain)}
              </dd>
            </div>
          </dl>
        </section>
        <section className="settlementSummaryCategory">
          <span>SUMMARY</span>
          <dl>
            <div>
              <dt>Total payout</dt>
              <dd className="lostText">
                {money.format(-Math.abs(snapshot.settlement.totalPayout))}
              </dd>
            </div>
            <div>
              <dt>Total fees</dt>
              <dd className="lostText">
                {money.format(-Math.abs(snapshot.pool.executionCost))}
              </dd>
            </div>
            <div>
              <dt>Total profit</dt>
              <dd
                className={
                  snapshot.settlement.totalProfit >= 0 ? "wonText" : "lostText"
                }
              >
                {signedMoney(snapshot.settlement.totalProfit)}
              </dd>
            </div>
          </dl>
        </section>
      </div>
      <p
        className={
          snapshot.settlement.totalProfit >= requiredBookProfit
            ? "profitNotice"
            : "riskNotice"
        }
      >
        Required book profit: {money.format(requiredBookProfit)}. Realized
        profit: {money.format(snapshot.settlement.totalProfit)}. The floor is
        20% of accepted handle less the $1,000 startup risk buffer.
      </p>
    </>
  );
}

export default function AdminDashboard() {
  const [series, setSeries] = useState<Series>("ALL");
  const [poolExpanded, setPoolExpanded] = useState(true);
  const [settlementModalOpen, setSettlementModalOpen] = useState(false);
  const [replayMode, setReplayMode] = useState<ReplayMode>("repeat");
  const settlementWasShown = useRef(false);
  const { connected, resetSimulation, snapshot } = useDashboardData();
  const { fixture, market, model, pool } = snapshot;
  const requestedBets = pool.acceptedBets + pool.rejectedBets;
  const acceptanceRate = requestedBets
    ? pool.acceptedBets / requestedBets
    : pool.requestedHandle
      ? pool.acceptedHandle / pool.requestedHandle
      : 0;
  const eventProfit =
    pool.status === "SETTLED" ? pool.profitIfNoGoal : pool.worstCaseProfit;
  const outcomeText = pool.outcome ?? "PENDING";

  useEffect(() => {
    if (pool.status === "OPEN") settlementWasShown.current = false;
    if (connected && pool.status === "SETTLED" && !settlementWasShown.current) {
      settlementWasShown.current = true;
      setSettlementModalOpen(true);
    }
  }, [connected, pool.status]);

  const restartReplay = async () => {
    setSettlementModalOpen(false);
    settlementWasShown.current = false;
    await resetSimulation(replayMode);
  };

  return (
    <main>
      <header className="topbar">
        <Brand />
        <div className="topActions">
          <span className={`systemLive ${connected ? "" : "offline"}`}>
            <i /> {connected ? "ADAPTER LIVE" : "ADAPTER OFFLINE"}
          </span>
          <span className="modeBadge">{snapshot.mode}</span>
          {snapshot.mode === "SIMULATION" && (
            <>
              <select
                className="replayModeSelect"
                aria-label="Replay mode"
                value={replayMode}
                onChange={(event) =>
                  setReplayMode(event.target.value as ReplayMode)
                }
              >
                <option value="repeat">Repeat scenario</option>
                <option value="random">New random run</option>
              </select>
              <button
                className="resetButton"
                onClick={() => void restartReplay()}
              >
                Restart replay
              </button>
            </>
          )}
          <button className="operatorWallet">0x5825…8Fe1</button>
          <button className="iconButton" aria-label="Settings">
            ⚙
          </button>
        </div>
      </header>

      <div className="page">
        <section className="pageHeading">
          <div>
            <span>OPERATIONS</span>
            <h1>Global market control</h1>
            <p>
              Monitor engine quotes, user flow, liabilities, and automated
              hedges.
            </p>
          </div>
        </section>

        <section className="matchCard">
          <div className="matchHeader">
            <div className="liveBadge">
              <i /> {pool.status === "OPEN" ? "LIVE" : "FINAL"}
            </div>
            <div className="matchIdentity">
              <span>{fixture.competition}</span>
              <h2>
                {fixture.homeTeam}{" "}
                <b>
                  {fixture.homeScore}–{fixture.awayScore}
                </b>{" "}
                {fixture.awayTeam}
              </h2>
              <small>Second half · {fixture.matchClock}</small>
            </div>
            <div className="matchTotals">
              <span>
                {pool.status === "OPEN" ? "1 active pool" : "1 settled pool"}
              </span>
              <strong>{money.format(pool.acceptedHandle)} USDC</strong>
              <small>Total accepted handle</small>
            </div>
          </div>

          <div className="marketWorkspace">
            <section className="poolCard">
              <button
                className="poolHeader"
                onClick={() => setPoolExpanded((value) => !value)}
              >
                <div className="poolIdentity">
                  <span
                    className={
                      pool.status === "SETTLED" ? "settledBadge" : "openBadge"
                    }
                  >
                    {pool.status === "SETTLED"
                      ? "✓ SETTLED"
                      : "● ACCEPTING BETS"}
                  </span>
                  <h3>Pool stats</h3>
                  <small>
                    Ball in net 57:55 · Decision 59:45 · Outcome: {outcomeText}
                  </small>
                </div>
                <div className="poolResult">
                  <span>
                    {pool.status === "SETTLED" ? "EVENT P&L" : "WORST-CASE P&L"}
                  </span>
                  <strong className={eventProfit >= 0 ? "wonText" : "lostText"}>
                    {signedMoney(eventProfit)}
                  </strong>
                  <small>
                    {poolExpanded ? "Hide details ↑" : "Show details ↓"}
                  </small>
                </div>
              </button>

              {poolExpanded && (
                <div className="poolBody">
                  <div className="poolStatRow">
                    <article>
                      <span>TOTAL POOL</span>
                      <strong>{money.format(pool.acceptedHandle)}</strong>
                      <small>{pool.acceptedBets} accepted bets</small>
                    </article>
                    <article>
                      <span>CURRENT LIABILITY</span>
                      <strong>
                        {money.format(
                          Math.max(pool.payoutIfGoal, pool.payoutIfNoGoal),
                        )}
                      </strong>
                      <small>
                        {(acceptanceRate * 100).toFixed(1)}% accepted
                      </small>
                    </article>
                  </div>
                  <div className="marketTable">
                    <div className="tableHeader">
                      <span>MARKET</span>
                      <span>LIVE ODDS</span>
                      <span>POOL AMOUNT</span>
                      <span>HEDGE PLACED</span>
                      <span>RESULT</span>
                    </div>
                    <div>
                      <strong>Goal confirmed</strong>
                      <strong className="liveOddsValue">
                        {pool.goalOdds ? pool.goalOdds.toFixed(2) : "—"}
                      </strong>
                      <span className="moneyCell">
                        {money.format(snapshot.settlement.userGoalBets.amount)}
                        <small>
                          {snapshot.settlement.userGoalBets.count} bets
                        </small>
                      </span>
                      <span className="moneyCell">
                        {money.format(
                          snapshot.settlement.polymarketGoalHedges.amount,
                        )}
                        <small>
                          {snapshot.settlement.polymarketGoalHedges.count}{" "}
                          orders
                        </small>
                      </span>
                      <span
                        className={
                          pool.outcome === "GOAL" ? "wonText" : "lostText"
                        }
                      >
                        {pool.outcome === null
                          ? "Open"
                          : pool.outcome === "GOAL"
                            ? "Won ✓"
                            : "Lost"}
                      </span>
                    </div>
                    <div>
                      <strong>No Goal overturned</strong>
                      <strong className="liveOddsValue">
                        {pool.noGoalOdds ? pool.noGoalOdds.toFixed(2) : "—"}
                      </strong>
                      <span className="moneyCell">
                        {money.format(
                          snapshot.settlement.userNoGoalBets.amount,
                        )}
                        <small>
                          {snapshot.settlement.userNoGoalBets.count} bets
                        </small>
                      </span>
                      <span className="moneyCell">
                        {money.format(
                          snapshot.settlement.polymarketNoGoalHedges.amount,
                        )}
                        <small>
                          {snapshot.settlement.polymarketNoGoalHedges.count}{" "}
                          orders
                        </small>
                      </span>
                      <span
                        className={
                          pool.outcome === "NO_GOAL" ? "wonText" : "lostText"
                        }
                      >
                        {pool.outcome === null
                          ? "Open"
                          : pool.outcome === "NO_GOAL"
                            ? "Won ✓"
                            : "Lost"}
                      </span>
                    </div>
                  </div>

                  {pool.status === "SETTLED" && (
                    <button
                      className="viewSettlementButton"
                      onClick={() => setSettlementModalOpen(true)}
                    >
                      View final settlement
                    </button>
                  )}
                </div>
              )}
            </section>

            <section className="panel oddsPanel">
              <div className="panelHeader">
                <div>
                  <span>POLYMARKET MARKET</span>
                  <h3>{market.title}</h3>
                  <small>
                    Interpolated event-aligned observations · updates every
                    second
                  </small>
                </div>
                <div className="currentOdds">
                  <span>
                    <i className="argDot" />
                    ARG <strong>{market.argProbability.toFixed(2)}%</strong>
                  </span>
                  <span>
                    <i className="egyDot" />
                    EGY <strong>{market.egyProbability.toFixed(2)}%</strong>
                  </span>
                </div>
              </div>
              <div className="seriesToggle">
                {(["ALL", "ARG", "EGY"] as Series[]).map((item) => (
                  <button
                    key={item}
                    className={series === item ? "active" : ""}
                    onClick={() => setSeries(item)}
                  >
                    {item === "ALL" ? "Both" : item}
                  </button>
                ))}
              </div>
              <OddsChart
                series={series}
                history={market.history}
                outcome={pool.outcome}
              />
            </section>
          </div>
        </section>

        <div className="lowerGrid">
          <section className="listPanel">
            <div className="listTitle">
              <div>
                <span>SCHEDULE</span>
                <h3>Upcoming matches</h3>
              </div>
              <b>2</b>
            </div>
            <article>
              <div>
                <strong>France vs England</strong>
                <small>FIFA World Cup</small>
              </div>
              <span>Tomorrow · 15:00</span>
            </article>
            <article>
              <div>
                <strong>Spain vs Argentina</strong>
                <small>FIFA World Cup</small>
              </div>
              <span>Tomorrow · 19:30</span>
            </article>
          </section>
          <section className="listPanel">
            <div className="listTitle">
              <div>
                <span>ENGINE HEALTH</span>
                <h3>Execution controls</h3>
              </div>
              <b className="green">{connected ? "OK" : "!"}</b>
            </div>
            <article>
              <div>
                <strong>Startup risk buffer</strong>
                <small>Temporary allowance before the profit floor rises</small>
              </div>
              <span>{money.format(model.maximumUnhedgedLoss)}</span>
            </article>
            <article>
              <div>
                <strong>Minimum book margin</strong>
                <small>Required profit as liquidity accumulates</small>
              </div>
              <span>{(model.minimumBookMargin * 100).toFixed(0)}%</span>
            </article>
            <article>
              <div>
                <strong>Target gross margin</strong>
                <small>
                  {(model.baseOverround * 100).toFixed(0)}% overround before
                  inventory and caps
                </small>
              </div>
              <span>
                {(
                  (model.baseOverround / (1 + model.baseOverround)) *
                  100
                ).toFixed(0)}
                % margin
              </span>
            </article>
            <article>
              <div>
                <strong>Minimum quote</strong>
                <small>Lowest permitted decimal odds</small>
              </div>
              <span>{model.minimumDecimalOdds.toFixed(2)}</span>
            </article>
          </section>
        </div>
      </div>

      {settlementModalOpen && pool.status === "SETTLED" && (
        <div className="modalBackdrop" role="presentation">
          <section
            className="settlementModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settlement-modal-title"
          >
            <button
              className="modalClose"
              aria-label="Close settlement summary"
              onClick={() => setSettlementModalOpen(false)}
            >
              ×
            </button>
            <h2 id="settlement-modal-title">VAR market settled</h2>
            <p>Argentina 0–1 Egypt · Review outcome: NO GOAL</p>
            <SettlementSummary snapshot={snapshot} />
          </section>
        </div>
      )}
    </main>
  );
}
