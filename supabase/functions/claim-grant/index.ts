/**
 * POST /claim-grant { kind: "daily" | "rescue" }
 *
 * Authenticated self-service credit for the two player top-up flows that keep
 * people from getting stuck:
 *   - daily  : the once-a-day drop (24h cooldown)
 *   - rescue : an emergency top-up, only when balance is under the floor
 *
 * Why this exists (and why the client does NOT call credit-balance directly):
 * credit-balance is gated by INTERNAL_API_KEY and grants any amount for any
 * reason — exposing it to the browser would let anyone mint unlimited CUTE$.
 * This endpoint is gated by the player's SIWE session instead, derives the
 * wallet from the verified token, and enforces the cooldown / floor on the
 * server so the client can't bypass them. Amounts + floor come from
 * economy_config so operators can tune them from the console.
 *
 * Credits go through the same credit_balance RPC as every other mutation. The
 * daily drop books reason 'daily_grant'; the rescue books 'rescue_grant', so the
 * two are independently auditable and the daily cooldown can filter on reason
 * alone.
 */
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { requireWallet, supabaseAdmin } from "../_shared/auth.ts";

const DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1000;

Deno.serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  let wallet: string;
  try { wallet = await requireWallet(req); } catch (e) { return jsonResponse({ error: String(e) }, 401); }

  const body = await req.json().catch(() => ({})) as { kind?: string };
  const kind = body.kind === "rescue" ? "rescue" : "daily";

  const sb = supabaseAdmin();

  // Tunable levers (operator console writes these). Fall back to the historical
  // hardcoded values if the singleton row is missing.
  const { data: cfg } = await sb.from("economy_config")
    .select("daily_grant, rescue_amount, rescue_floor").eq("id", 1).maybeSingle();
  const dailyGrant   = Number(cfg?.daily_grant   ?? 500);
  const rescueAmount = Number(cfg?.rescue_amount ?? 500);
  const rescueFloor  = Number(cfg?.rescue_floor  ?? 100);

  if (kind === "daily") {
    // Cooldown is enforced here, not on the client. Reject if a daily drop was
    // credited within the window. Rescue books a distinct reason, so it can't
    // block the daily drop and vice versa.
    const since = new Date(Date.now() - DAILY_COOLDOWN_MS).toISOString();
    const { data: recent } = await sb.from("fini_coin_ledger")
      .select("created_at")
      .eq("wallet_address", wallet)
      .eq("reason", "daily_grant")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recent) {
      const nextAt = new Date(recent.created_at).getTime() + DAILY_COOLDOWN_MS;
      return jsonResponse({ error: "cooldown", cooldownMs: Math.max(0, nextAt - Date.now()) }, 429);
    }

    // Idempotency keyed to the 24h bucket so a double-click within one window is
    // a no-op rather than a second grant.
    const idem = `daily:${wallet}:${Math.floor(Date.now() / DAILY_COOLDOWN_MS)}`;
    const { data, error } = await sb.rpc("credit_balance", {
      p_wallet:          wallet,
      p_amount:          dailyGrant,
      p_reason:          "daily_grant",
      p_idempotency_key: idem,
      p_metadata:        { kind: "daily" },
    });
    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse({
      success: true, kind: "daily", amount: dailyGrant,
      newBalance: Number(data?.[0]?.new_balance ?? 0), cooldownMs: DAILY_COOLDOWN_MS,
    });
  }

  // rescue: only available under the floor — checked against the server balance.
  const { data: bal } = await sb.from("fini_balances")
    .select("balance").eq("wallet_address", wallet).maybeSingle();
  const balance = Number(bal?.balance ?? 0);
  if (balance >= rescueFloor) {
    return jsonResponse({ error: "above_floor", balance, rescueFloor }, 409);
  }

  // Bucket by the minute: coalesces rapid double-clicks, but allows another
  // rescue later once the player drops under the floor again.
  const idem = `rescue:${wallet}:${Math.floor(Date.now() / 60_000)}`;
  const { data, error } = await sb.rpc("credit_balance", {
    p_wallet:          wallet,
    p_amount:          rescueAmount,
    p_reason:          "rescue_grant",
    p_idempotency_key: idem,
    p_metadata:        { kind: "rescue" },
  });
  if (error) return jsonResponse({ error: error.message }, 500);
  return jsonResponse({
    success: true, kind: "rescue", amount: rescueAmount,
    newBalance: Number(data?.[0]?.new_balance ?? 0),
  });
});
