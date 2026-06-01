/**
 * Historical price fetcher — pulls real recent price history from CoinGecko's
 * market_chart endpoint so battle graphs show a real curve immediately (rather
 * than waiting for live polls to slowly accumulate samples).
 *
 * CoinGecko free tier: market_chart?days=1 returns ~5-minute granularity for
 * the last 24h. We fetch once per asset, cache in sessionStorage for 2 min,
 * and seed the velocity tracker + battle opening price from it.
 */

import { COINGECKO_IDS, type Symbol } from "./priceProviders";
import { seedSamples } from "./velocity";
import { setOpening } from "./openingPrices";

const CACHE_TTL_MS = 120_000;
const inflight = new Map<string, Promise<void>>();

interface CachedSeries { samples: { price: number; ts: number }[]; fetchedAt: number }

function cacheKey(sym: string) { return `fini-hist-${sym}`; }

function readCache(sym: string): CachedSeries | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(sym));
    if (!raw) return null;
    const c = JSON.parse(raw) as CachedSeries;
    if (Date.now() - c.fetchedAt > CACHE_TTL_MS) return null;
    return c;
  } catch { return null; }
}

/**
 * Fetch the last 24h of price history for a symbol, seed the velocity tracker,
 * and (if a battle + window are given) set the opening price to the real price
 * at the window's start. Safe to call repeatedly — dedupes + caches.
 */
export async function seedHistoryFor(
  symbol: string,
  opts?: { battleId?: string; windowMs?: number },
): Promise<void> {
  const sym = symbol as Symbol;
  const cgId = COINGECKO_IDS[sym];
  if (!cgId) return;

  // Serve from cache if warm
  const cached = readCache(symbol);
  if (cached) {
    applySeed(symbol, cached.samples, opts);
    return;
  }
  // Dedupe concurrent fetches
  const existing = inflight.get(symbol);
  if (existing) { await existing; const c = readCache(symbol); if (c) applySeed(symbol, c.samples, opts); return; }

  const p = (async () => {
    try {
      const url = `https://api.coingecko.com/api/v3/coins/${cgId}/market_chart?vs_currency=usd&days=1`;
      const res = await fetch(url);
      if (!res.ok) return;
      const json = await res.json() as { prices?: [number, number][] };
      const samples = (json.prices ?? []).map(([ts, price]) => ({ ts, price }));
      if (samples.length === 0) return;
      try { sessionStorage.setItem(cacheKey(symbol), JSON.stringify({ samples, fetchedAt: Date.now() })); } catch { /* ignore quota */ }
      applySeed(symbol, samples, opts);
    } catch { /* network error — graph falls back to live samples */ }
  })();
  inflight.set(symbol, p);
  await p;
  inflight.delete(symbol);
}

function applySeed(
  symbol: string,
  samples: { price: number; ts: number }[],
  opts?: { battleId?: string; windowMs?: number },
): void {
  seedSamples(symbol, samples);
  // Set opening = the real price nearest the window start
  if (opts?.battleId && opts.windowMs) {
    const windowStart = Date.now() - opts.windowMs;
    // Find the sample closest to windowStart
    let best: { price: number; ts: number } | null = null;
    let bestDist = Infinity;
    for (const s of samples) {
      const d = Math.abs(s.ts - windowStart);
      if (d < bestDist) { bestDist = d; best = s; }
    }
    if (best) setOpening(opts.battleId, symbol, best.price);
  }
}
