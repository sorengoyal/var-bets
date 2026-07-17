export type MarketQuote = {
  argentina: number;
  egypt: number;
  goalProbability: number;
  noGoalProbability: number;
  goalOdds: number;
  noGoalOdds: number;
};

export const SIMULATION = {
  matchStartSeconds: 57 * 60 + 55,
  monitorAt: 50,
  decisionAt: 110,
  videoDuration: 139.13,
} as const;

const marketPoints = [
  { at: 0, argentina: 42.72, egypt: 53.18 },
  { at: SIMULATION.monitorAt, argentina: 23.18, egypt: 75.57 },
  { at: SIMULATION.decisionAt, argentina: 33.19, egypt: 66.54 },
  { at: SIMULATION.videoDuration, argentina: 41.53, egypt: 58.44 },
] as const;

function interpolate(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}

function customerOdds(probability: number) {
  const overround = 1.035;
  return Math.max(1.05, 1 / (probability * overround));
}

export function quoteAt(elapsedSeconds: number): MarketQuote {
  const elapsed = Math.max(
    0,
    Math.min(elapsedSeconds, SIMULATION.videoDuration),
  );
  const nextIndex = marketPoints.findIndex((point) => point.at >= elapsed);
  const rightIndex = nextIndex === -1 ? marketPoints.length - 1 : nextIndex;
  const right = marketPoints[rightIndex]!;
  const left = marketPoints[Math.max(0, rightIndex - 1)]!;
  const span = Math.max(1, right.at - left.at);
  const progress = left === right ? 0 : (elapsed - left.at) / span;
  const argentina = interpolate(left.argentina, right.argentina, progress);
  const egypt = interpolate(left.egypt, right.egypt, progress);
  const normalizedTotal = argentina + egypt;
  const goalProbability = egypt / normalizedTotal;
  const noGoalProbability = argentina / normalizedTotal;

  return {
    argentina,
    egypt,
    goalProbability,
    noGoalProbability,
    goalOdds: customerOdds(goalProbability),
    noGoalOdds: customerOdds(noGoalProbability),
  };
}

export function matchClockAt(elapsedSeconds: number) {
  const total = SIMULATION.matchStartSeconds + Math.floor(elapsedSeconds);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function reviewPhaseAt(elapsedSeconds: number) {
  if (elapsedSeconds >= SIMULATION.decisionAt) {
    return {
      eyebrow: "OFFICIAL DECISION · SETTLED",
      title: "NO GOAL",
      detail: "The goal has been overturned",
    };
  }

  if (elapsedSeconds >= SIMULATION.monitorAt) {
    return {
      eyebrow: "VAR REVIEW · MONITOR CHECK",
      title: "Referee at the monitor",
      detail: "Market remains open until the final signal",
    };
  }

  return {
    eyebrow: "VAR REVIEW · MARKET OPEN",
    title: "Will the goal stand?",
    detail: "VAR is checking the scoring play",
  };
}
