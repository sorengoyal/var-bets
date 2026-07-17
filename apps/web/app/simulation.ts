export type MarketQuote = {
  argentina: number;
  egypt: number;
  goalProbability: number;
  noGoalProbability: number;
  goalOdds: number;
  noGoalOdds: number;
};

export const MATCH_TIMELINE = {
  matchStartSeconds: 57 * 60 + 38,
  goalAt: 17,
  monitorAt: 67,
  decisionAt: 127,
  videoDuration: 139.13,
} as const;

const preGoalPoint = { argentina: 57.65, egypt: 42.84 } as const;

const marketPoints = [
  { at: MATCH_TIMELINE.goalAt, argentina: 42.72, egypt: 53.18 },
  { at: MATCH_TIMELINE.monitorAt, argentina: 23.18, egypt: 75.57 },
  { at: MATCH_TIMELINE.decisionAt, argentina: 33.19, egypt: 66.54 },
  { at: MATCH_TIMELINE.videoDuration, argentina: 36.68, egypt: 63.15 },
] as const;

function interpolate(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}

function customerOdds(probability: number) {
  const overround = 1.035;
  return Math.max(1.05, 1 / (probability * overround));
}

function createQuote(argentina: number, egypt: number): MarketQuote {
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

export function quoteAt(elapsedSeconds: number): MarketQuote {
  const elapsed = Math.max(
    0,
    Math.min(elapsedSeconds, MATCH_TIMELINE.videoDuration),
  );
  if (elapsed < MATCH_TIMELINE.goalAt) {
    return createQuote(preGoalPoint.argentina, preGoalPoint.egypt);
  }

  const nextIndex = marketPoints.findIndex((point) => point.at >= elapsed);
  const rightIndex = nextIndex === -1 ? marketPoints.length - 1 : nextIndex;
  const right = marketPoints[rightIndex]!;
  const left = marketPoints[Math.max(0, rightIndex - 1)]!;
  const span = Math.max(1, right.at - left.at);
  const progress = left === right ? 0 : (elapsed - left.at) / span;
  const argentina = interpolate(left.argentina, right.argentina, progress);
  const egypt = interpolate(left.egypt, right.egypt, progress);
  return createQuote(argentina, egypt);
}

export function matchClockAt(elapsedSeconds: number) {
  const total = MATCH_TIMELINE.matchStartSeconds + Math.floor(elapsedSeconds);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
