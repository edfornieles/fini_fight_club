/**
 * POST /resolve-battle { battleId }
 *
 * Server-authoritative settlement for a Crypto Arena battle.
 *
 *  1. Verify the battle is past end_time and not already resolved
 *  2. Fetch verified end price (CoinGecko + Coinbase + Binance, median)
 *  3. If <2 sources or spread > template.max_deviation_bps → mark manual_review (no payout)
 *  4. Compute winning side per the template's formula
 *  5. Call resolve_battle RPC to settle all predictions atomically
 *
 * Auth: INTERNAL_API_KEY header (cron-only).
 */
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/auth.ts";
import { fetchPriceSnapshot, type Symbol } from "../_shared/prices.ts";

Deno.serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const internalKey = req.headers.get("x-internal-key");
  if (internalKey !== Deno.env.get("INTERNAL_API_KEY")) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  const { battleId } = await req.json().catch(() => ({})) as { battleId?: string };
  if (!battleId) return jsonResponse({ error: "missing_battle_id" }, 400);

  const sb = supabaseAdmin();
  const { data: battle, error } = await sb.from("battle_instances")
    .select("*, battle_templates(battle_type, max_deviation_bps, threshold)")
    .eq("id", battleId).maybeSingle();
  if (error || !battle) return jsonResponse({ error: "battle_not_found" }, 404);
  if (battle.resolution_status === "resolved") return jsonResponse({ already_resolved: true });
  if (new Date(battle.end_time).getTime() > Date.now()) {
    return jsonResponse({ error: "too_early", endsAt: battle.end_time }, 400);
  }

  const tpl = battle.battle_templates as { battle_type: string; max_deviation_bps?: number; threshold?: number };
  const maxDev = tpl.max_deviation_bps ?? 50;

  // Fetch end prices with multi-source verification
  const snapA = await fetchPriceSnapshot(battle.asset_a as Symbol, maxDev);
  const snapB = battle.asset_b ? await fetchPriceSnapshot(battle.asset_b as Symbol, maxDev) : null;

  const auditNote = {
    asset_a: { samples: snapA.samples, spreadBps: snapA.spreadBps, trustworthy: snapA.trustworthy },
    ...(snapB ? { asset_b: { samples: snapB.samples, spreadBps: snapB.spreadBps, trustworthy: snapB.trustworthy } } : {}),
  };

  if (!snapA.trustworthy || (snapB && !snapB.trustworthy)) {
    // Cannot fairly resolve — mark for admin review, do NOT pay out.
    await sb.from("battle_instances").update({
      resolution_status: "manual_review",
      void_reason: "end_price_untrusted",
      backup_checks: { ...battle.backup_checks, end: auditNote },
      end_price_recorded_at: new Date().toISOString(),
    }).eq("id", battleId);
    return jsonResponse({ manual_review: true, reason: "end_price_untrusted", audit: auditNote });
  }

  // Compute winning side per battle type
  const battleType = tpl.battle_type;
  let winningSide: "A" | "B" | null = null;
  let formula = "";
  let calc = "";

  if (battleType === "updown") {
    const startPrice = Number(battle.official_start_price_a);
    formula = "endPrice > startPrice → Up (A) wins";
    const endPrice = snapA.median;
    calc = `end ${endPrice} ${endPrice > startPrice ? ">" : "≤"} start ${startPrice}`;
    winningSide = endPrice > startPrice ? "A" : "B";
  } else if (battleType === "outperform" && snapB) {
    const startA = Number(battle.official_start_price_a);
    const startB = Number(battle.official_start_price_b);
    const retA = (snapA.median - startA) / startA;
    const retB = (snapB.median - startB) / startB;
    formula = "Higher % change wins";
    calc = `A: ${(retA * 100).toFixed(3)}% vs B: ${(retB * 100).toFixed(3)}%`;
    if (Math.abs(retA - retB) < 0.0001) winningSide = null; // tie → void
    else winningSide = retA > retB ? "A" : "B";
  } else if (battleType === "abovebelow") {
    const threshold = tpl.threshold ?? 0;
    formula = `endPrice ≥ ${threshold} → Yes (A) wins`;
    calc = `${snapA.median} ${snapA.median >= threshold ? "≥" : "<"} ${threshold}`;
    winningSide = snapA.median >= threshold ? "A" : "B";
  } else if (battleType === "volatility") {
    const threshold = tpl.threshold ?? 0.02; // default 2%
    const startA = Number(battle.official_start_price_a);
    const move = Math.abs(snapA.median - startA) / startA;
    formula = `abs(% change) ≥ ${threshold * 100}% → Storm (A) wins`;
    calc = `move ${(move * 100).toFixed(3)}% ${move >= threshold ? "≥" : "<"} threshold ${(threshold * 100).toFixed(2)}%`;
    winningSide = move >= threshold ? "A" : "B";
  }

  const { data: res, error: resErr } = await sb.rpc("resolve_battle", {
    p_battle_id: battleId,
    p_winning_side: winningSide,
    p_end_price_a: snapA.median,
    p_end_price_b: snapB?.median ?? null,
    p_end_price_source: snapA.samples.map(s => s.source).join(","),
    p_resolution_formula: formula,
    p_resolution_calc: calc,
  });
  if (resErr) return jsonResponse({ error: resErr.message }, 500);

  // Write the end audit trail to the battle row
  await sb.from("battle_instances").update({
    backup_checks: { ...battle.backup_checks, end: auditNote },
  }).eq("id", battleId);

  return jsonResponse({ success: true, ...res, audit: auditNote });
});
