/**
 * Typed fetch client for our Supabase edge functions.
 * All POST endpoints require a Supabase session JWT in Authorization.
 */
import { supabase, isOnline } from "./supabase";
const FN_URL = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL
    ?? (import.meta.env.VITE_SUPABASE_URL ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1` : "");
async function authHeader() {
    const { data } = await supabase.auth.getSession();
    const tok = data.session?.access_token;
    return tok ? { Authorization: `Bearer ${tok}` } : {};
}
async function call(path, opts = {}) {
    if (!isOnline)
        throw new Error("offline");
    const headers = { "Content-Type": "application/json" };
    if (opts.auth !== false)
        Object.assign(headers, await authHeader());
    const res = await fetch(`${FN_URL}${path}`, {
        method: opts.method ?? "POST",
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    const txt = await res.text();
    const json = txt ? JSON.parse(txt) : {};
    if (!res.ok)
        throw new Error(json?.error ?? `HTTP ${res.status}`);
    return json;
}
export const api = {
    siwe: {
        getNonce: (wallet) => call(`/siwe-verify/nonce?wallet=${wallet}`, { method: "GET", auth: false }),
        verify: (message, signature) => call(`/siwe-verify/verify`, { body: { message, signature }, auth: false }),
    },
    claimFini: (campaignId) => call(`/claim-fini`, { body: { campaignId } }),
    debitBalance: (args) => call(`/debit-balance`, { body: args }),
    recordBattle: (args) => call(`/record-battle`, { body: args }),
    predictPlace: (args) => call(`/predict-place`, { body: args }),
};
// ── Direct table reads (use Supabase JS) ─────────────────────────────────────
export async function getBalance(wallet) {
    if (!isOnline)
        return 0;
    const { data } = await supabase.from("fini_balances").select("balance").eq("wallet_address", wallet.toLowerCase()).maybeSingle();
    return Number(data?.balance ?? 0);
}
export async function getFiniRecord(tokenId) {
    if (!isOnline)
        return null;
    const { data } = await supabase.from("fini_records").select("*").eq("token_id", tokenId).maybeSingle();
    if (!data)
        return null;
    return {
        wins: data.wins, losses: data.losses, draws: data.draws,
        xp: data.xp, level: data.level,
        restingUntil: data.resting_until,
    };
}
