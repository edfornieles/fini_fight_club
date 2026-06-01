/**
 * Server-side multi-source price provider for Battle Factory + Resolver.
 *
 * Returns price + per-source breakdown + spread (basis points) so the resolver
 * can implement the priceIntegrity contract: refuse to settle if spread > 50bps
 * (the migration default) and either auto-void or mark `manual_review`.
 *
 * Deno runtime — uses global fetch only, no deps.
 */

export type Symbol = "BTC" | "ETH" | "SOL" | "DOGE" | "BNB" | "LINK" | "AVAX" | "UNI" | "MATIC" | "XTZ";

export interface PriceSnapshot {
  symbol: Symbol;
  median: number;
  samples: { source: string; usd: number }[];
  spreadBps: number;
  fetchedAt: number;
  /** True if we have >= 2 sources within the deviation threshold. */
  trustworthy: boolean;
}

const COINGECKO_IDS: Record<Symbol, string> = {
  BTC: "bitcoin", ETH: "ethereum", SOL: "solana", DOGE: "dogecoin",
  BNB: "binancecoin", LINK: "chainlink", AVAX: "avalanche-2",
  UNI: "uniswap", MATIC: "polygon-ecosystem-token", XTZ: "tezos",
};
const COINBASE_PAIRS: Record<Symbol, string> = {
  BTC: "BTC-USD", ETH: "ETH-USD", SOL: "SOL-USD", DOGE: "DOGE-USD",
  BNB: "", LINK: "LINK-USD", AVAX: "AVAX-USD",
  UNI: "UNI-USD", MATIC: "POL-USD", XTZ: "XTZ-USD",
};
const BINANCE_PAIRS: Record<Symbol, string> = {
  BTC: "BTCUSDT", ETH: "ETHUSDT", SOL: "SOLUSDT", DOGE: "DOGEUSDT",
  BNB: "BNBUSDT", LINK: "LINKUSDT", AVAX: "AVAXUSDT",
  UNI: "UNIUSDT", MATIC: "POLUSDT", XTZ: "XTZUSDT",
};

const TIMEOUT_MS = 4_000;

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return await Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)),
  ]);
}

async function cg(symbol: Symbol): Promise<number | null> {
  const id = COINGECKO_IDS[symbol];
  try {
    const r = await withTimeout(
      fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`),
      TIMEOUT_MS,
    );
    if (!r.ok) return null;
    const j = await r.json() as Record<string, { usd?: number }>;
    return Number(j?.[id]?.usd) || null;
  } catch { return null; }
}

async function coinbase(symbol: Symbol): Promise<number | null> {
  const pair = COINBASE_PAIRS[symbol];
  if (!pair) return null;
  try {
    const r = await withTimeout(
      fetch(`https://api.exchange.coinbase.com/products/${pair}/ticker`),
      TIMEOUT_MS,
    );
    if (!r.ok) return null;
    const j = await r.json() as { price?: string };
    return Number(j?.price) || null;
  } catch { return null; }
}

async function binance(symbol: Symbol): Promise<number | null> {
  const pair = BINANCE_PAIRS[symbol];
  try {
    const r = await withTimeout(
      fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${pair}`),
      TIMEOUT_MS,
    );
    if (!r.ok) return null;
    const j = await r.json() as { price?: string };
    return Number(j?.price) || null;
  } catch { return null; }
}

/**
 * Fetch a verified snapshot for a single symbol. Calls all three providers in
 * parallel and median-aggregates. `trustworthy` = at least 2 sources within
 * `maxDeviationBps` (default 50bps = 0.5%) of the median.
 */
export async function fetchPriceSnapshot(
  symbol: Symbol,
  maxDeviationBps = 50,
): Promise<PriceSnapshot> {
  const [cgPrice, cbPrice, bnPrice] = await Promise.all([cg(symbol), coinbase(symbol), binance(symbol)]);
  const samples: { source: string; usd: number }[] = [];
  if (cgPrice) samples.push({ source: "coingecko_v3", usd: cgPrice });
  if (cbPrice) samples.push({ source: "coinbase_spot", usd: cbPrice });
  if (bnPrice) samples.push({ source: "binance_spot", usd: bnPrice });

  if (samples.length === 0) {
    return { symbol, median: 0, samples: [], spreadBps: 0, fetchedAt: Date.now(), trustworthy: false };
  }

  const sorted = samples.map(s => s.usd).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const spreadBps = sorted.length >= 2
    ? Math.round(Math.abs(sorted[sorted.length - 1] - sorted[0]) / median * 10_000)
    : 0;

  // Trust requires: ≥2 sources AND spread within threshold.
  // If we only have 1 source, we DON'T mark it trustworthy — caller should
  // typically void the battle or send to manual review.
  const trustworthy = samples.length >= 2 && spreadBps <= maxDeviationBps;

  return { symbol, median, samples, spreadBps, fetchedAt: Date.now(), trustworthy };
}
