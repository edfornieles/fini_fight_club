/**
 * POST /credit-balance { amount, reason, idempotencyKey, battleId?, tradeId?, metadata? }
 *
 * Internal-only credit operation. Should not be exposed to user clients directly
 * for arbitrary reasons — but the daily-grant and PvE-payout flows need a callable
 * entry. For now we gate by an INTERNAL_API_KEY header; in production the cleanest
 * pattern is a server-side cron / webhook.
 *
 * Reason must be one of:
 *   daily_grant, battle_payout, battle_refund, prediction_payout, prediction_refund
 */
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/auth.ts";

const ALLOWED_REASONS = new Set([
  "daily_grant", "battle_payout", "battle_refund",
  "prediction_payout", "prediction_refund", "admin_grant",
]);

Deno.serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  // Internal API key — required for credit operations
  const internalKey = req.headers.get("x-internal-key");
  if (internalKey !== Deno.env.get("INTERNAL_API_KEY")) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  const body = await req.json().catch(() => ({})) as {
    wallet?: string; amount?: number; reason?: string; idempotencyKey?: string;
    battleId?: string; tradeId?: string; metadata?: Record<string, unknown>;
  };
  const wallet = (body.wallet ?? "").toLowerCase();
  const amount = Number(body.amount);
  const reason = body.reason ?? "";
  if (!/^0x[a-f0-9]{40}$/.test(wallet)) return jsonResponse({ error: "invalid_wallet" }, 400);
  if (!Number.isFinite(amount) || amount <= 0) return jsonResponse({ error: "invalid_amount" }, 400);
  if (!ALLOWED_REASONS.has(reason)) return jsonResponse({ error: "invalid_reason" }, 400);
  if (!body.idempotencyKey) return jsonResponse({ error: "missing_idempotency_key" }, 400);

  const sb = supabaseAdmin();
  const { data, error } = await sb.rpc("credit_balance", {
    p_wallet:          wallet,
    p_amount:          Math.round(amount),
    p_reason:          reason,
    p_idempotency_key: body.idempotencyKey,
    p_battle_id:       body.battleId ?? null,
    p_trade_id:        body.tradeId ?? null,
    p_metadata:        body.metadata ?? {},
  });
  if (error) return jsonResponse({ error: error.message }, 500);

  return jsonResponse({ success: true, newBalance: data?.[0]?.new_balance, ledgerId: data?.[0]?.ledger_id });
});
