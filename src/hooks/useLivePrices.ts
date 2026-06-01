import { useEffect, useRef, useState } from "react";
import { fetchPricesMulti, type LivePrices, type PriceData } from "../lib/priceProviders";

// Re-export the format helpers + types for backwards-compat with existing imports
export { fmtPrice, fmtChange } from "../lib/priceProviders";
export type { LivePrices, PriceData };

const REFRESH_INTERVAL_MS = 30_000;   // polite to CoinGecko free tier
const STALE_AFTER_MS      = 90_000;   // surface as error after 90s with no fresh data

/**
 * Live prices for the 10 supported assets, polled every 30 s.
 *
 *  - Multi-source: CoinGecko (primary) + Coinbase + Binance (median + spread)
 *  - In-memory cache shared across components via priceProviders.fetchPricesMulti
 *  - Pauses polling when the tab is hidden, resumes on visibility
 *  - Surfaces `staleness` so callers can grey out / warn the user
 */
export function useLivePrices() {
  const [prices, setPrices]         = useState<LivePrices>({});
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let alive = true;

    async function tick() {
      try {
        const p = await fetchPricesMulti();
        if (!alive) return;
        if (Object.keys(p).length === 0) {
          setError("all_providers_failed");
        } else {
          setPrices(p);
          setLastUpdated(new Date());
          setError(null);
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "fetch_failed");
      } finally {
        if (alive) setLoading(false);
      }
    }

    function start() {
      if (timerRef.current) return;
      tick(); // immediate
      timerRef.current = setInterval(tick, REFRESH_INTERVAL_MS);
    }
    function stop() {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }
    function onVis() {
      if (document.visibilityState === "visible") start();
      else stop();
    }

    start();
    document.addEventListener("visibilitychange", onVis);

    return () => {
      alive = false;
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const stale = lastUpdated ? Date.now() - lastUpdated.getTime() > STALE_AFTER_MS : false;
  return { prices, loading, error, lastUpdated, stale };
}
