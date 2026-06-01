/**
 * Per-battle opening price snapshots.
 *
 * When a Crypto Arena battle is first observed by the sim/resolver, we snap
 * its asset prices and stash them by battleId. Then "did the price move?"
 * questions become trivial: (current - opening) / opening.
 *
 * This replaces the previous 24h-change proxy with the actual within-window
 * change — the real signal a Polymarket-style bot would trade on.
 *
 * Memory-only by design: a fresh page load re-snaps using current prices,
 * which is fine because the SIM's endsAt is also re-snapped each session.
 */

import { getCachedPrices } from "./priceProviders";

interface Snapshot {
  /** battleId → assetSymbol → opening USD */
  prices: Record<string, number>;
  takenAt: number;
}

const snapshots: Map<string, Snapshot> = new Map();

/**
 * Record opening prices for a battle if not already snapped.
 * Idempotent — a re-call doesn't overwrite the original snapshot.
 */
export function snapBattleOpening(battleId: string, assets: string[]): void {
  if (snapshots.has(battleId)) return;
  const prices = getCachedPrices();
  if (!prices) return; // no price feed warm yet — snap on next attempt
  const opening: Record<string, number> = {};
  for (const sym of assets) {
    const p = prices[sym]?.usd;
    if (typeof p === "number" && p > 0) opening[sym] = p;
  }
  if (Object.keys(opening).length === 0) return; // nothing to snap
  snapshots.set(battleId, { prices: opening, takenAt: Date.now() });
}

/** Return the opening price for a battle's asset, or null if not snapped. */
export function openingFor(battleId: string, asset: string): number | null {
  return snapshots.get(battleId)?.prices[asset] ?? null;
}

/**
 * Explicitly set an opening price — used when we fetch the REAL historical
 * price at the battle's window start (from CoinGecko), which is more accurate
 * than snapping "now" when the page first loads.
 */
export function setOpening(battleId: string, asset: string, price: number): void {
  if (!Number.isFinite(price) || price <= 0) return;
  const snap = snapshots.get(battleId) ?? { prices: {}, takenAt: Date.now() };
  snap.prices[asset] = price;
  snapshots.set(battleId, snap);
}

/**
 * Fractional intra-window return = (current - opening) / opening for an
 * asset. Positive = up since battle start, negative = down.
 * Returns null when either price is unavailable.
 */
export function intraWindowReturn(battleId: string, asset: string): number | null {
  const opening = openingFor(battleId, asset);
  if (opening == null) return null;
  const cur = getCachedPrices()?.[asset]?.usd;
  if (typeof cur !== "number" || cur <= 0) return null;
  return (cur - opening) / opening;
}

/** Total tracked battles (for diagnostics). */
export function snappedBattleCount(): number { return snapshots.size; }

/** Reset (tests / dev tools). */
export function clearAllOpenings(): void { snapshots.clear(); }
