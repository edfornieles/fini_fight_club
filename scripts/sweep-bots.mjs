#!/usr/bin/env node
/**
 * Sweep house-bot balances back into the project wallet and deactivate them.
 * Run this at launch (or whenever) to retire the beta critical-mass bots —
 * their FINI$ returns to the project wallet, restoring the 80% allocation.
 *
 *   export SUPABASE_URL=…  SUPABASE_SERVICE_ROLE_KEY=…
 *   node scripts/sweep-bots.mjs            # sweep ALL active bots
 *   node scripts/sweep-bots.mjs 0xb07…01   # sweep one bot by wallet
 *
 * Uses the sweep_house_bot(wallet) RPC (security definer), which zeroes the
 * bot's balance into project_wallet.swept_total and sets active = false.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }
const sb = createClient(url, key, { auth: { persistSession: false } });

const only = process.argv[2]; // optional single wallet

let bots;
if (only) {
  bots = [{ wallet_address: only, handle: only }];
} else {
  const { data, error } = await sb.from("house_bots").select("wallet_address, handle").eq("active", true);
  if (error) { console.error(error.message); process.exit(1); }
  bots = data ?? [];
}

if (bots.length === 0) { console.log("No active bots to sweep."); process.exit(0); }

let total = 0;
for (const b of bots) {
  const { data, error } = await sb.rpc("sweep_house_bot", { p_bot: b.wallet_address });
  if (error) { console.error(`✗ ${b.handle}: ${error.message}`); continue; }
  const amt = Number(data) || 0;
  total += amt;
  console.log(`✓ swept ${b.handle.padEnd(16)} ${amt.toLocaleString().padStart(10)} FINI$`);
}

// Report project wallet new total
const { data: pw } = await sb.from("project_wallet").select("swept_total").eq("id", 1).maybeSingle();
console.log(`\nSwept ${total.toLocaleString()} FINI$ from ${bots.length} bot(s).`);
console.log(`Project wallet swept_total now: ${(pw?.swept_total ?? 0).toLocaleString()} FINI$`);
