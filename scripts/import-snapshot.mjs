#!/usr/bin/env node
/**
 * One-off: load the existing public/data/ownership.json into the
 * `holder_snapshots` table for a claim campaign.
 *
 * Usage:
 *   npm install                            # already installed
 *   export SUPABASE_URL=https://...
 *   export SUPABASE_SERVICE_ROLE_KEY=...   # service role (server-only key)
 *   node scripts/import-snapshot.mjs [campaignId] [snapshotPath]
 *
 * Defaults:
 *   campaignId   = '00000000-0000-0000-0000-000000000001'  (the Genesis claim seeded in 0003_claims.sql)
 *   snapshotPath = 'public/data/ownership.json'
 *
 * The ownership.json format we accept is:
 *   { "tokenOwners": { "0": "0xabc…", "1": "0xdef…", … } }
 *   OR
 *   { "byOwner": { "0xabc…": [0, 1, …], "0xdef…": [42, …] } }
 *
 * We dedupe and upsert in batches.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const CONTRACT = "0x5a0121a0a21232ec0d024dab9017314509026480";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
  process.exit(1);
}

const campaignId = process.argv[2] ?? "00000000-0000-0000-0000-000000000001";
const snapshotPath = process.argv[3] ?? "public/data/ownership.json";

const raw = readFileSync(resolve(process.cwd(), snapshotPath), "utf-8");
const data = JSON.parse(raw);

// Normalize to { wallet, tokenId } rows
const rows = [];
if (data.tokenOwners && typeof data.tokenOwners === "object") {
  for (const [tokenIdStr, owner] of Object.entries(data.tokenOwners)) {
    const wallet = String(owner).toLowerCase();
    const tokenId = parseInt(tokenIdStr, 10);
    if (!/^0x[a-f0-9]{40}$/.test(wallet)) continue;
    if (!Number.isFinite(tokenId)) continue;
    rows.push({ wallet_address: wallet, token_id: tokenId });
  }
} else if (data.byOwner && typeof data.byOwner === "object") {
  for (const [owner, tokenIds] of Object.entries(data.byOwner)) {
    const wallet = String(owner).toLowerCase();
    if (!/^0x[a-f0-9]{40}$/.test(wallet)) continue;
    for (const tid of tokenIds) {
      const tokenId = parseInt(String(tid), 10);
      if (Number.isFinite(tokenId)) rows.push({ wallet_address: wallet, token_id: tokenId });
    }
  }
} else {
  console.error("Could not find tokenOwners or byOwner in snapshot file");
  process.exit(2);
}

console.log(`Parsed ${rows.length} (wallet, tokenId) rows from ${snapshotPath}`);

const sb = createClient(url, key, { auth: { persistSession: false } });

// Confirm campaign exists
const { data: campaign, error: campErr } = await sb
  .from("claim_campaigns").select("id, name").eq("id", campaignId).maybeSingle();
if (campErr || !campaign) {
  console.error(`Campaign ${campaignId} not found. Run migration 0003_claims.sql first.`);
  process.exit(3);
}
console.log(`Importing into campaign: ${campaign.name} (${campaign.id})`);

// Wipe existing snapshot rows for this campaign so reruns are idempotent
const { error: delErr } = await sb.from("holder_snapshots").delete().eq("campaign_id", campaignId);
if (delErr) {
  console.error("Failed to clear existing snapshot rows:", delErr.message);
  process.exit(4);
}

// Batch-insert in chunks of 1000
const CHUNK = 1000;
let inserted = 0;
for (let i = 0; i < rows.length; i += CHUNK) {
  const slice = rows.slice(i, i + CHUNK).map(r => ({
    campaign_id: campaignId,
    wallet_address: r.wallet_address,
    token_id: r.token_id,
    contract_address: CONTRACT,
  }));
  const { error } = await sb.from("holder_snapshots").insert(slice);
  if (error) {
    console.error(`Insert failed at offset ${i}:`, error.message);
    process.exit(5);
  }
  inserted += slice.length;
  if (i % 5000 === 0) console.log(`  inserted ${inserted}/${rows.length}…`);
}

console.log(`✓ Imported ${inserted} holder rows into campaign ${campaignId}`);
