/**
 * GET /api/prices
 *
 * Cloudflare Pages Function — server-side multi-source price proxy.
 *
 * Why: ad blockers and privacy extensions (uBlock Origin, Brave Shields,
 * Privacy Badger) commonly block api.coingecko.com / Coinbase / Binance from
 * the browser. When all three client-side providers fail, the graphs freeze
 * and assets like UNI never appear. This proxy runs on Cloudflare's edge so
 * the browser only ever talks to its own origin — extensions can't block it.
 *
 * Strategy: race the same three providers in parallel, return prices keyed
 * by symbol with the audit metadata the client expects.
 *
 * Free tier: Cloudflare Pages Functions = 100,000 requests/day on the free
 * plan. At 30s polling per user we'd burn ~2,880/day — i.e. ~35 active
 * users before nearing the limit. We cache 25s at the edge to amortise.
 */
const SYMBOLS = ["BTC", "ETH", "SOL", "DOGE", "BNB", "LINK", "AVAX", "UNI", "MATIC", "XTZ"];
const COINGECKO_IDS = {
  BTC: "bitcoin", ETH: "ethereum", SOL: "solana", DOGE: "dogecoin",
  BNB: "binancecoin", LINK: "chainlink", AVAX: "avalanche-2",
  UNI: "uniswap", MATIC: "polygon-ecosystem-token", XTZ: "tezos",
};
const COINBASE_PAIRS = {
  BTC: "BTC-USD", ETH: "ETH-USD", SOL: "SOL-USD", DOGE: "DOGE-USD",
  BNB: "", LINK: "LINK-USD", AVAX: "AVAX-USD", UNI: "UNI-USD",
  MATIC: "POL-USD", XTZ: "XTZ-USD",
};
const BINANCE_PAIRS = {
  BTC: "BTCUSDT", ETH: "ETHUSDT", SOL: "SOLUSDT", DOGE: "DOGEUSDT",
  BNB: "BNBUSDT", LINK: "LINKUSDT", AVAX: "AVAXUSDT", UNI: "UNIUSDT",
  MATIC: "POLUSDT", XTZ: "XTZUSDT",
};

const TIMEOUT_MS = 4_000;

function withTimeout(p, ms) {
  return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
}

async function tryCG() {
  const ids = SYMBOLS.map(s => COINGECKO_IDS[s]).join(",");
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;
  const r = await withTimeout(fetch(url), TIMEOUT_MS);
  if (!r.ok) throw new Error(`cg ${r.status}`);
  const raw = await r.json();
  const out = {};
  for (const s of SYMBOLS) { const row = raw[COINGECKO_IDS[s]]; if (row?.usd) out[s] = { usd: row.usd, ch: row.usd_24h_change ?? 0 }; }
  return out;
}

async function tryCB() {
  const out = {};
  await Promise.all(SYMBOLS.map(async s => {
    const pair = COINBASE_PAIRS[s]; if (!pair) return;
    try {
      const r = await withTimeout(fetch(`https://api.exchange.coinbase.com/products/${pair}/stats`), TIMEOUT_MS);
      if (!r.ok) return;
      const j = await r.json();
      const last = Number(j.last), open = Number(j.open);
      if (!Number.isFinite(last) || last <= 0) return;
      out[s] = { usd: last, ch: Number.isFinite(open) && open > 0 ? ((last - open) / open) * 100 : undefined };
    } catch { /* ignore */ }
  }));
  return out;
}

async function tryBN() {
  try {
    const symbols = SYMBOLS.map(s => `"${BINANCE_PAIRS[s]}"`).join(",");
    const r = await withTimeout(fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=[${encodeURIComponent(symbols)}]`), TIMEOUT_MS);
    if (!r.ok) return {};
    const arr = await r.json();
    const out = {};
    for (const row of arr) {
      const s = Object.keys(BINANCE_PAIRS).find(k => BINANCE_PAIRS[k] === row.symbol);
      if (!s) continue;
      const last = Number(row.lastPrice), ch = Number(row.priceChangePercent);
      if (Number.isFinite(last) && last > 0) out[s] = { usd: last, ch: Number.isFinite(ch) ? ch : undefined };
    }
    return out;
  } catch { return {}; }
}

export async function onRequest() {
  const [cg, cb, bn] = await Promise.all([tryCG().catch(() => ({})), tryCB(), tryBN()]);
  const now = Date.now();
  const merged = {};
  for (const s of SYMBOLS) {
    const samples = [];
    if (cg[s]?.usd) samples.push({ source: "coingecko", usd: cg[s].usd, ch: cg[s].ch });
    if (cb[s]?.usd) samples.push({ source: "coinbase", usd: cb[s].usd, ch: cb[s].ch });
    if (bn[s]?.usd) samples.push({ source: "binance", usd: bn[s].usd, ch: bn[s].ch });
    if (samples.length === 0) continue;
    samples.sort((a, b) => a.usd - b.usd);
    const median = samples.length === 1 ? samples[0].usd
      : samples.length === 2 ? (samples[0].usd + samples[1].usd) / 2
      : samples[1].usd;
    const spread = samples.length > 1 ? Math.round(((samples.at(-1).usd - samples[0].usd) / median) * 10000) : 0;
    const ch24 = samples.find(s => typeof s.ch === "number")?.ch ?? 0;
    merged[s] = { usd: median, usd_24h_change: ch24, sources: samples.map(s => s.source), spreadBps: spread, fetchedAt: now };
  }
  return new Response(JSON.stringify(merged), {
    headers: {
      "content-type": "application/json",
      // Edge-cache 25s so 35 active users → ~140 origin fetches/hr
      "cache-control": "public, max-age=20, s-maxage=25",
      "access-control-allow-origin": "*",
    },
  });
}
