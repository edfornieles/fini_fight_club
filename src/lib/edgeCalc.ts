/**
 * Edge calculator — computes a strategy's "fair odds" estimate for a battle
 * and the gap (edge, in percentage points) between that estimate and the
 * sim's current market odds.
 *
 * This is the core of every real Polymarket bot: trade only when |market - model| > X.
 * Without an edge gate, a strategy just fires on patterns and ends up at ~50% win rate.
 * With one, it sits out 80%+ of opportunities and only acts on mispricings.
 */

import { intraWindowReturn } from "./openingPrices";
import { velocity5m, velocity1m, velocity15m } from "./velocity";

interface BattleForEdge {
  id: string;
  type: string;
  assets: string[];
  durationLabel: string;
  endsInMs: number;
  sideA: { pct: number };
  sideB: { pct: number };
}

/**
 * For an Up/Down battle, our fair odds estimate combines:
 *   - intra-window return (has the price already moved?)
 *   - 5-minute velocity (which way is momentum heading?)
 *   - time pressure (less time → the lead compounds)
 *
 * Returns the fair probability that side A (Up) wins, 0..1.
 * Returns null when we don't have enough data to estimate.
 */
export function fairProbabilityA(battle: BattleForEdge): number | null {
  if (battle.type === "updown" && battle.assets.length === 1) {
    const sym = battle.assets[0];
    const ret = intraWindowReturn(battle.id, sym);
    const vel = velocity5m(sym);
    if (ret == null && vel == null) return null;

    // Time-pressure factor: more elapsed → narrower window for reversal,
    // so even small leads compress to certainty.
    const totalMs = parseDuration(battle.durationLabel);
    const elapsed = totalMs > 0 ? Math.min(1, Math.max(0, (totalMs - battle.endsInMs) / totalMs)) : 0;
    const tightness = 0.3 + 0.7 * Math.pow(elapsed, 1.5);

    // Combine return + velocity. tanh keeps the output in (-1, 1).
    // Coefficients are chosen so a 1% intra-window return at 50% elapsed
    // yields ~+12pp shift toward A, in the same ballpark as a real prediction
    // market.
    const r = ret ?? 0;
    const v = vel ?? 0;
    const signal = r * 25 + v * 15;          // weight return > velocity
    const skew = Math.tanh(signal * tightness); // → (-1, +1)
    return 0.5 + 0.45 * skew;                 // clamp to (5%, 95%)
  }

  if (battle.type === "outperform" && battle.assets.length === 2) {
    const aRet = intraWindowReturn(battle.id, battle.assets[0]);
    const bRet = intraWindowReturn(battle.id, battle.assets[1]);
    if (aRet == null || bRet == null) return null;
    const totalMs = parseDuration(battle.durationLabel);
    const elapsed = totalMs > 0 ? Math.min(1, Math.max(0, (totalMs - battle.endsInMs) / totalMs)) : 0;
    const tightness = 0.3 + 0.7 * Math.pow(elapsed, 1.5);
    const diff = aRet - bRet;
    const skew = Math.tanh(diff * 30 * tightness);
    return 0.5 + 0.45 * skew;
  }

  // For other battle types we don't have a price-based fair model yet.
  return null;
}

/**
 * Edge in percentage points: positive = our model thinks side A is more
 * likely than the market does (so buying side A has positive EV).
 * Negative means side B is the value pick.
 *
 * Returns null when we can't compute a fair estimate.
 */
export function edgeForSideA(battle: BattleForEdge): number | null {
  const fair = fairProbabilityA(battle);
  if (fair == null) return null;
  const marketA = battle.sideA.pct / 100;
  return (fair - marketA) * 100; // in pp
}

/** Convenience: which side has positive edge and how much? */
export function bestEdgeSide(battle: BattleForEdge): { side: "A" | "B"; edgePp: number } | null {
  const edge = edgeForSideA(battle);
  if (edge == null) return null;
  return edge >= 0
    ? { side: "A", edgePp: edge }
    : { side: "B", edgePp: -edge };
}

// ── helpers ─────────────────────────────────────────────────────────────

function parseDuration(label: string): number {
  const m = /^(\d+)(m|h)$/.exec(label.trim());
  if (!m) return 60 * 60 * 1000;
  return Number(m[1]) * (m[2] === "h" ? 3_600_000 : 60_000);
}

// re-export for other modules that need raw velocity readings
export { velocity1m, velocity5m, velocity15m };
