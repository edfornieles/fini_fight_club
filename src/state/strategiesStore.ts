/**
 * Automated Attack — autonomous Forecasters with budgets, stop conditions, and
 * market-condition awareness.
 *
 * Each Forecaster has its own segregated budget (allocated at deploy time,
 * deducted from the player's wallet). The strategy spends from THAT budget,
 * not the wallet — protecting the rest of the player's bankroll.
 *
 * Settled wins flow either back to the budget (compound mode) or to a
 * "saved profits" pocket (save mode). Stop conditions auto-pause the
 * strategy when targets are hit.
 *
 * Non-betting language throughout: "forecasts" / "deploy" / "capital" /
 * "budget" / "profits saved" / "auto-paused".
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type StrategyType =
  | "momentum"            // pattern: pick the side with > 10% sim lead
  | "contrarian"          // pattern: pick the underdog below threshold
  | "loyalist"            // pattern: always pick the same side on chosen assets
  | "late_joiner"         // pattern: pick the leader in the final 10% of the battle
  | "flat_bias"           // pattern: always pick side A (or B)
  // ── Tier-1 signal-driven templates (read the actual underlying, not the sim) ──
  | "momentum_underlying" // fires when the asset's 5m velocity exceeds a threshold
  | "mean_reversion"      // fires when |1m velocity| > threshold — bets against the overshoot
  | "late_sniper";        // in the final 60s, picks the side matching the real price direction

export type ReinvestMode = "compound" | "save";

export type MarketCondition = "any" | "bullish" | "bearish" | "volatile" | "calm";

export type PauseReason = "manual" | "budget_exhausted" | "hit_gain_target" | "hit_loss_limit" | "market_condition_mismatch";

export interface StrategyStats {
  forecastsToday: number;
  totalForecasts: number;
  wins: number;
  losses: number;
  voided: number;
  /** Cumulative net profit/loss over the strategy's lifetime. */
  netProfit: number;
  lastTriggeredAt?: number;
  lastResetDate?: string;
}

export interface StrategyBudget {
  /** Total capital allocated to this strategy at deploy time. */
  allocated: number;
  /** Remaining capital available to place forecasts with. */
  remaining: number;
  /** Profits withdrawn to "saved" pocket (only used when reinvest === "save"). */
  savedProfits: number;
}

export interface Strategy {
  id: string;
  name: string;
  type: StrategyType;
  enabled: boolean;
  createdAt: number;
  pausedReason?: PauseReason;

  params: {
    assetFilter: string[];
    sideFilter?: "A" | "B";
    pctThreshold?: number;
    fireUnderRemainingPct?: number;
    /** Tier-1: only fire when |edge in percentage points| > this. Optional. */
    minEdgePp?: number;
    /** For momentum_underlying / mean_reversion: velocity threshold (e.g. 0.005 = 0.5%). */
    velocityThreshold?: number;
  };

  /** Capital per forecast, in FINI$. */
  stake: number;
  /** Max forecasts per UTC day. */
  maxPerDay: number;

  /** Budget pool (FINI$ allocated, remaining, saved profits). */
  budget: StrategyBudget;

  /** Reinvest = compound back into budget. Save = profits go to savedProfits. */
  reinvest: ReinvestMode;

  /** Required market condition for forecasts to fire. */
  marketCondition: MarketCondition;

  stopConditions: {
    /** Auto-pause when netProfit reaches +this. Optional. */
    stopAtNetGain?: number;
    /** Auto-pause when netProfit reaches -this (positive number). Optional. */
    stopAtNetLoss?: number;
  };

  stats: StrategyStats;
}

interface StrategiesState {
  strategies: Strategy[];
  create: (s: Omit<Strategy, "id" | "createdAt" | "stats" | "budget"> & {
    budgetAllocated: number;
  }) => { strategy: Strategy; deductFromWallet: number } | { error: string };
  update: (id: string, patch: Partial<Strategy>) => void;
  toggle: (id: string) => void;
  retire: (id: string) => { refund: number } | null;
  pause: (id: string, reason: PauseReason) => void;
  /** A forecast was just placed — debit budget.remaining. */
  spendBudget: (id: string, amount: number) => boolean;
  /** Settle the outcome of a forecast — credit budget or savedProfits depending on mode. */
  recordOutcome: (id: string, outcome: "win" | "loss" | "voided", stake: number, payout: number) => void;
  /** Record a forecast attempt (counter only). */
  recordForecast: (id: string) => void;
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

export const STRATEGY_META: Record<StrategyType, { name: string; icon: string; description: string; color: string; signalDriven?: boolean }> = {
  // Pattern-based (read the sim's own odds)
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

  // Signal-driven (read the actual underlying asset price)
  momentum_underlying: { name: "Live Momentum", icon: "📈", color: "#0ea5e9", signalDriven: true,
    description: "Reads the asset's real 5-minute price velocity. Predicts Up when momentum exceeds threshold (default +0.5%). Reactive to actual market movement." },
  mean_reversion: { name: "Mean Reversion", icon: "🪞", color: "#f59e0b", signalDriven: true,
    description: "When the asset's 1-minute move exceeds the threshold (default ±2%), bets against the overshoot — assuming the spike reverses." },
  late_sniper: { name: "Late Sniper", icon: "🎯", color: "#dc2626", signalDriven: true,
    description: "Only acts in the final 60 seconds. Reads the actual intra-window price change and picks whichever side reality confirms. Near-riskless if you trust the price feed." },
};

export const MARKET_CONDITION_META: Record<MarketCondition, { label: string; icon: string; description: string }> = {
  any:      { label: "Any market",  icon: "🌐", description: "Run regardless of conditions" },
  bullish:  { label: "Bullish only",icon: "🐂", description: "Only fire when avg 24h change > +2%" },
  bearish:  { label: "Bearish only",icon: "🐻", description: "Only fire when avg 24h change < -2%" },
  volatile: { label: "Volatile only",icon: "⚡", description: "Only fire when max-min spread > 8%" },
  calm:     { label: "Calm only",   icon: "🌊", description: "Only fire when max-min spread < 3%" },
};

export const useStrategies = create<StrategiesState>()(
  persist(
    (set, get) => ({
      strategies: [],

      create: (input) => {
        if (input.budgetAllocated < input.stake) {
          return { error: "Budget must be at least the per-forecast stake." };
        }
        _idCounter++;
        const strategy: Strategy = {
          id: `strat-${Date.now()}-${_idCounter}`,
          createdAt: Date.now(),
          name: input.name,
          type: input.type,
          enabled: input.enabled,
          params: input.params,
          stake: input.stake,
          maxPerDay: input.maxPerDay,
          budget: {
            allocated: input.budgetAllocated,
            remaining: input.budgetAllocated,
            savedProfits: 0,
          },
          reinvest: input.reinvest,
          marketCondition: input.marketCondition,
          stopConditions: input.stopConditions,
          stats: { ...emptyStats, lastResetDate: todayKey() },
        };
        set(state => ({ strategies: [strategy, ...state.strategies] }));
        return { strategy, deductFromWallet: input.budgetAllocated };
      },

      update: (id, patch) => set(state => ({
        strategies: state.strategies.map(s => s.id === id ? { ...s, ...patch } : s),
      })),

      toggle: (id) => set(state => ({
        strategies: state.strategies.map(s => {
          if (s.id !== id) return s;
          // Manual toggle clears any auto-pause reason
          return { ...s, enabled: !s.enabled, pausedReason: !s.enabled ? undefined : "manual" };
        }),
      })),

      pause: (id, reason) => set(state => ({
        strategies: state.strategies.map(s => s.id === id ? { ...s, enabled: false, pausedReason: reason } : s),
      })),

      retire: (id) => {
        const s = get().strategies.find(x => x.id === id);
        if (!s) return null;
        // Refund remaining budget + saved profits to the wallet
        const refund = s.budget.remaining + s.budget.savedProfits;
        set(state => ({ strategies: state.strategies.filter(x => x.id !== id) }));
        return { refund };
      },

      spendBudget: (id, amount) => {
        const s = get().strategies.find(x => x.id === id);
        if (!s) return false;
        if (s.budget.remaining < amount) return false;
        set(state => ({
          strategies: state.strategies.map(x => x.id === id
            ? { ...x, budget: { ...x.budget, remaining: x.budget.remaining - amount } }
            : x),
        }));
        return true;
      },

      recordOutcome: (id, outcome, stake, payout) => {
        const s = get().strategies.find(x => x.id === id);
        if (!s) return;
        const netProfit = payout - stake;
        // Settlement routing depends on reinvest mode:
        //  compound: full payout back to budget.remaining
        //  save:     stake back to budget.remaining, profit (if any) → savedProfits
        let nextRemaining = s.budget.remaining;
        let nextSaved = s.budget.savedProfits;
        if (outcome === "voided") {
          // Stake refund regardless of mode
          nextRemaining += stake;
        } else if (outcome === "win") {
          if (s.reinvest === "compound") {
            nextRemaining += payout; // full 2× stake back into the pool
          } else {
            nextRemaining += stake;          // stake refund
            nextSaved     += (payout - stake); // pure profit to savings
          }
        }
        // Loss: stake already debited, nothing more to do for budget

        const nextStats: StrategyStats = {
          ...s.stats,
          wins:   s.stats.wins   + (outcome === "win"    ? 1 : 0),
          losses: s.stats.losses + (outcome === "loss"   ? 1 : 0),
          voided: s.stats.voided + (outcome === "voided" ? 1 : 0),
          netProfit: s.stats.netProfit + netProfit,
        };

        // Check stop conditions
        let autoPauseReason: PauseReason | undefined;
        if (s.stopConditions.stopAtNetGain != null && nextStats.netProfit >= s.stopConditions.stopAtNetGain) {
          autoPauseReason = "hit_gain_target";
        } else if (s.stopConditions.stopAtNetLoss != null && nextStats.netProfit <= -s.stopConditions.stopAtNetLoss) {
          autoPauseReason = "hit_loss_limit";
        } else if (nextRemaining < s.stake) {
          autoPauseReason = "budget_exhausted";
        }

        set(state => ({
          strategies: state.strategies.map(x => x.id === id ? {
            ...x,
            budget: { ...x.budget, remaining: nextRemaining, savedProfits: nextSaved },
            stats: nextStats,
            ...(autoPauseReason ? { enabled: false, pausedReason: autoPauseReason } : {}),
          } : x),
        }));
      },

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
    { name: "fini-strategies-v2" } // v2 = budget model. Old v1 entries won't migrate cleanly.
  )
);
