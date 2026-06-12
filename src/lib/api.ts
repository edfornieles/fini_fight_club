/**
 * Typed fetch client for our Supabase edge functions.
 * All POST endpoints require a Supabase session JWT in Authorization.
 */
import { supabase, isOnline } from "./supabase";

const FN_URL = (import.meta.env.VITE_SUPABASE_FUNCTIONS_URL as string)
  ?? (import.meta.env.VITE_SUPABASE_URL ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1` : "");

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const tok = data.session?.access_token;
  return tok ? { Authorization: `Bearer ${tok}` } : {};
}

async function call<T>(path: string, opts: { method?: "GET" | "POST"; body?: unknown; auth?: boolean } = {}): Promise<T> {
  if (!isOnline) throw new Error("offline");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.auth !== false) Object.assign(headers, await authHeader());
  const res = await fetch(`${FN_URL}${path}`, {
    method: opts.method ?? "POST",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const txt = await res.text();
  const json = txt ? JSON.parse(txt) : {};
  if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
  return json as T;
}

// ── SIWE ─────────────────────────────────────────────────────────────────────
export interface SiweNonce { nonce: string; message: string }
export interface SiweVerifyResult { accessToken: string; refreshToken: string; wallet: string; user: { id: string; wallet: string } }

export const api = {
  siwe: {
    getNonce: (wallet: string) => call<SiweNonce>(`/siwe-verify/nonce?wallet=${wallet}`, { method: "GET", auth: false }),
    verify:   (message: string, signature: string) => call<SiweVerifyResult>(`/siwe-verify/verify`, { body: { message, signature }, auth: false }),
  },
  claimFini: (campaignId: string) =>
    call<{ success: true; claimedAmount: number; tokenIds: number[]; newBalance: number; claimId: string }>(`/claim-fini`, { body: { campaignId } }),
  // Authenticated self-service top-ups (daily drop / emergency rescue). Amounts,
  // floor, and cooldown are enforced server-side; see supabase/functions/claim-grant.
  claimGrant: (kind: "daily" | "rescue") =>
    call<{ success: true; kind: "daily" | "rescue"; amount: number; newBalance: number; cooldownMs?: number }>(`/claim-grant`, { body: { kind } }),
  debitBalance: (args: { amount: number; reason: string; idempotencyKey: string; battleId?: string; tradeId?: string; metadata?: Record<string, unknown> }) =>
    call<{ success: true; newBalance: number; ledgerId: number }>(`/debit-balance`, { body: args }),
  recordBattle: (args: { battleId: string; battleType: string; teamTokenIds: number[]; outcome: "win" | "loss" | "draw"; stake: number; payout: number; opponentSeed?: number }) =>
    call<{ success: true; outcome: string; payout: number; newBalance: number }>(`/record-battle`, { body: args }),
  // lockedPct is advisory only — the server locks the odds from its own pool
  // and echoes the authoritative figure back in the response.
  predictPlace: (args: { battleId: string; side: "A" | "B"; stake: number; lockedPct: number; idempotencyKey: string }) =>
    call<{ success: true; battleId: string; side: "A" | "B"; stake: number; lockedPct?: number }>(`/predict-place`, { body: args }),

  // ── Operator console (admin-ops edge fn) ───────────────────────────────────
  // Every method requires an admin SIWE session; the server enforces it.
  admin: {
    configGet: () => call<{ config: EconomyConfig | null }>(`/admin-ops`, { body: { action: "config.get" } }),
    configSet: (patch: Partial<EconomyConfig>) =>
      call<{ config: EconomyConfig }>(`/admin-ops`, { body: { action: "config.set", patch } }),
    botSetActive: (wallet: string, active: boolean) =>
      call<{ ok: true; wallet: string; active: boolean }>(`/admin-ops`, { body: { action: "bot.setActive", wallet, active } }),
    botUpdate: (wallet: string, patch: { stake?: number; maxPerDay?: number; params?: Record<string, unknown> }) =>
      call<{ ok: true; wallet: string }>(`/admin-ops`, { body: { action: "bot.update", wallet, ...patch } }),
    botRetire: (wallet: string) =>
      call<{ ok: true; wallet: string; swept: number }>(`/admin-ops`, { body: { action: "bot.retire", wallet } }),
    walletFund: (wallet: string, amount: number) =>
      call<{ ok: true; wallet: string; amount: number; newBalance: number }>(`/admin-ops`, { body: { action: "wallet.fund", wallet, amount } }),
    botSpawn: (args: { handle: string; strategyType: string; params?: Record<string, unknown>; stake?: number; maxPerDay?: number; seed?: number }) =>
      call<{ ok: true; wallet: string; handle: string; balance: number }>(`/admin-ops`, { body: { action: "bot.spawn", ...args } }),
    battleResolve: (battleId: string, winningSide: "A" | "B", reason: string) =>
      call<{ ok: true; battleId: string; result: unknown }>(`/admin-ops`, { body: { action: "battle.resolve", battleId, winningSide, reason } }),
    battleVoid: (battleId: string, reason: string) =>
      call<{ ok: true; battleId: string; result: unknown }>(`/admin-ops`, { body: { action: "battle.void", battleId, reason } }),
    actionsRecent: (limit = 50) =>
      call<{ actions: AdminAction[] }>(`/admin-ops`, { body: { action: "actions.recent", limit } }),
  },
};

export interface EconomyConfig {
  daily_grant: number; rescue_amount: number; rescue_floor: number; new_account_seed: number;
  arena_fee_pct: number; entry_cutoff_seconds: number; bots_paused: boolean;
  fc_daily_cap: number; fc_treasury_float: number; fc_stake_min: number; fc_stake_max: number;
  open_beta: boolean;
  updated_at?: string; updated_by?: string | null;
}
export interface AdminAction {
  id: number; admin_wallet: string; action: string;
  payload: Record<string, unknown>; result: unknown; created_at: string;
}

// ── Direct table reads (use Supabase JS) ─────────────────────────────────────
export async function getBalance(wallet: string): Promise<number> {
  if (!isOnline) return 0;
  const { data } = await supabase.from("fini_balances").select("balance").eq("wallet_address", wallet.toLowerCase()).maybeSingle();
  return Number(data?.balance ?? 0);
}

export async function getFiniRecord(tokenId: number): Promise<{ wins: number; losses: number; draws: number; xp: number; level: number; restingUntil: string | null } | null> {
  if (!isOnline) return null;
  const { data } = await supabase.from("fini_records").select("*").eq("token_id", tokenId).maybeSingle();
  if (!data) return null;
  return {
    wins: data.wins, losses: data.losses, draws: data.draws,
    xp: data.xp, level: data.level,
    restingUntil: data.resting_until,
  };
}
