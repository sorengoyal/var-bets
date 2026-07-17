import type { PricePoint } from "@var-bets/dashboard-contract";

const anchors: ReadonlyArray<{
  second: number;
  label: string;
  argProbability: number;
}> = [
  { second: 0, label: "57:55", argProbability: 42.72 },
  { second: 50, label: "58:45", argProbability: 23.18 },
  { second: 110, label: "59:45", argProbability: 33.19 },
  { second: 139, label: "60:14", argProbability: 50.45 },
];

export const REVIEW_DECISION_SECOND = 110;
export const REPLAY_END_SECOND = 139;

function interpolate(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}

export function polymarketPoint(second: number): PricePoint {
  const boundedSecond = Math.max(0, Math.min(REPLAY_END_SECOND, second));
  let start = anchors[0]!;
  let end = anchors.at(-1)!;
  for (let index = 1; index < anchors.length; index += 1) {
    const candidate = anchors[index]!;
    if (boundedSecond <= candidate.second) {
      start = anchors[index - 1]!;
      end = candidate;
      break;
    }
  }
  const duration = Math.max(1, end.second - start.second);
  const progress = (boundedSecond - start.second) / duration;
  const argProbability = interpolate(
    start.argProbability,
    end.argProbability,
    progress,
  );
  const egyProbability = 100 - argProbability;

  return {
    second: boundedSecond,
    label: clockLabel(boundedSecond),
    argProbability: Math.round(argProbability * 100) / 100,
    egyProbability: Math.round(egyProbability * 100) / 100,
  };
}

export function goalSignalProbability(argProbability: number): number {
  const normalizedMove = (57.65 - argProbability) / 34.47;
  return Math.max(0.18, Math.min(0.86, 0.43 + normalizedMove * 0.39));
}

export function clockLabel(second: number): string {
  const totalSeconds = 57 * 60 + 55 + second;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
