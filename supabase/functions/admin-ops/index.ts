/**
 * admin-ops — operator console backend.
 *
 * One POST endpoint, dispatched on `action`. Every call is gated by
 * requireAdmin (SIWE JWT wallet ∈ ADMIN_WALLETS env or users.is_admin), runs
 * with the service role, and is appended to admin_actions for audit.
 *
 * Actions:
 *   config.get                                   → economy_config row
 *   config.set    { patch }                      → update tunable levers
 *   bot.setActive { wallet, active }             → pause/resume a house bot
 *   bot.update    { wallet, stake?, maxPerDay?, params? }
 *   bot.retire    { wallet }                     → sweep balance + deactivate
 *   bot.spawn     { handle, strategyType, params?, stake?, maxPerDay?, seed? }
 *   battle.resolve{ battleId, winningSide, reason } → manual settlement
 *   battle.void   { battleId, reason }           → void + refund all stakes
 *   actions.recent{ limit? }                     → recent audit entries
 */
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/auth.ts";
import { requireAdmin } from "../_shared/admin.ts";

// Columns an operator may tune via config.set. Anything else is ignored.
const CONFIG_COLS = new Set([
  "daily_grant", "rescue_amount", "rescue_floor", "new_account_seed",
  "arena_fee_pct", "entry_cutoff_seconds", "bots_paused", "open_beta",
  "fc_daily_cap", "fc_treasury_float", "fc_stake_min", "fc_stake_max",
]);

const STRATEGY_TYPES = new Set([
  "momentum", "contrarian", "loyalist", "late_joiner", "flat_bias",
  "momentum_underlying", "mean_reversion", "late_sniper",
]);

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  let admin: string;
  try {
    admin = await requireAdmin(req);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unauthorized";
    return jsonResponse({ error: msg }, msg.startsWith("forbidden") ? 403 : 401);
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action ?? "");
  const sb = supabaseAdmin();

  // Mutations log to admin_actions; reads don't.
  const log = async (result: unknown) => {
    await sb.from("admin_actions").insert({
      admin_wallet: admin, action, payload: stripAction(body), result: result ?? {},
    });
  };

  try {
    switch (action) {
      case "config.get": {
        const { data } = await sb.from("economy_config").select("*").eq("id", 1).maybeSingle();
        return jsonResponse({ config: data });
      }

      case "config.set": {
        const patch = (body.patch ?? {}) as Record<string, unknown>;
        const clean: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(patch)) {
          if (CONFIG_COLS.has(k)) clean[k] = v;
        }
        if (Object.keys(clean).length === 0) return jsonResponse({ error: "no_valid_fields" }, 400);
        clean.updated_at = new Date().toISOString();
        clean.updated_by = admin;
        const { data, error } = await sb.from("economy_config").update(clean).eq("id", 1).select("*").maybeSingle();
        if (error) throw error;
        await log({ updated: Object.keys(clean) });
        return jsonResponse({ config: data });
      }

      case "bot.setActive": {
        const wallet = lc(body.wallet);
        if (!isWallet(wallet)) return jsonResponse({ error: "bad_wallet" }, 400);
        const active = Boolean(body.active);
        const { error } = await sb.from("house_bots").update({ active }).eq("wallet_address", wallet);
        if (error) throw error;
        await log({ wallet, active });
        return jsonResponse({ ok: true, wallet, active });
      }

      case "bot.update": {
        const wallet = lc(body.wallet);
        if (!isWallet(wallet)) return jsonResponse({ error: "bad_wallet" }, 400);
        const patch: Record<string, unknown> = {};
        if (body.stake != null) patch.stake = clampInt(body.stake, 1, 1_000_000);
        if (body.maxPerDay != null) patch.max_per_day = clampInt(body.maxPerDay, 0, 100_000);
        if (body.params != null && typeof body.params === "object") patch.params = body.params;
        if (Object.keys(patch).length === 0) return jsonResponse({ error: "nothing_to_update" }, 400);
        const { error } = await sb.from("house_bots").update(patch).eq("wallet_address", wallet);
        if (error) throw error;
        await log({ wallet, patch });
        return jsonResponse({ ok: true, wallet, patch });
      }

      case "bot.retire": {
        const wallet = lc(body.wallet);
        if (!isWallet(wallet)) return jsonResponse({ error: "bad_wallet" }, 400);
        const { data, error } = await sb.rpc("sweep_house_bot", { p_bot: wallet });
        if (error) throw error;
        await log({ wallet, swept: data });
        return jsonResponse({ ok: true, wallet, swept: Number(data ?? 0) });
      }

      case "bot.spawn": {
        const handle = String(body.handle ?? "").trim();
        const strategyType = String(body.strategyType ?? "");
        if (!handle) return jsonResponse({ error: "missing_handle" }, 400);
        if (!STRATEGY_TYPES.has(strategyType)) return jsonResponse({ error: "bad_strategy" }, 400);
        const wallet = isWallet(lc(body.wallet)) ? lc(body.wallet) : randomBotWallet();
        const stake = clampInt(body.stake ?? 100, 1, 1_000_000);
        const maxPerDay = clampInt(body.maxPerDay ?? 40, 0, 100_000);
        const seed = clampInt(body.seed ?? 200_000, 0, 100_000_000);
        const params = body.params && typeof body.params === "object" ? body.params : {};
        const { data, error } = await sb.rpc("spawn_house_bot", {
          p_wallet: wallet, p_handle: handle, p_strategy_type: strategyType,
          p_params: params, p_stake: stake, p_max_per_day: maxPerDay, p_seed: seed,
        });
        if (error) throw error;
        await log({ wallet, handle, strategyType, seed, balance: data });
        return jsonResponse({ ok: true, wallet, handle, balance: Number(data ?? 0) });
      }

      case "battle.resolve": {
        const battleId = String(body.battleId ?? "");
        const winningSide = body.winningSide === "A" ? "A" : body.winningSide === "B" ? "B" : null;
        if (!battleId || !winningSide) return jsonResponse({ error: "bad_battle_or_side" }, 400);
        const reason = String(body.reason ?? "operator decision");
        const { endA, endB } = await knownEndPrices(sb, battleId);
        const { data, error } = await sb.rpc("resolve_battle", {
          p_battle_id: battleId, p_winning_side: winningSide,
          p_end_price_a: endA, p_end_price_b: endB,
          p_end_price_source: "manual_admin", p_resolution_formula: "manual_override",
          p_resolution_calc: `Operator ${admin} resolved → ${winningSide}. ${reason}`,
        });
        if (error) throw error;
        await log({ battleId, winningSide, reason, result: data });
        return jsonResponse({ ok: true, battleId, result: data });
      }

      case "battle.void": {
        const battleId = String(body.battleId ?? "");
        if (!battleId) return jsonResponse({ error: "missing_battle" }, 400);
        const reason = String(body.reason ?? "operator void");
        const { endA, endB } = await knownEndPrices(sb, battleId);
        const { data, error } = await sb.rpc("resolve_battle", {
          p_battle_id: battleId, p_winning_side: null,
          p_end_price_a: endA, p_end_price_b: endB,
          p_end_price_source: "manual_admin", p_resolution_formula: "manual_void",
          p_resolution_calc: `Operator ${admin} voided + refunded. ${reason}`,
        });
        if (error) throw error;
        await log({ battleId, reason, result: data });
        return jsonResponse({ ok: true, battleId, result: data });
      }

      case "actions.recent": {
        const limit = clampInt(body.limit ?? 50, 1, 200);
        const { data } = await sb.from("admin_actions")
          .select("*").order("created_at", { ascending: false }).limit(limit);
        return jsonResponse({ actions: data ?? [] });
      }

      default:
        return jsonResponse({ error: "unknown_action" }, 400);
    }
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : "admin_op_failed" }, 400);
  }
});

// ── helpers ──────────────────────────────────────────────────────────────────
function lc(v: unknown): string { return String(v ?? "").toLowerCase(); }
function isWallet(v: string): boolean { return /^0x[a-f0-9]{40}$/.test(v); }
function clampInt(v: unknown, min: number, max: number): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}
function stripAction(body: Record<string, unknown>): Record<string, unknown> {
  const { action: _a, ...rest } = body;
  return rest;
}
function randomBotWallet(): string {
  const bytes = new Uint8Array(19);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  return ("0xb07" + hex).slice(0, 42); // 0x + b07 + random, trimmed to 40 hex chars
}
async function knownEndPrices(
  sb: ReturnType<typeof supabaseAdmin>,
  battleId: string,
): Promise<{ endA: number | null; endB: number | null }> {
  const { data } = await sb.from("battle_instances")
    .select("official_end_price_a,official_end_price_b").eq("id", battleId).maybeSingle();
  return { endA: data?.official_end_price_a ?? null, endB: data?.official_end_price_b ?? null };
}
