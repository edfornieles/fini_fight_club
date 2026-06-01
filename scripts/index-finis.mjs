/**
 * Per-token trait indexer — scans the Finiliar metadata API and writes a
 * compact tokenId → {family, clan, frequency, special, mythical} map so the
 * Explore page can list the actual Finis in any family/clan and let you
 * navigate to each one (and on to its owner / OpenSea page).
 *
 * Keyless + read-only. Writes public/data/finis.json.
 * Companion to index-taxonomy.mjs (which only stores clan COUNTS).
 *
 * Usage:
 *   node scripts/index-finis.mjs [count] [concurrency]
 *   node scripts/index-finis.mjs            # full 10000
 *   node scripts/index-finis.mjs 500 16     # quick sample
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const API = "https://api-public.finiliar.com/metadata";
const TOTAL = Number(process.argv[2] ?? 10000);
const CONCURRENCY = Number(process.argv[3] ?? 20);
const OUT = "public/data/finis.json";

const FAMILY_TICKER = {
  Bitcoin: "BTC", Ethereum: "ETH", Solana: "SOL", Dogecoin: "DOGE",
  Chainlink: "LINK", Uniswap: "UNI", Avalanche: "AVAX", Binance: "BNB",
  Polygon: "MATIC", Tezos: "XTZ",
};

async function fetchToken(id, tries = 3) {
  for (let t = 0; t < tries; t++) {
    try {
      const r = await fetch(`${API}/${id}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      const a = Object.fromEntries((d.attributes || []).map((x) => [x.trait_type, x.value]));
      return {
        f: FAMILY_TICKER[a.Family] ?? a.Family ?? "?",
        c: a.Clan ?? "(none)",
        q: a.Frequency ?? "?",
        ...(a.Special ? { s: a.Special } : {}),
        ...(a.Mythical ? { m: a.Mythical } : {}),
      };
    } catch {
      await new Promise((res) => setTimeout(res, 250 * (t + 1)));
    }
  }
  return null;
}

const tokens = {}; // id -> {f,c,q,s?,m?}
let done = 0;
let cursor = 0;
async function worker() {
  while (cursor < TOTAL) {
    const id = cursor++;
    const rec = await fetchToken(id);
    if (rec) tokens[id] = rec;
    if (++done % 500 === 0) process.stdout.write(`  …${done}/${TOTAL}\n`);
  }
}

console.log(`Scanning ${TOTAL} tokens at concurrency ${CONCURRENCY}…`);
const t0 = Date.now();
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

const payload = {
  source: API,
  fetchedAt: new Date().toISOString(),
  scanned: Object.keys(tokens).length,
  total: TOTAL,
  tokens,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(payload));
const secs = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`Done in ${secs}s. Indexed ${payload.scanned}/${TOTAL} → ${OUT}`);
