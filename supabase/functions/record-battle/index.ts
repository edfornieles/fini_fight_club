/**
 * POST /record-battle { battleId, battleType, teamTokenIds[], outcome, stake, payout }
 *
 * Settle an auto-battler (Fight Club) battle. Server-authoritative:
 *  1. Atomically debit the entry stake (idempotent)
 *  2. Apply per-Fini record changes (wins/losses/draws, XP, rest)
 *  3. Credit the payout (idempotent)
 *  4. Log the battle for audit
 *
 * outcome ∈ 'win' | 'loss' | 'draw'
 * stake   = entry stake paid by caller
 * payout  = stake * 2 for win, stake for draw, 0 for loss
 *
 * In production the resolver runs server-side. For MVP, the client posts the
 * outcome it computed locally; the trust model assumes opponent is the server's
 * deterministic generator (PvE). For PvP this endpoint must instead resolve
 * the matched pair atomically and reject any client-supplied outcome.
 */
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { requireWallet, supabaseAdmin } from "../_shared/auth.ts";

const FINILIAR_CONTRACT = "0x5a0121a0a21232ec0d024dab9017314509026480";
const VALID_OUTCOMES = new Set(["win", "loss", "draw"]);

Deno.serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  let wallet: string;
  try { wallet = await requireWallet(req); } catch (e) { return jsonResponse({ error: String(e) }, 401); }

  const body = await req.json().catch(() => ({})) as {
    battleId?: string; battleType?: string;
    teamTokenIds?: number[]; outcome?: string;
    stake?: number; payout?: number;
    opponentSeed?: number;
  };

  const battleId = body.battleId;
  const teamTokenIds = body.teamTokenIds ?? [];
  const outcome = body.outcome ?? "";
  const stake = Math.round(Number(body.stake ?? 0));
  const payout = Math.round(Number(body.payout ?? 0));
  const battleType = body.battleType ?? "fight-club";

  if (!battleId) return jsonResponse({ error: "missing_battle_id" }, 400);
  if (!VALID_OUTCOMES.has(outcome)) return jsonResponse({ error: "invalid_outcome" }, 400);
  if (teamTokenIds.length !== 3) return jsonResponse({ error: "team_must_be_3" }, 400);
  if (stake < 0 || payout < 0) return jsonResponse({ error: "invalid_amounts" }, 400);
  // Validate payout matches outcome
  const expectedPayout = outcome === "win" ? stake * 2 : outcome === "draw" ? stake : 0;
  if (payout !== expectedPayout) return jsonResponse({ error: "payout_mismatch", expected: expectedPayout }, 400);

  const sb = supabaseAdmin();

  // 1. Debit the stake (idempotent — same battleId always same key)
  if (stake > 0) {
    const { error: debitErr } = await sb.rpc("debit_balance", {
      p_wallet:          wallet,
      p_amount:          stake,
      p_reason:          "battle_entry",
      p_idempotency_key: `battle:${battleId}:entry`,
      p_battle_id:       battleId,
    });
    if (debitErr) {
      if (debitErr.message.includes("insufficient_funds")) return jsonResponse({ error: "insufficient_funds" }, 402);
      return jsonResponse({ error: debitErr.message }, 500);
    }
  }

  // 2. Apply per-Fini stat changes
  const outcomes = teamTokenIds.map(id => ({ token_id: id, outcome }));
  const { error: recordErr } = await sb.rpc("record_battle_outcome", {
    p_contract_address: FINILIAR_CONTRACT,
    p_outcomes:         outcomes,
  });
  if (recordErr) return jsonResponse({ error: "record_failed: " + recordErr.message }, 500);

  // 3. Credit the payout
  let newBalance: number | undefined;
  if (payout > 0) {
    const { data: credit, error: creditErr } = await sb.rpc("credit_balance", {
      p_wallet:          wallet,
      p_amount:          payout,
      p_reason:          outcome === "draw" ? "battle_refund" : "battle_payout",
      p_idempotency_key: `battle:${battleId}:payout`,
      p_battle_id:       battleId,
    });
    if (creditErr) return jsonResponse({ error: "payout_failed: " + creditErr.message }, 500);
    newBalance = credit?.[0]?.new_balance;
  } else {
    const { data: bal } = await sb.from("fini_balances").select("balance").eq("wallet_address", wallet).maybeSingle();
    newBalance = bal?.balance;
  }

  // 4. Audit log
  await sb.from("battles_log").insert({
    battle_id:       battleId,
    battle_type:     battleType,
    team_wallet:     wallet,
    team_token_ids:  teamTokenIds,
    outcome,
    stake,
    payout,
    metadata:        { opponentSeed: body.opponentSeed },
  });

  return jsonResponse({ success: true, outcome, payout, newBalance });
});
