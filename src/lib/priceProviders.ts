/**
 * Multi-source live price feed for the 10 supported assets.
 *
 * Why three providers?
 *  - CoinGecko is the default — wide coverage but rate-limited (10–30 req/min/IP on the free tier).
 *  - Coinbase Advanced Trade is per-symbol but free and fast (no rate limit on public endpoints in practice).
 *  - Binance Spot is per-symbol, very fast, also public.
 *
 * Strategy:
 *  1. Race CoinGecko first (batches all 10 in one call → 1 RTT).
 *  2. If CG fails or is rate-limited, fan out to Coinbase + Binance in parallel.
 *  3. If we have prices from ≥2 sources, median them and surface deviation.
 *  4. Cache the result in `sessionStorage` for 25s to avoid hammering refresh.
 *
 * Returns prices keyed by symbol (BTC/ETH/…) plus a per-symbol audit record
 * showing which sources contributed.
 */

export type Symbol = "BTC" | "ETH" | "SOL" | "DOGE" | "BNB" | "LINK" | "AVAX" | "UNI" | "MATIC" | "XTZ";

export interface PriceData {
  usd: number;
  usd_24h_change: number;
  /** Which providers contributed to this number. */
  sources: string[];
  /** Max basis-point spread between contributing sources. */
  spreadBps: number;
  /** When this row was fetched (epoch ms). */
  fetchedAt: number;
}

// String-indexed so callers using bare symbols (`prices["BTC"]`) keep working.
export type LivePrices = Record<string, PriceData>;

const SYMBOLS: Symbol[] = ["BTC", "ETH", "SOL", "DOGE", "BNB", "LINK", "AVAX", "UNI", "MATIC", "XTZ"];

export const COINGECKO_IDS: Record<Symbol, string> = {
  BTC: "bitcoin", ETH: "ethereum", SOL: "solana", DOGE: "dogecoin",
  BNB: "binancecoin", LINK: "chainlink", AVAX: "avalanche-2",
  UNI: "uniswap", MATIC: "polygon-ecosystem-token", XTZ: "tezos",
};

const COINBASE_PAIRS: Record<Symbol, string> = {
  BTC: "BTC-USD", ETH: "ETH-USD", SOL: "SOL-USD", DOGE: "DOGE-USD",
  BNB: "",            // not listed on Coinbase
  LINK: "LINK-USD", AVAX: "AVAX-USD", UNI: "UNI-USD",
  MATIC: "POL-USD", XTZ: "XTZ-USD",
};

const BINANCE_PAIRS: Record<Symbol, string> = {
  BTC: "BTCUSDT", ETH: "ETHUSDT", SOL: "SOLUSDT", DOGE: "DOGEUSDT",
  BNB: "BNBUSDT", LINK: "LINKUSDT", AVAX: "AVAXUSDT", UNI: "UNIUSDT",
  MATIC: "POLUSDT", XTZ: "XTZUSDT",
};

const CACHE_TTL_MS = 25_000;
const CG_TIMEOUT_MS = 5_000;
const PROVIDER_TIMEOUT_MS = 3_000;

interface CacheEntry { data: LivePrices; fetchedAt: number }
let _cache: CacheEntry | null = null;

export function getCachedPrices(): LivePrices | null {
  if (_cache && Date.now() - _cache.fetchedAt < CACHE_TTL_MS) return _cache.data;
  return null;
}

export async function fetchPricesMulti(): Promise<LivePrices> {
  // Cache hit
  const cached = getCachedPrices();
  if (cached) return cached;

  // Try CoinGecko first (one batched call)
  const cgResult = await tryCoinGecko().catch(() => null);

  // Always fetch backups in parallel — we use them for deviation check + fallback
  const [coinbaseResult, binanceResult] = await Promise.all([
    tryCoinbase().catch(() => ({} as Partial<Record<Symbol, { usd: number; usd_24h_change?: number }>>)),
    tryBinance().catch(() => ({} as Partial<Record<Symbol, { usd: number; usd_24h_change?: number }>>)),
  ]);

  const merged: LivePrices = {};
  const now = Date.now();

  for (const sym of SYMBOLS) {
    const samples: { source: string; usd: number }[] = [];
    if (cgResult?.[sym]?.usd)       samples.push({ source: "coingecko",  usd: cgResult[sym]!.usd });
    if (coinbaseResult[sym]?.usd)   samples.push({ source: "coinbase",   usd: coinbaseResult[sym]!.usd });
    if (binanceResult[sym]?.usd)    samples.push({ source: "binance",    usd: binanceResult[sym]!.usd });
    if (samples.length === 0) continue;

    const prices = samples.map(s => s.usd).sort((a, b) => a - b);
    const median = prices[Math.floor(prices.length / 2)];
    const spreadBps = prices.length >= 2
      ? Math.round(Math.abs(prices[prices.length - 1] - prices[0]) / median * 10_000)
      : 0;

    // 24h change preference: CoinGecko > Coinbase > Binance
    const change = cgResult?.[sym]?.usd_24h_change
                ?? coinbaseResult[sym]?.usd_24h_change
                ?? binanceResult[sym]?.usd_24h_change
                ?? 0;

    merged[sym] = {
      usd: median,
      usd_24h_change: change,
      sources: samples.map(s => s.source),
      spreadBps,
      fetchedAt: now,
    };
  }

  _cache = { data: merged, fetchedAt: now };
  return merged;
}

// ── Provider impls ───────────────────────────────────────────────────────────

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)),
  ]);
}

async function tryCoinGecko(): Promise<Partial<Record<Symbol, { usd: number; usd_24h_change: number }>>> {
  const ids = SYMBOLS.map(s => COINGECKO_IDS[s]).join(",");
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;
  const res = await withTimeout(fetch(url), CG_TIMEOUT_MS);
  if (!res.ok) throw new Error(`coingecko ${res.status}`);
  const raw = await res.json() as Record<string, { usd: number; usd_24h_change: number }>;
  const out: Partial<Record<Symbol, { usd: number; usd_24h_change: number }>> = {};
  for (const sym of SYMBOLS) {
    const r = raw[COINGECKO_IDS[sym]];
    if (r?.usd) out[sym] = { usd: r.usd, usd_24h_change: r.usd_24h_change ?? 0 };
  }
  return out;
}

async function tryCoinbase(): Promise<Partial<Record<Symbol, { usd: number; usd_24h_change?: number }>>> {
  // Coinbase exchange API: GET /products/{pair}/stats returns last + open + 24h
  // Per-symbol so we fan out in parallel.
  const out: Partial<Record<Symbol, { usd: number; usd_24h_change?: number }>> = {};
  await Promise.all(SYMBOLS.map(async sym => {
    const pair = COINBASE_PAIRS[sym];
    if (!pair) return;
    try {
      const r = await withTimeout(
        fetch(`https://api.exchange.coinbase.com/products/${pair}/stats`),
        PROVIDER_TIMEOUT_MS,
      );
      if (!r.ok) return;
      const j = await r.json() as { last?: string; open?: string };
      const last = Number(j.last);
      const open = Number(j.open);
      if (!Number.isFinite(last) || last <= 0) return;
      const change24 = Number.isFinite(open) && open > 0 ? ((last - open) / open) * 100 : undefined;
      out[sym] = { usd: last, usd_24h_change: change24 };
    } catch { /* ignore — fall back to other providers */ }
  }));
  return out;
}

async function tryBinance(): Promise<Partial<Record<Symbol, { usd: number; usd_24h_change?: number }>>> {
  // Binance public: GET /api/v3/ticker/24hr?symbols=[...] — one batched call
  const symbols = SYMBOLS.map(s => `"${BINANCE_PAIRS[s]}"`).join(",");
  const url = `https://api.binance.com/api/v3/ticker/24hr?symbols=[${encodeURIComponent(symbols)}]`;
  try {
    const r = await withTimeout(fetch(url), PROVIDER_TIMEOUT_MS);
    if (!r.ok) return {};
    const arr = await r.json() as { symbol: string; lastPrice: string; priceChangePercent: string }[];
    const out: Partial<Record<Symbol, { usd: number; usd_24h_change?: number }>> = {};
    for (const row of arr) {
      const sym = (Object.keys(BINANCE_PAIRS) as Symbol[]).find(s => BINANCE_PAIRS[s] === row.symbol);
      if (!sym) continue;
      const last = Number(row.lastPrice);
      const change = Number(row.priceChangePercent);
      if (Number.isFinite(last) && last > 0) {
        out[sym] = { usd: last, usd_24h_change: Number.isFinite(change) ? change : undefined };
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function fmtPrice(usd: number | undefined | null): string {
  if (usd == null || typeof usd !== "number") return "—";
  if (usd >= 1000) return "$" + usd.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (usd >= 1)    return "$" + usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return "$" + usd.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

export function fmtChange(pct: number | undefined | null): string {
  if (typeof pct !== "number" || isNaN(pct)) return "—";
  return (pct >= 0 ? "+" : "") + pct.toFixed(2) + "%";
}
