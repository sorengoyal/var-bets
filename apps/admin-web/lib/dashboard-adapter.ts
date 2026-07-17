"use client";

import { useCallback, useEffect, useState } from "react";
import type { DashboardSnapshot } from "@var-bets/dashboard-contract";

const initialSnapshot: DashboardSnapshot = {
  schemaVersion: 1,
  sequence: 0,
  generatedAt: new Date(0).toISOString(),
  mode: "LIVE",
  source: "Waiting for configured dashboard adapter",
  fixture: {
    competition: "FIFA WORLD CUP",
    homeTeam: "Argentina",
    awayTeam: "Egypt",
    homeScore: 0,
    awayScore: 1,
    matchClock: "60:14",
  },
  market: {
    id: "arg-egy-var-20260707",
    title: "Argentina advances vs Egypt advances",
    elapsedSeconds: 139,
    argProbability: 50.45,
    egyProbability: 49.78,
    goalSignalProbability: 0.3319,
    history: [
      {
        second: 0,
        label: "57:55",
        argProbability: 42.72,
        egyProbability: 53.18,
      },
      {
        second: 50,
        label: "58:45",
        argProbability: 23.18,
        egyProbability: 75.57,
      },
      {
        second: 110,
        label: "59:45",
        argProbability: 33.19,
        egyProbability: 66.54,
      },
      {
        second: 139,
        label: "60:14",
        argProbability: 50.45,
        egyProbability: 49.78,
      },
    ],
  },
  pool: {
    id: "20260707",
    status: "SETTLED",
    outcome: "NO_GOAL",
    acceptedHandle: 10024.4689,
    rejectedHandle: 1199.2697,
    requestedHandle: 11223.7386,
    acceptedBets: 0,
    rejectedBets: 0,
    goalRequestedShare: 0.5,
    noGoalRequestedShare: 0.5,
    goalOdds: 2.4206,
    noGoalOdds: 1.7438,
    payoutIfGoal: 0,
    payoutIfNoGoal: 8689.15,
    hedgePayoffIfGoal: 0,
    hedgePayoffIfNoGoal: 0,
    executionCost: 0,
    profitIfGoal: 0,
    profitIfNoGoal: 1321.6526,
    worstCaseProfit: -429.8982,
  },
  model: {
    scenarioId: 10,
    simulations: 5000,
    meanProfit: 1321.6526,
    medianProfit: 1273.8611,
    p5Profit: 549.0775,
    p1Profit: 251.179,
    worstProfit: -429.8982,
    lossProbability: 0.0028,
    p99Liability: 1000,
    baseOverround: 0.25,
    minimumBookMargin: 0.2,
    maximumUnhedgedLoss: 1000,
    minimumDecimalOdds: 1.05,
  },
  settlement: {
    userGoalBets: { count: 0, amount: 0 },
    userNoGoalBets: { count: 0, amount: 0 },
    polymarketGoalHedges: { count: 0, amount: 0 },
    polymarketNoGoalHedges: { count: 0, amount: 0 },
    totalPayout: 8689.15,
    totalProfit: 1321.6526,
  },
  recentBets: [],
  recentHedges: [],
};

export interface DashboardDataAdapter {
  getSnapshot(signal?: AbortSignal): Promise<DashboardSnapshot>;
  resetSimulation(): Promise<DashboardSnapshot>;
}

export class HttpDashboardDataAdapter implements DashboardDataAdapter {
  constructor(private readonly baseUrl: string) {}

  async getSnapshot(signal?: AbortSignal): Promise<DashboardSnapshot> {
    const response = await fetch(`${this.baseUrl}/dashboard`, {
      cache: "no-store",
      signal,
    });
    if (!response.ok) throw new Error(`DASHBOARD_ADAPTER_${response.status}`);
    return (await response.json()) as DashboardSnapshot;
  }

  async resetSimulation(): Promise<DashboardSnapshot> {
    const response = await fetch(`${this.baseUrl}/simulation/reset`, {
      method: "POST",
    });
    if (!response.ok) throw new Error(`SIMULATION_RESET_${response.status}`);
    return (await response.json()) as DashboardSnapshot;
  }
}

const adapter: DashboardDataAdapter = new HttpDashboardDataAdapter("/api");

export function useDashboardData() {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [connected, setConnected] = useState(false);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const next = await adapter.getSnapshot(signal);
      setSnapshot(next);
      setConnected(true);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    const interval = window.setInterval(() => void refresh(), 1000);
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [refresh]);

  const resetSimulation = useCallback(async () => {
    const next = await adapter.resetSimulation();
    setSnapshot(next);
    setConnected(true);
  }, []);

  return { connected, resetSimulation, snapshot };
}
