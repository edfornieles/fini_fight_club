/**
 * useStrategyExecutor — runs all enabled Forecaster strategies on a 5s tick.
 *
 * For each enabled strategy:
 *  1. Check the daily cap (forecastsToday < maxPerDay)
 *  2. Check the strategy's segregated budget (budget.remaining >= stake)
 *  3. Check the required market condition matches the current mood
 *  4. Find candidate live battles (asset filter, no existing entry)
 *  5. Apply the strategy's per-battle trigger
 *  6. Place forecast: debits the strategy's budget (NOT the wallet),
 *     creates a MyEntry tagged with strategyId for stats-tracking
 *
 * Capital flow:
 *  - At deploy time, budgetAllocated was already debited from the wallet
 *  - The strategy spends from its own budget pool
 *  - On settle, the resolver routes payouts back via strategiesStore.recordOutcome
 *    which handles compound vs save modes and auto-pause triggers
 */

import { useEffect } from "react";
import { useStrategies, type Strategy, type StrategyType } from "../state/strategiesStore";
import { useCryptoSim } from "../data/cryptoSim";
import { useMyEntries } from "../state/myEntriesStore";
import { currentMarketMood, moodMatchesCondition } from "../lib/marketCondition";
import { velocity5m, velocity1m } from "../lib/velocity";
import { intraWindowReturn } from "../lib/openingPrices";
import { bestEdgeSide } from "../lib/edgeCalc";

function parseDuration(label: string): number {
  const m = /^(\d+)(m|h)$/.exec(label.trim());
  if (!m) return 60 * 60 * 1000;
  return Number(m[1]) * (m[2] === "h" ? 3_600_000 : 60_000);
}

interface BattleLike {
  id: string; title: string; type: string; assets: string[]; durationLabel: string;
  endsInMs: number; status: string;
  sideA: { label: string; pct: number };
  sideB: { label: string; pct: number };
}

function decideForecastSide(strategy: Strategy, battle: BattleLike, remainingMs: number, totalMs: number): "A" | "B" | null {
  const remainingPct = totalMs > 0 ? (remainingMs / totalMs) * 100 : 0;
  const sym = battle.assets[0]; // first asset for signal lookups

  switch (strategy.type as StrategyType) {
    // ── Pattern-based strategies (read sim odds) ──────────────────────────
    case "flat_bias":
    case "loyalist":
      return strategy.params.sideFilter ?? "A";
    case "contrarian": {
      const threshold = strategy.params.pctThreshold ?? 40;
      if (battle.sideA.pct < threshold) return "A";
      if (battle.sideB.pct < threshold) return "B";
      return null;
    }
    case "momentum": {
      const diff = Math.abs(battle.sideA.pct - battle.sideB.pct);
      if (diff < 10) return null;
      return battle.sideA.pct > battle.sideB.pct ? "A" : "B";
    }
    case "late_joiner": {
      const fireUnder = strategy.params.fireUnderRemainingPct ?? 10;
      if (remainingPct > fireUnder) return null;
      if (Math.abs(battle.sideA.pct - battle.sideB.pct) < 3) return null;
      return battle.sideA.pct > battle.sideB.pct ? "A" : "B";
    }

    // ── Signal-driven strategies (read the actual underlying) ─────────────
    case "momentum_underlying": {
      // 5-minute velocity > threshold (default 0.005 = +0.5%) → predict Up.
      // Below -threshold → predict Down. Otherwise sit out.
      const v = velocity5m(sym);
      if (v == null) return null;
      const t = strategy.params.velocityThreshold ?? 0.005;
      if (v >  t) return "A";
      if (v < -t) return "B";
      return null;
    }
    case "mean_reversion": {
      // 1-minute |move| > threshold (default 0.02 = 2%) → bet AGAINST the move.
      // Big upward spike → expect reversion, predict Down. And vice versa.
      const v = velocity1m(sym);
      if (v == null) return null;
      const t = strategy.params.velocityThreshold ?? 0.02;
      if (v >  t) return "B"; // overshoot up → mean-revert down
      if (v < -t) return "A"; // overshoot down → mean-revert up
      return null;
    }
    case "late_sniper": {
      // Only fires in final 60 seconds. Uses the actual intra-window return
      // to pick the side reality is confirming. Riskless if the price feed
      // and resolution agree.
      if (remainingMs > 60_000) return null;
      const ret = intraWindowReturn(battle.id, sym);
      if (ret == null) return null;
      // Need a meaningful move to commit — avoid coin flips
      if (Math.abs(ret) < 0.001) return null;
      return ret > 0 ? "A" : "B";
    }
    default:
      return null;
  }
}

export function useStrategyExecutor() {
  useEffect(() => {
    const tick = setInterval(() => {
      const strategies = useStrategies.getState().strategies;
      const enabled = strategies.filter(s => s.enabled);
      if (enabled.length === 0) return;

      useStrategies.getState().resetDailyIfStale();
      const mood = currentMarketMood();
      const battles = useCryptoSim.getState().battles;
      const liveBattles = battles.filter(b => b.status === "live") as BattleLike[];
      const myEntries = useMyEntries.getState().entries;

      for (const strategy of enabled) {
        const stats = strategy.stats;
        // Daily cap
        if (stats.forecastsToday >= strategy.maxPerDay) continue;
        // Market-condition gate
        if (!moodMatchesCondition(mood, strategy.marketCondition)) continue;
        // Budget gate (covered also by spendBudget but skip cheaply)
        if (strategy.budget.remaining < strategy.stake) {
          // Auto-pause due to budget exhaustion
          useStrategies.getState().pause(strategy.id, "budget_exhausted");
          continue;
        }

        // Filter candidate battles
        const candidates = liveBattles.filter(b => {
          if (myEntries.some(e => e.battleId === b.id && e.status === "open")) return false;
          if (strategy.params.assetFilter.length > 0) {
            const overlap = b.assets.some(a => strategy.params.assetFilter.includes(a));
            if (!overlap) return false;
          }
          return true;
        });
        if (candidates.length === 0) continue;

        // Place ONE forecast per tick per strategy (avoid hammering)
        for (const battle of candidates) {
          const total = parseDuration(battle.durationLabel);
          const side = decideForecastSide(strategy, battle, battle.endsInMs, total);
          if (!side) continue;

          // Optional edge gate: only fire when the model's fair-value
          // estimate diverges from the market by at least minEdgePp.
          // Skips when we don't have enough price data to estimate fair value.
          const minEdge = strategy.params.minEdgePp;
          if (minEdge != null && minEdge > 0) {
            const e = bestEdgeSide(battle);
            if (!e) continue; // can't estimate fair value yet
            if (e.edgePp < minEdge) continue; // not enough edge to act
            if (e.side !== side) continue; // model disagrees with the pattern — bail
          }

          // Debit the strategy's own budget (NOT the wallet)
          const ok = useStrategies.getState().spendBudget(strategy.id, strategy.stake);
          if (!ok) {
            useStrategies.getState().pause(strategy.id, "budget_exhausted");
            break;
          }

          const sideLabel = side === "A" ? battle.sideA.label : battle.sideB.label;
          useMyEntries.getState().add({
            battleId: battle.id,
            battleTitle: battle.title,
            side,
            sideLabel,
            stake: strategy.stake,
            endsAt: Date.now() + battle.endsInMs,
            durationMs: total,
            strategyId: strategy.id,
          });
          useStrategies.getState().recordForecast(strategy.id);
          break;
        }
      }
    }, 5_000);

    return () => clearInterval(tick);
  }, []);
}
