/**
 * GET /api/markets
 *
 * Cloudflare Pages Function — per-timeframe % change for the 10 Fini family
 * coins, in one CoinGecko /coins/markets call. Same reason as /api/prices:
 * ad blockers commonly block api.coingecko.com client-side, so the browser
 * talks to its own origin instead.
 *
 * Response: { BTC: { price, "1H", "1D", "1W", "1M", "1Y" }, ... } — values are
 * percent units (0.98 → +0.98%).
 */
const COINGECKO_IDS = {
  BTC: "bitcoin", ETH: "ethereum", SOL: "solana", DOGE: "dogecoin",
  BNB: "binancecoin", LINK: "chainlink", AVAX: "avalanche-2",
  UNI: "uniswap", MATIC: "polygon-ecosystem-token", XTZ: "tezos",
};

const TIMEOUT_MS = 6_000;

function withTimeout(p, ms) {
  return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
}

export async function onRequest() {
  const ids = Object.values(COINGECKO_IDS).join(",");
  const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&price_change_percentage=1h,24h,7d,30d,1y`;
  let rows;
  try {
    const r = await withTimeout(fetch(url), TIMEOUT_MS);
    if (!r.ok) throw new Error(`cg ${r.status}`);
    rows = await r.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 502,
      headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
    });
  }
  const out = {};
  for (const row of rows) {
    const sym = Object.keys(COINGECKO_IDS).find(k => COINGECKO_IDS[k] === row.id);
    if (!sym) continue;
    out[sym] = {
      price: row.current_price,
      "1H": row.price_change_percentage_1h_in_currency ?? null,
      "1D": row.price_change_percentage_24h_in_currency ?? row.price_change_percentage_24h ?? null,
      "1W": row.price_change_percentage_7d_in_currency ?? null,
      "1M": row.price_change_percentage_30d_in_currency ?? null,
      "1Y": row.price_change_percentage_1y_in_currency ?? null,
    };
  }
  return new Response(JSON.stringify(out), {
    headers: {
      "content-type": "application/json",
      // Edge-cache 60s — timeframe deltas don't need 25s freshness.
      "cache-control": "public, max-age=45, s-maxage=60",
      "access-control-allow-origin": "*",
    },
  });
}
