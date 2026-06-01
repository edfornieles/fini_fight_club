/**
 * SIWE — Sign-In With Ethereum.
 *
 * GET  /siwe-verify/nonce?wallet=0x…    → { nonce, message }
 * POST /siwe-verify/verify { message, signature } → { accessToken, user }
 *
 * Flow:
 *  1. Client requests a nonce for their wallet → server stores it (5min TTL)
 *  2. Client signs the SIWE message in wallet
 *  3. Client posts message+signature → server verifies sig + nonce, mints JWT
 *  4. Client uses JWT as Bearer for all subsequent /functions/* calls
 */
import { SiweMessage } from "https://esm.sh/siwe@2.3.2";
import { handleOptions, jsonResponse, corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/auth.ts";

const NONCE_TTL_MS = 5 * 60 * 1000;
const DOMAIN = Deno.env.get("SIWE_DOMAIN") ?? "fini.xyz";

Deno.serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/siwe-verify/, "");

  try {
    if (req.method === "GET" && path === "/nonce") return await issueNonce(url);
    if (req.method === "POST" && path === "/verify") return await verifySignature(req);
    return jsonResponse({ error: "not_found" }, 404);
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : "unknown" }, 400);
  }
});

async function issueNonce(url: URL): Promise<Response> {
  const wallet = (url.searchParams.get("wallet") ?? "").toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(wallet)) {
    return jsonResponse({ error: "invalid wallet" }, 400);
  }
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const expiresAt = new Date(Date.now() + NONCE_TTL_MS);
  const issuedAt = new Date();

  const message = new SiweMessage({
    domain: DOMAIN,
    address: ethChecksumOrLower(wallet),
    statement: "Sign in to Fini Crypto Arena. This signature does not cost gas and does not give the app permission to move assets.",
    uri: `https://${DOMAIN}`,
    version: "1",
    chainId: 1,
    nonce,
    issuedAt: issuedAt.toISOString(),
    expirationTime: expiresAt.toISOString(),
  }).prepareMessage();

  const sb = supabaseAdmin();
  const { error } = await sb.from("wallet_signatures").insert({
    wallet_address: wallet, nonce, message, domain: DOMAIN,
    issued_at: issuedAt.toISOString(),
    expires_at: expiresAt.toISOString(),
  });
  if (error) return jsonResponse({ error: error.message }, 500);

  return jsonResponse({ nonce, message });
}

async function verifySignature(req: Request): Promise<Response> {
  const body = await req.json().catch(() => ({})) as { message?: string; signature?: string };
  if (!body.message || !body.signature) return jsonResponse({ error: "missing message or signature" }, 400);

  const siwe = new SiweMessage(body.message);
  const { data: verifiedData } = await siwe.verify({ signature: body.signature });
  const wallet = siwe.address.toLowerCase();
  const nonce = siwe.nonce;

  const sb = supabaseAdmin();

  // Check nonce: exists, unused, not expired
  const { data: sigRow, error: sigErr } = await sb.from("wallet_signatures")
    .select("*").eq("wallet_address", wallet).eq("nonce", nonce).maybeSingle();
  if (sigErr || !sigRow) return jsonResponse({ error: "nonce not found" }, 401);
  if (sigRow.used_at) return jsonResponse({ error: "nonce already used" }, 401);
  if (new Date(sigRow.expires_at).getTime() < Date.now()) return jsonResponse({ error: "nonce expired" }, 401);

  // Burn the nonce
  await sb.from("wallet_signatures").update({ used_at: new Date().toISOString(), signature: body.signature })
    .eq("id", sigRow.id);

  // Create or fetch the user
  const email = `${wallet}@wallet.local`;
  let userId: string;

  // Try to get existing user via admin list (cheap for small user base; can be replaced by lookup table)
  const { data: existing } = await sb.from("users").select("id").eq("wallet_address", wallet).maybeSingle();
  if (existing?.id) {
    userId = existing.id;
  } else {
    const { data: created, error: createErr } = await sb.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { wallet },
    });
    if (createErr || !created?.user) return jsonResponse({ error: createErr?.message ?? "user create failed" }, 500);
    userId = created.user.id;
    await sb.from("users").insert({ id: userId, wallet_address: wallet });
  }

  // Generate a session for the user. We use admin-issued magic link / signInWithIdToken alternative: generateLink.
  const { data: linkData, error: linkErr } = await sb.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkErr || !linkData) return jsonResponse({ error: linkErr?.message ?? "session mint failed" }, 500);

  // Verify the link's OTP server-side to obtain real tokens
  const { hashed_token } = linkData.properties;
  const { data: session, error: vErr } = await sb.auth.verifyOtp({
    type: "magiclink",
    token_hash: hashed_token,
  });
  if (vErr || !session.session) return jsonResponse({ error: vErr?.message ?? "session verify failed" }, 500);

  void verifiedData;
  return jsonResponse({
    accessToken:  session.session.access_token,
    refreshToken: session.session.refresh_token,
    wallet,
    user: { id: userId, wallet },
  });
}

function ethChecksumOrLower(addr: string): string {
  return addr.toLowerCase();
}
