/**
 * POST /predict-place { battleId, side, stake, lockedPct, idempotencyKey }
 *
 * Records a Crypto Arena prediction.
 *  1. Validate battle is still open (status='open', now < entry_cutoff)
 *  2. Atomically debit stake (idempotent)
 *  3. Insert predictions row
 *  4. Bump battle_instances.total_volume
 *
 * side ∈ 'A' | 'B'
 */
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { requireWallet, supabaseAdmin } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  let wallet: string;
  try { wallet = await requireWallet(req); } catch (e) { return jsonResponse({ error: String(e) }, 401); }

  const body = await req.json().catch(() => ({})) as {
    battleId?: string; side?: "A" | "B"; stake?: number;
    lockedPct?: number; idempotencyKey?: string;
  };

  const { battleId, side, idempotencyKey } = body;
  const stake = Math.round(Number(body.stake ?? 0));

  if (!battleId)         return jsonResponse({ error: "missing_battle_id" }, 400);
  if (side !== "A" && side !== "B") return jsonResponse({ error: "invalid_side" }, 400);
  if (!Number.isFinite(stake) || stake <= 0) return jsonResponse({ error: "invalid_stake" }, 400);
  if (!idempotencyKey)   return jsonResponse({ error: "missing_idempotency_key" }, 400);

  const sb = supabaseAdmin();

  // 0. Light per-wallet velocity cap — block spam/abuse (house bots insert
  //    directly and bypass this). 30 predictions / 60s is far above human play.
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count: recentCount } = await sb.from("predictions")
    .select("id", { count: "exact", head: true })
    .eq("wallet_address", wallet)
    .gte("created_at", since);
  if ((recentCount ?? 0) >= 30) return jsonResponse({ error: "rate_limited" }, 429);

  // 1. Battle must be open + not past cutoff
  const { data: battle, error: bErr } = await sb.from("battle_instances")
    .select("id, status, entry_cutoff").eq("id", battleId).maybeSingle();
  if (bErr || !battle) return jsonResponse({ error: "battle_not_found" }, 404);
  if (battle.status !== "open") return jsonResponse({ error: "battle_closed" }, 409);
  if (new Date(battle.entry_cutoff).getTime() < Date.now()) {
    return jsonResponse({ error: "past_entry_cutoff" }, 409);
  }

  // 1b. Lock the odds SERVER-SIDE from the live pool. Fixed-odds settlement
  //     pays stake × 100/locked_pct, so this value is money — the client's
  //     copy is ignored (a forged lockedPct:1 would otherwise pay 100×).
  //     Same 5..95 band the arena displays; empty pool opens at 50/50.
  const { data: poolRows } = await sb.from("predictions")
    .select("side, stake").eq("battle_id", battleId).eq("status", "open");
  let poolA = 0, poolB = 0;
  for (const p of poolRows ?? []) {
    if (p.side === "A") poolA += Number(p.stake) || 0; else poolB += Number(p.stake) || 0;
  }
  const poolTotal = poolA + poolB;
  const sidePool = side === "A" ? poolA : poolB;
  const lockedPct = poolTotal > 0
    ? Math.min(95, Math.max(5, Math.round((sidePool / poolTotal) * 100)))
    : 50;

  // 2. Debit stake atomically
  const { error: dErr } = await sb.rpc("debit_balance", {
    p_wallet:          wallet,
    p_amount:          stake,
    p_reason:          "prediction_stake",
    p_idempotency_key: idempotencyKey,
    p_battle_id:       battleId,
    p_metadata:        { side, lockedPct },
  });
  if (dErr) {
    if (dErr.message.includes("insufficient_funds")) return jsonResponse({ error: "insufficient_funds" }, 402);
    return jsonResponse({ error: dErr.message }, 500);
  }

  // 3. Insert predictions row (unique by idempotency_key prevents double-insert on retry)
  const { error: pErr } = await sb.from("predictions").insert({
    battle_id:        battleId,
    wallet_address:   wallet,
    side,
    stake,
    locked_pct:       lockedPct,
    status:           "open",
    idempotency_key:  idempotencyKey,
  });
  // If duplicate, the debit was a no-op (idempotent) — treat as success
  if (pErr && !pErr.message.toLowerCase().includes("duplicate")) {
    return jsonResponse({ error: pErr.message }, 500);
  }

  // 4. Bump battle volume atomically
  await sb.rpc("bump_battle_volume", { p_battle_id: battleId, p_amount: stake });

  // Echo the server-locked odds so the client can display the true figure.
  return jsonResponse({ success: true, battleId, side, stake, lockedPct });
});
