#!/usr/bin/env node
/**
 * Keyless Finiliar ownership indexer.
 *
 * Scans `ownerOf(tokenId)` for the whole collection via free public Ethereum
 * RPCs (no API key) and writes a `tokenId -> owner` map to disk. Because the
 * Finiliar contract is NOT ERC721Enumerable, this on-chain scan is how we build
 * the per-wallet roster + a real ownership snapshot.
 *
 * Usage:
 *   node scripts/index-ownership.mjs                 # full 0..9999 -> data + public copy
 *   START=0 COUNT=200 OUT=data/ownership.sample.json node scripts/index-ownership.mjs
 *
 * Env:
 *   START  first tokenId (default 0)
 *   COUNT  number of tokens (default 10000)
 *   BATCH  tokens per JSON-RPC batch (default 120)
 *   OUT    output path (default data/ownership.json)
 *   PUBLIC also copy to this path so Vite serves it (default public/data/ownership.json;
 *          set PUBLIC="" to skip)
 *
 * No dependencies — uses Node 18+ global fetch.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const CONTRACT = "0x5a0121a0a21232ec0d024dab9017314509026480";
const CHAIN_ID = 1;
const TOTAL_SUPPLY = 10000; // token ids 0..9999

// Free public RPCs (no API key). Rotated on failure.
const RPCS = [
  "https://ethereum-rpc.publicnode.com",
  "https://eth.drpc.org",
  "https://1rpc.io/eth",
  "https://eth.merkle.io",
];

const OWNER_OF_SELECTOR = "0x6352211e";

const START = Number(process.env.START ?? 0);
const COUNT = Number(process.env.COUNT ?? TOTAL_SUPPLY);
const BATCH = Number(process.env.BATCH ?? 120);
const OUT = process.env.OUT ?? "data/ownership.json";
const PUBLIC = process.env.PUBLIC ?? "public/data/ownership.json";

let rpcIndex = 0;
function nextRpc() {
  rpcIndex = (rpcIndex + 1) % RPCS.length;
  return RPCS[rpcIndex];
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function tokenIdToData(tokenId) {
  return OWNER_OF_SELECTOR + tokenId.toString(16).padStart(64, "0");
}

/** Decode a 32-byte ABI word holding an address into 0x… (lowercased). */
function decodeAddress(hex) {
  if (typeof hex !== "string" || hex.length < 66) return null;
  const body = hex.slice(2);
  const addr = body.slice(24); // last 20 bytes
  return "0x" + addr.toLowerCase();
}

/** Send one JSON-RPC batch (array). Returns array of {id, result|error}. */
async function sendBatch(rpc, batch, signal) {
  const res = await fetch(rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(batch),
    signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (!Array.isArray(json)) throw new Error("non-array response");
  return json;
}

/** Fetch owners for a contiguous range of tokenIds with retry + RPC failover. */
async function fetchOwners(ids) {
  const batch = ids.map((id) => ({
    jsonrpc: "2.0",
    id,
    method: "eth_call",
    params: [{ to: CONTRACT, data: tokenIdToData(id) }, "latest"],
  }));

  let attempt = 0;
  const maxAttempts = RPCS.length * 3;
  while (attempt < maxAttempts) {
    const rpc = RPCS[rpcIndex];
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 20000);
      const out = await sendBatch(rpc, batch, ctrl.signal);
      clearTimeout(t);
      const owners = {};
      for (const entry of out) {
        if (entry.error) continue; // nonexistent/burned token — skip
        const addr = decodeAddress(entry.result);
        if (addr && addr !== "0x0000000000000000000000000000000000000000") {
          owners[entry.id] = addr;
        }
      }
      return owners;
    } catch (err) {
      attempt++;
      const wait = Math.min(8000, 500 * 2 ** (attempt % 5));
      console.warn(
        `  ⚠️  batch ${ids[0]}..${ids[ids.length - 1]} on ${rpc} failed (${err.message}); rotating, retry ${attempt}/${maxAttempts} in ${wait}ms`,
      );
      nextRpc();
      await sleep(wait);
    }
  }
  throw new Error(`batch ${ids[0]}..${ids[ids.length - 1]} exhausted all RPCs`);
}

async function main() {
  const end = START + COUNT; // exclusive
  console.log(
    `Finiliar ownership indexer\n  contract ${CONTRACT}\n  range ${START}..${end - 1} (${COUNT} tokens)\n  batch ${BATCH} · out ${OUT}\n`,
  );

  const tokenOwners = {}; // tokenId -> owner
  const t0 = Date.now();
  let done = 0;

  for (let from = START; from < end; from += BATCH) {
    const ids = [];
    for (let id = from; id < Math.min(from + BATCH, end); id++) ids.push(id);
    const owners = await fetchOwners(ids);
    Object.assign(tokenOwners, owners);
    done += ids.length;
    const pct = ((done / COUNT) * 100).toFixed(1);
    const rate = (done / ((Date.now() - t0) / 1000)).toFixed(0);
    process.stdout.write(
      `\r  scanned ${done}/${COUNT} (${pct}%) · ${Object.keys(tokenOwners).length} held · ${rate} tok/s   `,
    );
    await sleep(120); // be polite to public RPCs
  }
  process.stdout.write("\n");

  // Build reverse map: owner -> [tokenIds]
  const byOwner = {};
  for (const [tokenId, owner] of Object.entries(tokenOwners)) {
    (byOwner[owner] ??= []).push(Number(tokenId));
  }
  for (const list of Object.values(byOwner)) list.sort((a, b) => a - b);

  const ownerCount = Object.keys(byOwner).length;
  const heldCount = Object.keys(tokenOwners).length;

  const payload = {
    contract: CONTRACT,
    chainId: CHAIN_ID,
    fetchedAt: new Date().toISOString(),
    range: { start: START, count: COUNT },
    heldCount,
    ownerCount,
    tokenOwners,
    byOwner,
  };

  const serialized = JSON.stringify(payload, null, 0);
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, serialized);

  // Also publish a copy Vite can serve (so the app can fetch it at runtime).
  if (PUBLIC) {
    await mkdir(dirname(PUBLIC), { recursive: true });
    await writeFile(PUBLIC, serialized);
  }

  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(
    `\n✅ done in ${secs}s\n  ${heldCount} tokens held by ${ownerCount} owners\n  wrote ${OUT}${PUBLIC ? ` (+ ${PUBLIC})` : ""}`,
  );
}

main().catch((err) => {
  console.error("\n❌ indexer failed:", err);
  process.exit(1);
});
