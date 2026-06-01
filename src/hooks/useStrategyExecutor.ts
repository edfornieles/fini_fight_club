/**
 * useStrategyExecutor — runs all enabled Forecaster strategies on a 5s tick.
 *
 * For each enabled strategy:
 *  1. Check the daily cap (forecastsToday < maxPerDay)
 *  2. Find candidate battles (live, in entry window, asset matches filter,
 *     not already entered)
 *  3. Apply the strategy's trigger condition
 *  4. If a candidate matches, place a forecast — debits FINI$, adds a
 *     MyEntry row, increments the strategy's counter
 *
 * The placed forecast then flows through useBattleResolver naturally when
 * the battle expires — settling stake + outcome and updating the strategy's
 * win/loss stats.
 *
 * Notes:
 *  - We share parseDuration with cryptoSim's endsAt snapshot, so "remaining"
 *    is a consistent number across both modules.
 *  - Forecasters can't out-spend the wallet — if FINI$ < stake, the forecast
 *    is silently skipped (the strategy stays enabled, will retry next tick).
 */

import { useEffect } from "react";
import { useStrategies, type Strategy, type StrategyType } from "../state/strategiesStore";
import { useCryptoSim } from "../data/cryptoSim";
import { useMyEntries } from "../state/myEntriesStore";
import { useCoinStore } from "../state/coinStore";

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

/** Decide whether this strategy wants to forecast this battle, and on which side. */
function decideForecastSide(strategy: Strategy, battle: BattleLike, remainingMs: number, totalMs: number): "A" | "B" | null {
  const remainingPct = totalMs > 0 ? (remainingMs / totalMs) * 100 : 0;

  switch (strategy.type as StrategyType) {
    case "flat_bias": {
      // Always pick the configured side
      return strategy.params.sideFilter ?? "A";
    }
    case "loyalist": {
      // Same as flat — but conceptually anchored to a specific asset
      return strategy.params.sideFilter ?? "A";
    }
    case "contrarian": {
      // Pick the side whose share is below the threshold
      const threshold = strategy.params.pctThreshold ?? 40;
      if (battle.sideA.pct < threshold) return "A";
      if (battle.sideB.pct < threshold) return "B";
      return null; // no obvious underdog
    }
    case "momentum": {
      // Pick the leading side, but only when the lead is meaningful (>10%)
      const diff = Math.abs(battle.sideA.pct - battle.sideB.pct);
      if (diff < 10) return null;
      return battle.sideA.pct > battle.sideB.pct ? "A" : "B";
    }
    case "late_joiner": {
      // Only fire when battle is past the fireUnderRemainingPct threshold
      const fireUnder = strategy.params.fireUnderRemainingPct ?? 10;
      if (remainingPct > fireUnder) return null;
      // Pick the clear leader
      if (Math.abs(battle.sideA.pct - battle.sideB.pct) < 3) return null;
      return battle.sideA.pct > battle.sideB.pct ? "A" : "B";
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
      const battles = useCryptoSim.getState().battles;
      const liveBattles = battles.filter(b => b.status === "live") as BattleLike[];
      const myEntries = useMyEntries.getState().entries;
      const myWallet = useCoinStore.getState().balance; // just a sanity check that the store is loaded

      for (const strategy of enabled) {
        const stats = strategy.stats;
        if (stats.forecastsToday >= strategy.maxPerDay) continue;
        if (useCoinStore.getState().balance < strategy.stake) continue;

        // Filter candidate battles
        const candidates = liveBattles.filter(b => {
          // Must not already have an open entry from this user
          if (myEntries.some(e => e.battleId === b.id && e.status === "open")) return false;
          // Apply asset whitelist
          if (strategy.params.assetFilter.length > 0) {
            const overlap = b.assets.some(a => strategy.params.assetFilter.includes(a));
            if (!overlap) return false;
          }
          return true;
        });
        if (candidates.length === 0) continue;

        // Pick the first candidate the strategy is interested in this tick
        for (const battle of candidates) {
          const total = parseDuration(battle.durationLabel);
          const side = decideForecastSide(strategy, battle, battle.endsInMs, total);
          if (!side) continue;

          // Place the forecast
          const sideLabel = side === "A" ? battle.sideA.label : battle.sideB.label;
          const ok = useCoinStore.getState().balance >= strategy.stake;
          if (!ok) break;
          useCoinStore.getState().spend(strategy.stake);
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
          // One forecast per strategy per tick to avoid hammering when many candidates match
          break;
        }

        // suppress unused-var lint
        void myWallet;
      }
    }, 5_000);

    return () => clearInterval(tick);
  }, []);
}
