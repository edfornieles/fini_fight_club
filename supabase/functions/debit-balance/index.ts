/**
 * POST /debit-balance { amount, reason, idempotencyKey, battleId?, tradeId?, metadata? }
 *
 * Atomically debits the caller's wallet. Use this for: battle entry stakes,
 * prediction stakes, shop purchases, potion buys.
 *
 * Reason must be one of the ledger_reason enum values:
 *   battle_entry, prediction_stake, shop_purchase
 */
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { requireWallet, supabaseAdmin } from "../_shared/auth.ts";

const ALLOWED_REASONS = new Set([
  "battle_entry", "prediction_stake", "shop_purchase", "item_use",
]);

Deno.serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  let wallet: string;
  try { wallet = await requireWallet(req); } catch (e) { return jsonResponse({ error: String(e) }, 401); }

  const body = await req.json().catch(() => ({})) as {
    amount?: number; reason?: string; idempotencyKey?: string;
    battleId?: string; tradeId?: string; metadata?: Record<string, unknown>;
  };
  const amount = Number(body.amount);
  const reason = body.reason ?? "";
  if (!Number.isFinite(amount) || amount <= 0) return jsonResponse({ error: "invalid_amount" }, 400);
  if (!ALLOWED_REASONS.has(reason)) return jsonResponse({ error: "invalid_reason" }, 400);
  if (!body.idempotencyKey) return jsonResponse({ error: "missing_idempotency_key" }, 400);

  const sb = supabaseAdmin();
  const { data, error } = await sb.rpc("debit_balance", {
    p_wallet:          wallet,
    p_amount:          Math.round(amount),
    p_reason:          reason,
    p_idempotency_key: body.idempotencyKey,
    p_battle_id:       body.battleId ?? null,
    p_trade_id:        body.tradeId ?? null,
    p_metadata:        body.metadata ?? {},
  });
  if (error) {
    if (error.message.includes("insufficient_funds")) return jsonResponse({ error: "insufficient_funds" }, 402);
    return jsonResponse({ error: error.message }, 500);
  }

  return jsonResponse({ success: true, newBalance: data?.[0]?.new_balance, ledgerId: data?.[0]?.ledger_id });
});
