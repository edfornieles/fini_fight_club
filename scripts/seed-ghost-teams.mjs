#!/usr/bin/env node
/**
 * Seed Ghost Teams — for every Fini holder in public/data/ownership.json,
 * generate a deterministic 3-Fini lineup so the game world feels populated
 * before real holders log in.
 *
 * Output: public/data/ghostTeams.json
 *   {
 *     generatedAt: "...",
 *     sourceSnapshot: "public/data/ownership.json",
 *     contract: "0x5a01…",
 *     totalHolders: 1712,
 *     teams: [
 *       { wallet: "0x…", tokenIds: [a, b, c], ownedCount: N }
 *     ]
 *   }
 *
 * Holders with <3 Finis: we pad by repeating their roster — they still
 * exist as a (weaker) opponent. Wallets that own 0 are skipped (shouldn't
 * happen but defensive).
 *
 * Determinism: a wallet's seed = first 8 hex chars of its address. So the
 * same wallet always produces the same starting lineup unless re-rolled.
 *
 * Usage:
 *   node scripts/seed-ghost-teams.mjs
 *   node scripts/seed-ghost-teams.mjs --reroll       # change seed salt
 *   node scripts/seed-ghost-teams.mjs --salt myV2    # custom salt
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const SOURCE = resolve(ROOT, "public/data/ownership.json");
const OUTPUT = resolve(ROOT, "public/data/ghostTeams.json");

const args = process.argv.slice(2);
const reroll = args.includes("--reroll");
const saltIdx = args.indexOf("--salt");
const salt = saltIdx >= 0 ? args[saltIdx + 1] : reroll ? String(Date.now()) : "v1";

// ── deterministic PRNG (xmur3 + mulberry32) ──────────────────────────────────
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}
function mulberry32(a) {
  return () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seededRng(seedString) {
  const h = xmur3(seedString);
  return mulberry32(h());
}

function pickThree(tokens, rng, pool) {
  if (tokens.length === 0) return null;
  if (tokens.length >= 3) {
    // Fisher-Yates partial shuffle for first 3
    const copy = tokens.slice();
    for (let i = 0; i < 3; i++) {
      const j = i + Math.floor(rng() * (copy.length - i));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return { owned: [copy[0], copy[1], copy[2]], borrowed: [] };
  }
  // Sub-3: keep the real ones, borrow the rest from the global pool so the
  // lineup looks varied in battle. Borrowed IDs are tracked separately so the
  // UI can label them ("borrowed for the ghost team").
  const owned = tokens.slice();
  const borrowed = [];
  while (owned.length + borrowed.length < 3) {
    const id = pool[Math.floor(rng() * pool.length)];
    if (tokens.includes(id) || borrowed.includes(id)) continue;
    borrowed.push(id);
  }
  return { owned, borrowed };
}

// ── load snapshot ────────────────────────────────────────────────────────────
console.log(`reading ${SOURCE}`);
const raw = JSON.parse(readFileSync(SOURCE, "utf8"));
const contract = raw.contract;
const tokenOwners = raw.tokenOwners ?? {};

// Invert: wallet -> tokenIds[]
const byOwner = new Map();
for (const [tokenId, owner] of Object.entries(tokenOwners)) {
  const w = owner.toLowerCase();
  if (!byOwner.has(w)) byOwner.set(w, []);
  byOwner.get(w).push(Number(tokenId));
}

// Global pool for borrowing Finis to round out sub-3 rosters
const globalPool = Object.keys(tokenOwners).map(Number);

// ── build teams ──────────────────────────────────────────────────────────────
const teams = [];
const stats = { whales: 0, mid: 0, single: 0, sub3: 0, skipped: 0, borrowed: 0 };
for (const [wallet, tokenIds] of byOwner) {
  if (tokenIds.length === 0) { stats.skipped++; continue; }
  // sort for stable ordering before seeded shuffle
  tokenIds.sort((a, b) => a - b);
  const rng = seededRng(`${salt}:${wallet}`);
  const lineup = pickThree(tokenIds, rng, globalPool);
  if (!lineup) { stats.skipped++; continue; }
  const combined = [...lineup.owned, ...lineup.borrowed];
  if (lineup.borrowed.length > 0) stats.borrowed++;
  teams.push({
    wallet,
    tokenIds: combined,
    ownedTokenIds: lineup.owned,
    borrowedTokenIds: lineup.borrowed,
    ownedCount: tokenIds.length,
  });
  if (tokenIds.length >= 50) stats.whales++;
  else if (tokenIds.length >= 5) stats.mid++;
  else if (tokenIds.length === 1) stats.single++;
  else if (tokenIds.length === 2) stats.sub3++;
}

// Sort by owned count desc so whales appear first (mostly cosmetic for inspection)
teams.sort((a, b) => b.ownedCount - a.ownedCount);

const out = {
  generatedAt: new Date().toISOString(),
  sourceSnapshot: "public/data/ownership.json",
  contract,
  salt,
  totalHolders: byOwner.size,
  teamCount: teams.length,
  stats,
  teams,
};

writeFileSync(OUTPUT, JSON.stringify(out, null, 2));
console.log(`wrote ${OUTPUT}`);
console.log(`  total holders : ${byOwner.size}`);
console.log(`  teams seeded  : ${teams.length}`);
console.log(`  whales (≥50)  : ${stats.whales}`);
console.log(`  mid (5-49)    : ${stats.mid}`);
console.log(`  single-Fini   : ${stats.single}`);
console.log(`  2-Fini        : ${stats.sub3}`);
console.log(`  borrowed-pad  : ${stats.borrowed} (sub-3 teams using global pool)`);
console.log(`  skipped       : ${stats.skipped}`);
console.log(`  salt          : ${salt}`);
console.log(`\nTop 5 whales:`);
for (const t of teams.slice(0, 5)) {
  console.log(`  ${t.wallet}  owns ${t.ownedCount}  lineup [${t.tokenIds.join(", ")}]`);
}
