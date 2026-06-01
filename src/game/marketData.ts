import {
  ALL_COIN_FAMILIES,
  type BattleWindow,
  type CoinFamily,
  type MarketSignalMap,
} from "./types";
import { normalizeMarketSignal } from "./marketSignals";

/**
 * LIVE market data adapter.
 *
 * This is the real-feed implementation of the seam described in
 * marketSignals.ts. It pulls real prices from CoinGecko's public API
 * (no key required) and maps them onto the same MarketSignal shape the
 * battle engine already consumes, so nothing downstream changes.
 *
 * Swapping providers later (Pyth / Chainlink / an internal oracle) means
 * implementing one function with this signature:
 *
 *     fetchLiveMarketSignals(window): Promise<MarketSignalMap>
 *
 * For Ranked / PvP determinism you'd snapshot the returned map on the
 * server at battle-lock time and replay it; the client never needs to
 * change.
 */

const COINGECKO_IDS: Record<CoinFamily, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  DOGE: "dogecoin",
  LINK: "chainlink",
  UNI: "uniswap",
  AVAX: "avalanche-2",
  BNB: "binancecoin",
  MATIC: "matic-network",
  XTZ: "tezos",
};

const ID_TO_FAMILY: Record<string, CoinFamily> = Object.fromEntries(
  (Object.entries(COINGECKO_IDS) as [CoinFamily, string][]).map(([fam, id]) => [
    id,
    fam,
  ]),
) as Record<string, CoinFamily>;

type CoinGeckoMarketRow = {
  id: string;
  current_price: number | null;
  high_24h: number | null;
  low_24h: number | null;
  price_change_percentage_1h_in_currency?: number | null;
  price_change_percentage_24h_in_currency?: number | null;
};

const API_URL =
  "https://api.coingecko.com/api/v3/coins/markets" +
  "?vs_currency=usd" +
  `&ids=${Object.values(COINGECKO_IDS).join(",")}` +
  "&price_change_percentage=1h,24h" +
  "&per_page=50&page=1&sparkline=false";

/**
 * CoinGecko's free tier gives us 1h and 24h changes directly. We
 * approximate the in-between windows so the four BattleWindow options
 * stay meaningful. These are intentionally simple — a richer feed can
 * replace them with true windowed candles later.
 */
function percentForWindow(
  window: BattleWindow,
  change1h: number,
  change24h: number,
): number {
  switch (window) {
    case "5m":
      // Rough intrabar proxy: a quarter of the last hour's move.
      return change1h / 4;
    case "1h":
      return change1h;
    case "4h":
      // Interpolate between the 1h trend and the 24h trend.
      return change1h + (change24h - change1h) * 0.25;
    case "24h":
      return change24h;
  }
}

/**
 * Realized-range volatility proxy from the 24h high/low spread,
 * normalized to [0,1]. ~12% daily range maps to max chaos.
 */
function volatilityFromRange(
  high: number | null,
  low: number | null,
  current: number | null,
): number {
  if (!high || !low || !current || current <= 0) return 0.4;
  const rangePct = ((high - low) / current) * 100;
  return Math.max(0, Math.min(1, rangePct / 12));
}

export type LiveFetchResult = {
  signals: MarketSignalMap;
  fetchedAt: number;
  source: "live";
};

/**
 * Fetch real market signals. Throws on network / parse failure so the
 * caller can fall back to the mock generator and keep the game playable
 * offline.
 */
export async function fetchLiveMarketSignals(
  window: BattleWindow,
  signal?: AbortSignal,
): Promise<LiveFetchResult> {
  const res = await fetch(API_URL, { signal, headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`CoinGecko responded ${res.status}`);
  }
  const rows = (await res.json()) as CoinGeckoMarketRow[];
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("CoinGecko returned no rows");
  }

  const byId = new Map<string, CoinGeckoMarketRow>();
  for (const row of rows) byId.set(row.id, row);

  const out = {} as MarketSignalMap;
  for (const fam of ALL_COIN_FAMILIES) {
    const row = byId.get(COINGECKO_IDS[fam]);
    if (!row) {
      // Missing coin — neutral signal so the battle still resolves.
      out[fam] = normalizeMarketSignal(0, 0.4, fam);
      continue;
    }
    const change1h = row.price_change_percentage_1h_in_currency ?? 0;
    const change24h = row.price_change_percentage_24h_in_currency ?? 0;
    const percent = percentForWindow(window, change1h, change24h);
    const volatility = volatilityFromRange(
      row.high_24h,
      row.low_24h,
      row.current_price,
    );
    out[fam] = normalizeMarketSignal(percent, volatility, fam);
  }

  return { signals: out, fetchedAt: Date.now(), source: "live" };
}

export { COINGECKO_IDS, ID_TO_FAMILY };
