/**
 * Per-asset price velocity tracker.
 *
 * Live prices poll every 30s via useLivePrices. We append each fetch to a
 * per-asset ring buffer of {price, ts} samples, then compute rolling deltas
 * over arbitrary windows (1m / 5m / 15m / 1h).
 *
 * Velocity = (price_now - price_at_window_start) / price_at_window_start.
 * Positive = upward momentum. Magnitude in fractional form (0.005 = +0.5%).
 *
 * The history lives in module-scope memory (not persisted) — when you
 * reload the page it resets. That's fine: by design strategies should
 * warm up after a couple of price polls before firing.
 */

const HISTORY_MAX = 240;   // 240 samples × 30s = 2 hours of history
const STALE_AFTER_MS = 3 * 60 * 1000; // a sample older than 3min is considered stale

type Sample = { price: number; ts: number };

const histories: Map<string, Sample[]> = new Map();

/** Append the latest price observation. Called by useLivePrices on each poll. */
export function recordPrice(symbol: string, price: number): void {
  if (!Number.isFinite(price) || price <= 0) return;
  const list = histories.get(symbol) ?? [];
  // De-dupe consecutive identical-timestamp samples (shouldn't happen but safe)
  const last = list[list.length - 1];
  const now = Date.now();
  if (last && now - last.ts < 5_000) return; // skip if <5s since last write
  list.push({ price, ts: now });
  if (list.length > HISTORY_MAX) list.shift();
  histories.set(symbol, list);
}

/** Number of samples currently held for this symbol. */
export function samplesFor(symbol: string): number {
  return histories.get(symbol)?.length ?? 0;
}

/**
 * Seed the history with a batch of historical samples (e.g. from CoinGecko
 * market_chart). Merges + dedupes by timestamp, keeps chronological order.
 * Lets the price graph show a real curve immediately instead of waiting for
 * live polls to accumulate.
 */
export function seedSamples(symbol: string, samples: { price: number; ts: number }[]): void {
  if (samples.length === 0) return;
  const existing = histories.get(symbol) ?? [];
  const merged = [...existing, ...samples]
    .filter(s => Number.isFinite(s.price) && s.price > 0)
    .sort((a, b) => a.ts - b.ts);
  // Dedupe near-identical timestamps (within 10s)
  const deduped: Sample[] = [];
  for (const s of merged) {
    const last = deduped[deduped.length - 1];
    if (last && Math.abs(s.ts - last.ts) < 10_000) { last.price = s.price; continue; }
    deduped.push({ price: s.price, ts: s.ts });
  }
  histories.set(symbol, deduped.slice(-HISTORY_MAX));
}

/**
 * Return the {price, ts} samples for a symbol within the past windowMs,
 * oldest-first. For drawing price graphs. Returns [] when no history.
 */
export function priceSeries(symbol: string, windowMs: number): { price: number; ts: number }[] {
  const list = histories.get(symbol);
  if (!list || list.length === 0) return [];
  const cutoff = Date.now() - windowMs;
  return list.filter(s => s.ts >= cutoff).map(s => ({ price: s.price, ts: s.ts }));
}

/** Latest recorded price for a symbol, or null. */
export function latestPrice(symbol: string): number | null {
  const list = histories.get(symbol);
  return list && list.length ? list[list.length - 1].price : null;
}

/**
 * Compute price change over the past `windowMs`.
 * Returns the fractional change (0.005 = +0.5%, -0.02 = -2%).
 * Returns null if we don't have enough history yet, or it's stale.
 */
export function velocity(symbol: string, windowMs: number): number | null {
  const list = histories.get(symbol);
  if (!list || list.length < 2) return null;
  const now = Date.now();
  const recent = list[list.length - 1];
  if (now - recent.ts > STALE_AFTER_MS) return null;
  const cutoff = now - windowMs;
  // Find the oldest sample within the window. If everything is younger than
  // the cutoff we can't compute the requested window — return null rather
  // than a fake number.
  const old = list.find(s => s.ts >= cutoff);
  if (!old || old === recent) {
    // Try the oldest available sample as a fallback if window is large
    if (windowMs >= 60_000) {
      const first = list[0];
      if (first === recent) return null;
      return (recent.price - first.price) / first.price;
    }
    return null;
  }
  return (recent.price - old.price) / old.price;
}

/** Convenience accessors */
export const velocity1m  = (sym: string) => velocity(sym, 60_000);
export const velocity5m  = (sym: string) => velocity(sym, 5  * 60_000);
export const velocity15m = (sym: string) => velocity(sym, 15 * 60_000);
export const velocity1h  = (sym: string) => velocity(sym, 60 * 60_000);

/** Reset (for tests). */
export function clearHistory(): void { histories.clear(); }
