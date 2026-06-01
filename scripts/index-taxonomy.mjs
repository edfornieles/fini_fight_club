/**
 * Taxonomy indexer — scans the Finiliar metadata API and builds the real
 * Family → Clan hierarchy (plus frequency + special/mythical tallies) for the
 * in-game Explore page.
 *
 * Keyless + read-only. Writes public/data/taxonomy.json.
 *
 * Usage:
 *   node scripts/index-taxonomy.mjs [count] [concurrency]
 *   node scripts/index-taxonomy.mjs            # full 10000
 *   node scripts/index-taxonomy.mjs 500 16     # quick sample
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const API = "https://api-public.finiliar.com/metadata";
const TOTAL = Number(process.argv[2] ?? 10000);
const CONCURRENCY = Number(process.argv[3] ?? 20);
const OUT = "public/data/taxonomy.json";

// Full family name → in-game ticker.
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
        family: FAMILY_TICKER[a.Family] ?? a.Family ?? "?",
        clan: a.Clan ?? "(none)",
        frequency: a.Frequency ?? "?",
        special: a.Special,
        mythical: a.Mythical,
      };
    } catch {
      await new Promise((res) => setTimeout(res, 250 * (t + 1)));
    }
  }
  return null;
}

const families = {}; // ticker -> { count, clans:{}, frequencies:{}, specials, mythicals }
function record(rec) {
  const f = (families[rec.family] ??= { count: 0, clans: {}, frequencies: {}, specials: 0, mythicals: 0 });
  f.count++;
  f.clans[rec.clan] = (f.clans[rec.clan] ?? 0) + 1;
  f.frequencies[rec.frequency] = (f.frequencies[rec.frequency] ?? 0) + 1;
  if (rec.special) f.specials++;
  if (rec.mythical) f.mythicals++;
}

let done = 0;
let cursor = 0;
async function worker() {
  while (cursor < TOTAL) {
    const id = cursor++;
    const rec = await fetchToken(id);
    if (rec) record(rec);
    if (++done % 500 === 0) process.stdout.write(`  …${done}/${TOTAL}\n`);
  }
}

console.log(`Scanning ${TOTAL} tokens at concurrency ${CONCURRENCY}…`);
const t0 = Date.now();
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

const payload = {
  source: API,
  fetchedAt: new Date().toISOString(),
  scanned: done,
  total: TOTAL,
  families,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(payload, null, 0));
const secs = ((Date.now() - t0) / 1000).toFixed(1);
const clanCount = Object.values(families).reduce((a, f) => a + Object.keys(f.clans).length, 0);
console.log(`Done in ${secs}s. ${Object.keys(families).length} families, ${clanCount} clans total → ${OUT}`);
