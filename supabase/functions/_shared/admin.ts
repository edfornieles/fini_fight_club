/**
 * requireAdmin — gate an operator-only endpoint.
 *
 * A caller is an admin if the wallet on their SIWE JWT is either:
 *   1. listed in the ADMIN_WALLETS env allowlist (comma-separated, lowercased) —
 *      the bootstrap path before any users.is_admin row exists, or
 *   2. flagged users.is_admin = true in the database.
 *
 * Throws "forbidden: not an admin" otherwise. The env allowlist breaks the
 * chicken-and-egg of flagging the very first operator.
 */
import { requireWallet, supabaseAdmin } from "./auth.ts";

export async function requireAdmin(req: Request): Promise<string> {
  const wallet = await requireWallet(req); // throws on missing/invalid JWT

  const allow = (Deno.env.get("ADMIN_WALLETS") ?? "")
    .split(",")
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean);
  if (allow.includes(wallet)) return wallet;

  const sb = supabaseAdmin();
  const { data } = await sb.from("users").select("is_admin").eq("wallet_address", wallet).maybeSingle();
  if (data?.is_admin === true) return wallet;

  throw new Error("forbidden: not an admin");
}
