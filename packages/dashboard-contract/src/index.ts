export type DashboardMode = "LIVE" | "SIMULATION";
export type PoolStatus = "OPEN" | "SETTLED";
export type ReviewOutcome = "GOAL" | "NO_GOAL" | null;

export interface PricePoint {
  second: number;
  label: string;
  argProbability: number;
  egyProbability: number;
}

export interface HedgeActivity {
  id: string;
  second: number;
  timeLabel: string;
  side: "GOAL" | "NO_GOAL";
  notional: number;
  venuePrice: number;
  status: "FILLED" | "REJECTED" | "UNWOUND";
}

export interface BetActivity {
  id: string;
  second: number;
  side: "GOAL" | "NO_GOAL";
  stake: number;
  odds: number | null;
  accepted: boolean;
}

export interface DashboardSnapshot {
  schemaVersion: 1;
  sequence: number;
  generatedAt: string;
  mode: DashboardMode;
  source: string;
  fixture: {
    competition: string;
    homeTeam: string;
    awayTeam: string;
    homeScore: number;
    awayScore: number;
    matchClock: string;
  };
  market: {
    id: string;
    title: string;
    elapsedSeconds: number;
    argProbability: number;
    egyProbability: number;
    goalSignalProbability: number;
    history: PricePoint[];
  };
  pool: {
    id: string;
    status: PoolStatus;
    outcome: ReviewOutcome;
    acceptedHandle: number;
    rejectedHandle: number;
    requestedHandle: number;
    acceptedBets: number;
    rejectedBets: number;
    goalRequestedShare: number;
    noGoalRequestedShare: number;
    goalOdds: number;
    noGoalOdds: number;
    payoutIfGoal: number;
    payoutIfNoGoal: number;
    hedgePayoffIfGoal: number;
    hedgePayoffIfNoGoal: number;
    executionCost: number;
    profitIfGoal: number;
    profitIfNoGoal: number;
    worstCaseProfit: number;
  };
  model: {
    scenarioId: number;
    simulations: number;
    meanProfit: number;
    medianProfit: number;
    p5Profit: number;
    p1Profit: number;
    worstProfit: number;
    lossProbability: number;
    p99Liability: number;
    baseOverround: number;
    maximumUnhedgedLoss: number;
    minimumDecimalOdds: number;
  };
  settlement: {
    userGoalBets: { count: number; amount: number };
    userNoGoalBets: { count: number; amount: number };
    polymarketGoalHedges: { count: number; amount: number };
    polymarketNoGoalHedges: { count: number; amount: number };
    totalPayout: number;
    totalProfit: number;
  };
  recentBets: BetActivity[];
  recentHedges: HedgeActivity[];
}
