/**
 * Verify a request's JWT and extract the wallet claim.
 * The SIWE verify function mints a custom Supabase JWT with `wallet` in claims.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export function supabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function requireWallet(req: Request): Promise<string> {
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new Error("unauthorized: missing token");

  const sb = supabaseAdmin();
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) throw new Error("unauthorized: " + (error?.message ?? "no user"));

  const wallet = (data.user.user_metadata?.wallet as string | undefined)?.toLowerCase();
  if (!wallet) throw new Error("unauthorized: no wallet on token");
  return wallet;
}
