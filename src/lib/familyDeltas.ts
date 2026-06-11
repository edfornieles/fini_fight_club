/**
 * Per-timeframe % change for the 10 family coins — powers the 1D/1H/1W/1M/1Y
 * tabs on the Fini viewer card (and through them, the Fini's mood).
 *
 * One CoinGecko /coins/markets call covers every window for every coin.
 * Same-origin proxy (/api/markets, Cloudflare Pages Function) is tried first
 * because ad blockers commonly block api.coingecko.com in the browser.
 */
import { useEffect, useState } from "react";
import { COINGECKO_IDS } from "./priceProviders";

export type TimeWindow = "1H" | "1D" | "1W" | "1M" | "1Y";
export type FamilyDelta = { price?: number } & Partial<Record<TimeWindow, number | null>>;
export type FamilyDeltas = Record<string, FamilyDelta>;

const TTL_MS = 60_000;
let cache: { data: FamilyDeltas; at: number } | null = null;
let inflight: Promise<FamilyDeltas> | null = null;

async function fetchDirect(): Promise<FamilyDeltas> {
  const ids = Object.values(COINGECKO_IDS).join(",");
  const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&price_change_percentage=1h,24h,7d,30d,1y`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`coingecko markets ${r.status}`);
  const rows = await r.json() as Array<Record<string, unknown>>;
  const out: FamilyDeltas = {};
  for (const row of rows) {
    const sym = Object.keys(COINGECKO_IDS).find(
      k => COINGECKO_IDS[k as keyof typeof COINGECKO_IDS] === row.id,
    );
    if (!sym) continue;
    out[sym] = {
      price: row.current_price as number,
      "1H": (row.price_change_percentage_1h_in_currency as number) ?? null,
      "1D": (row.price_change_percentage_24h_in_currency as number)
        ?? (row.price_change_percentage_24h as number) ?? null,
      "1W": (row.price_change_percentage_7d_in_currency as number) ?? null,
      "1M": (row.price_change_percentage_30d_in_currency as number) ?? null,
      "1Y": (row.price_change_percentage_1y_in_currency as number) ?? null,
    };
  }
  return out;
}

export async function fetchFamilyDeltas(): Promise<FamilyDeltas> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      try {
        const r = await fetch("/api/markets");
        if (r.ok) {
          const j = await r.json() as FamilyDeltas;
          if (j && Object.keys(j).length >= 5) {
            cache = { data: j, at: Date.now() };
            return j;
          }
        }
      } catch { /* fall through to direct */ }
      const j = await fetchDirect();
      cache = { data: j, at: Date.now() };
      return j;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** Latest per-timeframe deltas, refreshed every 2 minutes. Null until loaded. */
export function useFamilyDeltas(): FamilyDeltas | null {
  const [data, setData] = useState<FamilyDeltas | null>(cache?.data ?? null);
  useEffect(() => {
    let on = true;
    const tick = () => { fetchFamilyDeltas().then(d => { if (on) setData(d); }).catch(() => {}); };
    tick();
    const t = setInterval(tick, 120_000);
    return () => { on = false; clearInterval(t); };
  }, []);
  return data;
}
