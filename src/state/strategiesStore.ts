/**
 * Strategy Lab — automated forecasting agents for the Crypto Arena.
 *
 * A "Forecaster" is a small autonomous strategy a player configures and
 * deploys. It watches live battles and places forecasts automatically when
 * its trigger condition fires. Each one operates on a daily capital cap so
 * it can't spend an entire bankroll overnight.
 *
 * Why this exists: at low player-counts, the prediction market feels empty.
 * Forecasters let players deploy strategies that keep the market populated
 * with informed predictions — closer to how prediction markets actually work
 * in production (where algorithmic traders provide most of the liquidity).
 *
 * Note on naming: throughout the UI we say "forecast" / "strategy" / "deploy"
 * — never "bet" / "bot" / "gambling". This is a game.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type StrategyType = "momentum" | "contrarian" | "loyalist" | "late_joiner" | "flat_bias";

export interface StrategyStats {
  forecastsToday: number;
  totalForecasts: number;
  wins: number;
  losses: number;
  voided: number;
  netProfit: number;     // sum of all settled netProfit
  lastTriggeredAt?: number;
  lastResetDate?: string; // yyyy-mm-dd — daily cap reset key
}

export interface Strategy {
  id: string;
  name: string;
  type: StrategyType;
  enabled: boolean;
  createdAt: number;

  /** Type-specific parameters. */
  params: {
    /** Asset whitelist. Empty = all assets. */
    assetFilter: string[];
    /** Forced side (used by loyalist + flat_bias). */
    sideFilter?: "A" | "B";
    /** Threshold % for contrarian (e.g. 40 = pick underdogs whose share < 40%). */
    pctThreshold?: number;
    /** Late-joiner only fires when battle has < N% time remaining. Default 10. */
    fireUnderRemainingPct?: number;
  };

  /** Capital per forecast, in FINI$. */
  stake: number;
  /** Max forecasts per UTC day. */
  maxPerDay: number;

  stats: StrategyStats;
}

interface StrategiesState {
  strategies: Strategy[];
  create: (s: Omit<Strategy, "id" | "createdAt" | "stats">) => Strategy;
  update: (id: string, patch: Partial<Strategy>) => void;
  toggle: (id: string) => void;
  remove: (id: string) => void;
  /** Record a forecast attempt — increments today/total + lastTriggeredAt. */
  recordForecast: (id: string) => void;
  /** Settle the outcome of a previously-placed forecast. */
  recordOutcome: (id: string, outcome: "win" | "loss" | "voided", netProfit: number) => void;
  /** Reset today's counter if the day has rolled over. */
  resetDailyIfStale: () => void;
}

let _idCounter = 0;
const todayKey = () => new Date().toISOString().slice(0, 10);

const emptyStats: StrategyStats = {
  forecastsToday: 0,
  totalForecasts: 0,
  wins: 0,
  losses: 0,
  voided: 0,
  netProfit: 0,
};

export const STRATEGY_META: Record<StrategyType, { name: string; icon: string; description: string; color: string }> = {
  momentum:    { name: "Momentum Hunter", icon: "🌊", color: "#06b6d4",
    description: "Picks the side gaining the most ground in the final stretch of a battle. Rides the wave once it's clear." },
  contrarian:  { name: "Contrarian",      icon: "🔄", color: "#f97316",
    description: "Backs the underdog (the side with the lowest crowd %). Big risk, big reward." },
  loyalist:    { name: "Asset Loyalist",  icon: "🎯", color: "#a855f7",
    description: "Always picks the same side on a chosen asset — for conviction plays. ('BTC Up forever.')" },
  late_joiner: { name: "Late Joiner",     icon: "⏰", color: "#84cc16",
    description: "Only acts in the final 10% of a battle, when the winner is nearly certain. Boring but reliable." },
  flat_bias:   { name: "Flat Bias",       icon: "🎲", color: "#6b7280",
    description: "Always picks side A (or B) on every eligible battle. Useful as a baseline benchmark." },
};

export const useStrategies = create<StrategiesState>()(
  persist(
    (set) => ({
      strategies: [],

      create: (s) => {
        _idCounter++;
        const strategy: Strategy = {
          ...s,
          id: `strat-${Date.now()}-${_idCounter}`,
          createdAt: Date.now(),
          stats: { ...emptyStats, lastResetDate: todayKey() },
        };
        set(state => ({ strategies: [strategy, ...state.strategies] }));
        return strategy;
      },

      update: (id, patch) => set(state => ({
        strategies: state.strategies.map(s => s.id === id ? { ...s, ...patch } : s),
      })),

      toggle: (id) => set(state => ({
        strategies: state.strategies.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s),
      })),

      remove: (id) => set(state => ({ strategies: state.strategies.filter(s => s.id !== id) })),

      recordForecast: (id) => {
        const today = todayKey();
        set(state => ({
          strategies: state.strategies.map(s => {
            if (s.id !== id) return s;
            const dayChanged = s.stats.lastResetDate !== today;
            return {
              ...s,
              stats: {
                ...s.stats,
                forecastsToday: (dayChanged ? 0 : s.stats.forecastsToday) + 1,
                totalForecasts: s.stats.totalForecasts + 1,
                lastTriggeredAt: Date.now(),
                lastResetDate: today,
              },
            };
          }),
        }));
      },

      recordOutcome: (id, outcome, netProfit) => set(state => ({
        strategies: state.strategies.map(s => {
          if (s.id !== id) return s;
          return {
            ...s,
            stats: {
              ...s.stats,
              wins:   s.stats.wins   + (outcome === "win"    ? 1 : 0),
              losses: s.stats.losses + (outcome === "loss"   ? 1 : 0),
              voided: s.stats.voided + (outcome === "voided" ? 1 : 0),
              netProfit: s.stats.netProfit + netProfit,
            },
          };
        }),
      })),

      resetDailyIfStale: () => {
        const today = todayKey();
        set(state => ({
          strategies: state.strategies.map(s =>
            s.stats.lastResetDate === today ? s : {
              ...s, stats: { ...s.stats, forecastsToday: 0, lastResetDate: today },
            }
          ),
        }));
      },
    }),
    { name: "fini-strategies-v1" }
  )
);
