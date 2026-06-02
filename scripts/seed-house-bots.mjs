#!/usr/bin/env node
/**
 * Seed ~20 house bot accounts: rational automated players that keep the arena
 * active during beta. Each gets a synthetic wallet, a strategy assignment, and
 * a starting FINI$ balance (via the credit_balance RPC so the ledger is right).
 *
 *   export SUPABASE_URL=…  SUPABASE_SERVICE_ROLE_KEY=…
 *   node scripts/seed-house-bots.mjs
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }
const sb = createClient(url, key, { auth: { persistSession: false } });

const STARTING_BALANCE = 50_000;

// 20 bots across the strategy palette. Synthetic but valid-looking wallets
// (0x + 40 hex), prefixed b07… so they're recognisable as bots in queries.
function botWallet(i) {
  // 0x + "b07" (3 hex) + 37 hex of zero-padded index = 40 hex chars total.
  // Index lives at the tail and is never truncated → unique per bot.
  return "0xb07" + (i + 1).toString(16).padStart(37, "0");
}

const BOTS = [
  { handle: "house_oracle",    strategy_type: "momentum_underlying", params: { velocityThreshold: 0.004, minEdgePp: 6 } },
  { handle: "house_contra",    strategy_type: "contrarian",          params: { pctThreshold: 38 } },
  { handle: "house_sniper",    strategy_type: "late_sniper",         params: {} },
  { handle: "house_revert",    strategy_type: "mean_reversion",      params: { velocityThreshold: 0.018 } },
  { handle: "house_momentum",  strategy_type: "momentum",            params: {} },
  { handle: "btc_maxi",        strategy_type: "loyalist",            params: { sideFilter: "A", assetFilter: ["BTC"] } },
  { handle: "eth_believer",    strategy_type: "momentum_underlying", params: { velocityThreshold: 0.005, assetFilter: ["ETH"] } },
  { handle: "sol_chaser",      strategy_type: "momentum",            params: { assetFilter: ["SOL"] } },
  { handle: "doge_degen",      strategy_type: "flat_bias",           params: { sideFilter: "A", assetFilter: ["DOGE"] } },
  { handle: "steady_eddie",    strategy_type: "late_joiner",         params: {} },
  { handle: "edge_hunter",     strategy_type: "momentum_underlying", params: { velocityThreshold: 0.003, minEdgePp: 9 } },
  { handle: "fade_the_herd",   strategy_type: "contrarian",          params: { pctThreshold: 35 } },
  { handle: "quiet_quant",     strategy_type: "mean_reversion",      params: { velocityThreshold: 0.022 } },
  { handle: "trend_rider",     strategy_type: "momentum",            params: {} },
  { handle: "last_second",     strategy_type: "late_sniper",         params: {} },
  { handle: "link_loyal",      strategy_type: "loyalist",            params: { sideFilter: "A", assetFilter: ["LINK"] } },
  { handle: "avax_arb",        strategy_type: "momentum_underlying", params: { velocityThreshold: 0.004, assetFilter: ["AVAX"] } },
  { handle: "balanced_bob",    strategy_type: "flat_bias",           params: { sideFilter: "A" } },
  { handle: "swing_sally",     strategy_type: "late_sniper",         params: {} },
  { handle: "deep_value",      strategy_type: "contrarian",          params: { pctThreshold: 40, minEdgePp: 5 } },
];

let seeded = 0;
for (let i = 0; i < BOTS.length; i++) {
  const b = BOTS[i];
  const wallet = botWallet(i);
  // Upsert the bot registry row
  const { error: regErr } = await sb.from("house_bots").upsert({
    wallet_address: wallet,
    handle: b.handle,
    strategy_type: b.strategy_type,
    params: b.params,
    stake: 100,
    max_per_day: 40,
    active: true,
  }, { onConflict: "wallet_address" });
  if (regErr) { console.error(`✗ ${b.handle}: ${regErr.message}`); continue; }

  // Give it a starting balance via the ledger RPC (idempotent per bot seed)
  const { error: credErr } = await sb.rpc("credit_balance", {
    p_wallet: wallet,
    p_amount: STARTING_BALANCE,
    p_reason: "admin_grant",
    p_idempotency_key: `house-bot-seed:${wallet}`,
  });
  if (credErr) { console.error(`✗ ${b.handle} balance: ${credErr.message}`); continue; }

  seeded++;
  console.log(`✓ ${b.handle.padEnd(16)} ${b.strategy_type.padEnd(20)} ${wallet}`);
}
console.log(`\nSeeded ${seeded}/${BOTS.length} house bots, ${STARTING_BALANCE.toLocaleString()} FINI$ each.`);
