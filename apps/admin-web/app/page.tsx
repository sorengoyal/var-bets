"use client";

import { useState } from "react";

type Series = "ARG" | "EGY" | "ALL";

const scenario = {
  handle: 10024.4682,
  meanProfit: 1321.6526,
  medianProfit: 1273.8611,
  p5Profit: 549.0775,
  p1Profit: 251.179,
  worstProfit: -429.8982,
  lossProbability: 0.0028,
  acceptanceRate: 0.8970457,
  rejectedHandle: 1199.2693,
  meanMaxLiability: 830.3019,
  p99Liability: 1000,
  goalOdds: 2.4206,
  noGoalOdds: 1.7438,
  bettorPayoutPerDollar: 0.8667944,
};

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

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

function Metric({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  tone?: "positive" | "warning";
}) {
  return (
    <article className={`metric ${tone ?? ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function OddsChart({ series }: { series: Series }) {
  const showArg = series === "ARG" || series === "ALL";
  const showEgy = series === "EGY" || series === "ALL";

  return (
    <div className="chartWrap">
      <svg
        viewBox="0 0 840 300"
        role="img"
        aria-label="Argentina and Egypt Polymarket price history"
      >
        <defs>
          <linearGradient id="argFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#55b7ff" stopOpacity=".28" />
            <stop offset="1" stopColor="#55b7ff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="egyFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#ff6f7c" stopOpacity=".2" />
            <stop offset="1" stopColor="#ff6f7c" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[60, 120, 180, 240].map((y) => (
          <line key={y} x1="46" x2="816" y1={y} y2={y} className="gridLine" />
        ))}
        <text x="8" y="64">
          80%
        </text>
        <text x="8" y="124">
          60%
        </text>
        <text x="8" y="184">
          40%
        </text>
        <text x="8" y="244">
          20%
        </text>

        {showArg && (
          <path
            d="M46 164 L305 229 L564 196 L816 138 L816 270 L46 270 Z"
            fill="url(#argFill)"
          />
        )}
        {showEgy && (
          <path
            d="M46 129 L305 55 L564 85 L816 141 L816 270 L46 270 Z"
            fill="url(#egyFill)"
          />
        )}
        {showArg && (
          <polyline
            points="46,164 305,229 564,196 816,138"
            className="argLine"
          />
        )}
        {showEgy && (
          <polyline points="46,129 305,55 564,85 816,141" className="egyLine" />
        )}

        <line x1="46" x2="46" y1="35" y2="270" className="eventLine goal" />
        <line
          x1="305"
          x2="305"
          y1="35"
          y2="270"
          className="eventLine monitor"
        />
        <line
          x1="564"
          x2="564"
          y1="35"
          y2="270"
          className="eventLine decision"
        />
        <line x1="816" x2="816" y1="35" y2="270" className="currentLine" />

        <text x="46" y="289" textAnchor="middle">
          57:55
        </text>
        <text x="305" y="289" textAnchor="middle">
          58:45
        </text>
        <text x="564" y="289" textAnchor="middle">
          59:45
        </text>
        <text x="816" y="289" textAnchor="end">
          60:14
        </text>
      </svg>
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

export default function AdminDashboard() {
  const [series, setSeries] = useState<Series>("ALL");
  const [poolExpanded, setPoolExpanded] = useState(true);
  const payout = scenario.handle * scenario.bettorPayoutPerDollar;

  return (
    <main>
      <header className="topbar">
        <Brand />
        <div className="topActions">
          <span className="systemLive">
            <i /> SYSTEM LIVE
          </span>
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
              Monitor pools, user flow, liabilities, and automated Polymarket
              hedges.
            </p>
          </div>
          <div className="modelBadge">
            <span>MODEL SCENARIO 10</span>
            <strong>50% Goal / 50% No Goal</strong>
            <small>5,000 Monte Carlo paths</small>
          </div>
        </section>

        <section className="metrics">
          <Metric
            label="MEAN HANDLE"
            value={money.format(scenario.handle)}
            note={`${(scenario.acceptanceRate * 100).toFixed(2)}% accepted`}
          />
          <Metric
            label="MEAN PROFIT"
            value={`+${money.format(scenario.meanProfit)}`}
            note={`Median +${money.format(scenario.medianProfit)}`}
            tone="positive"
          />
          <Metric
            label="MAX LIABILITY"
            value={money.format(scenario.meanMaxLiability)}
            note={`P99 cap ${money.format(scenario.p99Liability)}`}
            tone="warning"
          />
          <Metric
            label="LOSS PROBABILITY"
            value={`${(scenario.lossProbability * 100).toFixed(2)}%`}
            note={`Worst ${money.format(scenario.worstProfit)}`}
          />
        </section>

        <section className="matchCard">
          <div className="matchHeader">
            <div className="liveBadge">
              <i /> LIVE
            </div>
            <div className="matchIdentity">
              <span>FIFA WORLD CUP</span>
              <h2>
                Argentina <b>0–1</b> Egypt
              </h2>
              <small>Second half · 60:14</small>
            </div>
            <div className="matchTotals">
              <span>1 settled pool</span>
              <strong>{money.format(scenario.handle)} USDC</strong>
              <small>Total accepted handle</small>
            </div>
          </div>

          <section className="panel oddsPanel">
            <div className="panelHeader">
              <div>
                <span>POLYMARKET MARKET</span>
                <h3>Argentina advances vs Egypt advances</h3>
                <small>
                  Historical event-aligned observations · raw source percentages
                </small>
              </div>
              <div className="currentOdds">
                <span>
                  <i className="argDot" />
                  ARG <strong>50.45%</strong>
                </span>
                <span>
                  <i className="egyDot" />
                  EGY <strong>49.78%</strong>
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
            <OddsChart series={series} />
          </section>

          <section className="poolCard">
            <button
              className="poolHeader"
              onClick={() => setPoolExpanded((value) => !value)}
            >
              <div>
                <span className="settledBadge">✓ SETTLED</span>
                <h3>Pool #20260707 · Goal review</h3>
                <small>
                  Ball in net 57:55 · Decision 59:45 · Outcome: NO GOAL
                </small>
              </div>
              <div className="poolResult">
                <span>MEAN EVENT P&L</span>
                <strong>+{money.format(scenario.meanProfit)}</strong>
                <small>
                  {poolExpanded ? "Hide details ↑" : "Show details ↓"}
                </small>
              </div>
            </button>

            {poolExpanded && (
              <div className="poolBody">
                <div className="marketTable">
                  <div className="tableHeader">
                    <span>MARKET</span>
                    <span>REQUEST MIX</span>
                    <span>MEAN ODDS</span>
                    <span>RESULT</span>
                  </div>
                  <div>
                    <strong>Goal confirmed</strong>
                    <span>50.0%</span>
                    <span>{scenario.goalOdds.toFixed(2)}</span>
                    <span className="lostText">Lost</span>
                  </div>
                  <div>
                    <strong>No Goal overturned</strong>
                    <span>50.0%</span>
                    <span>{scenario.noGoalOdds.toFixed(2)}</span>
                    <span className="wonText">Won ✓</span>
                  </div>
                  <footer>
                    <span>Blended bettor return</span>
                    <strong>
                      ${scenario.bettorPayoutPerDollar.toFixed(4)} per accepted
                      $1
                    </strong>
                  </footer>
                </div>

                <div className="detailGrid">
                  <section className="activityPanel">
                    <div className="subHeader">
                      <div>
                        <span>BET FLOW</span>
                        <h4>Accepted vs rejected</h4>
                      </div>
                      <strong>
                        {(scenario.acceptanceRate * 100).toFixed(2)}%
                      </strong>
                    </div>
                    <div className="flowBar">
                      <span
                        style={{ width: `${scenario.acceptanceRate * 100}%` }}
                      />
                    </div>
                    <dl>
                      <div>
                        <dt>Accepted handle</dt>
                        <dd>{money.format(scenario.handle)}</dd>
                      </div>
                      <div>
                        <dt>Rejected handle</dt>
                        <dd>{money.format(scenario.rejectedHandle)}</dd>
                      </div>
                      <div>
                        <dt>Requested split</dt>
                        <dd>50 / 50</dd>
                      </div>
                    </dl>
                  </section>

                  <section className="activityPanel">
                    <div className="subHeader">
                      <div>
                        <span>AUTOMATED HEDGE</span>
                        <h4>Inventory protection</h4>
                      </div>
                      <strong className="healthy">HEALTHY</strong>
                    </div>
                    <ul className="activityList">
                      <li>
                        <time>57:55</time>
                        <div>
                          <strong>Dynamic repricing started</strong>
                          <small>
                            Goal quote {scenario.goalOdds.toFixed(2)} · No Goal{" "}
                            {scenario.noGoalOdds.toFixed(2)}
                          </small>
                        </div>
                        <span>LIVE</span>
                      </li>
                      <li>
                        <time>58:45</time>
                        <div>
                          <strong>Liability cap enforced</strong>
                          <small>
                            Mean exposure{" "}
                            {money.format(scenario.meanMaxLiability)}
                          </small>
                        </div>
                        <span>CAP</span>
                      </li>
                      <li>
                        <time>59:45</time>
                        <div>
                          <strong>Pool closed and settled</strong>
                          <small>
                            NO GOAL · payout liability {money.format(payout)}
                          </small>
                        </div>
                        <span>DONE</span>
                      </li>
                    </ul>
                  </section>
                </div>

                <section className="riskStrip">
                  <div>
                    <span>P5 PROFIT</span>
                    <strong>+{money.format(scenario.p5Profit)}</strong>
                  </div>
                  <div>
                    <span>P1 PROFIT</span>
                    <strong>+{money.format(scenario.p1Profit)}</strong>
                  </div>
                  <div>
                    <span>P99 LIABILITY</span>
                    <strong>{money.format(scenario.p99Liability)}</strong>
                  </div>
                  <div>
                    <span>REJECTED HANDLE</span>
                    <strong>{money.format(scenario.rejectedHandle)}</strong>
                  </div>
                </section>
              </div>
            )}
          </section>
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
                <span>MODEL HEALTH</span>
                <h3>Execution controls</h3>
              </div>
              <b className="green">OK</b>
            </div>
            <article>
              <div>
                <strong>Liability limiter</strong>
                <small>Maximum unhedged loss</small>
              </div>
              <span>{money.format(1000)}</span>
            </article>
            <article>
              <div>
                <strong>Minimum quote</strong>
                <small>Lowest permitted decimal odds</small>
              </div>
              <span>1.05</span>
            </article>
          </section>
        </div>
      </div>
    </main>
  );
}
