/**
 * Compute the current "market condition" from the live price feed.
 * Used by Forecaster strategies that only fire under specific market moods.
 *
 *   bullish   : avg 24h change > +2%
 *   bearish   : avg 24h change < -2%
 *   volatile  : (max - min) 24h change > 8%
 *   calm      : (max - min) 24h change < 3%
 *   neutral   : everything else
 */
import { getCachedPrices } from "./priceProviders";
import type { MarketCondition } from "../state/strategiesStore";

export type MarketMood = "bullish" | "bearish" | "volatile" | "calm" | "neutral";

export function currentMarketMood(): MarketMood {
  const prices = getCachedPrices();
  if (!prices) return "neutral";
  const changes = Object.values(prices)
    .map(p => p?.usd_24h_change)
    .filter((c): c is number => typeof c === "number");
  if (changes.length === 0) return "neutral";
  const avg = changes.reduce((a, b) => a + b, 0) / changes.length;
  const max = Math.max(...changes);
  const min = Math.min(...changes);
  const spread = max - min;

  // Direction first: cross-asset spread is almost always >8 in crypto, so
  // checking spread before direction made "bullish"/"bearish" unreachable.
  if (avg >= 2)    return "bullish";
  if (avg <= -2)   return "bearish";
  if (spread > 8)  return "volatile";
  if (spread < 3)  return "calm";
  return "neutral";
}

/** Does the current mood satisfy this strategy's required condition? */
export function moodMatchesCondition(mood: MarketMood, required: MarketCondition): boolean {
  if (required === "any") return true;
  return mood === required;
}
