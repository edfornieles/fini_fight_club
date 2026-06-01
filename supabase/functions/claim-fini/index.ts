/**
 * POST /claim-fini { campaignId }
 *
 * Validates: caller's wallet has Finis in the campaign snapshot, hasn't claimed
 * yet, the campaign is active, and the supply cap isn't exceeded. Then mints
 * FINI$ via credit_balance + writes holder_claim + claimed_token_ids rows.
 */
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { requireWallet, supabaseAdmin } from "../_shared/auth.ts";

const FINILIAR_CONTRACT = "0x5a0121a0a21232ec0d024dab9017314509026480";

Deno.serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  let wallet: string;
  try { wallet = await requireWallet(req); } catch (e) { return jsonResponse({ error: String(e) }, 401); }

  const { campaignId } = await req.json().catch(() => ({})) as { campaignId?: string };
  if (!campaignId) return jsonResponse({ error: "missing campaignId" }, 400);

  const sb = supabaseAdmin();

  // Campaign active?
  const { data: campaign } = await sb.from("claim_campaigns").select("*").eq("id", campaignId).maybeSingle();
  if (!campaign) return jsonResponse({ error: "campaign_not_found" }, 404);
  if (campaign.status !== "active") return jsonResponse({ error: "campaign_not_active" }, 400);
  if (new Date(campaign.ends_at).getTime() < Date.now()) return jsonResponse({ error: "campaign_ended" }, 400);

  // Already claimed?
  const { data: existing } = await sb.from("holder_claims")
    .select("id").eq("campaign_id", campaignId).eq("wallet_address", wallet).maybeSingle();
  if (existing) return jsonResponse({ error: "already_claimed" }, 409);

  // Find eligible tokens — from snapshot, minus already-claimed token IDs.
  const { data: snapshotTokens } = await sb.from("holder_snapshots")
    .select("token_id, contract_address")
    .eq("campaign_id", campaignId)
    .eq("wallet_address", wallet);
  const eligibleIds = (snapshotTokens ?? []).map(r => r.token_id);
  if (eligibleIds.length === 0) return jsonResponse({ error: "no_finis_in_snapshot" }, 403);

  const { data: alreadyClaimed } = await sb.from("claimed_token_ids")
    .select("token_id").eq("campaign_id", campaignId).in("token_id", eligibleIds);
  const claimedSet = new Set((alreadyClaimed ?? []).map(r => r.token_id));
  const freshIds = eligibleIds.filter(id => !claimedSet.has(id));
  if (freshIds.length === 0) return jsonResponse({ error: "all_tokens_already_claimed" }, 409);

  const amount = campaign.base_wallet_amount + freshIds.length * campaign.per_fini_amount;
  if (campaign.max_claim_per_wallet && amount > campaign.max_claim_per_wallet) {
    return jsonResponse({ error: "exceeds_max_per_wallet" }, 400);
  }

  // Supply cap check
  const newTotal = Number(campaign.total_distributed) + amount;
  if (newTotal > Number(campaign.total_supply_cap)) {
    return jsonResponse({ error: "supply_cap_reached", remaining: campaign.total_supply_cap - campaign.total_distributed }, 409);
  }

  // Mint a holder_claim row first (idempotency anchor)
  const idempotencyKey = `claim:${campaignId}:${wallet}`;
  const sigHash = `0x${crypto.randomUUID().replace(/-/g, "")}`; // placeholder; real flow records SIWE sig hash

  const { data: claimRow, error: claimErr } = await sb.from("holder_claims").insert({
    campaign_id:        campaignId,
    wallet_address:     wallet,
    claimed_amount:     amount,
    claimed_token_ids:  freshIds,
    signature_hash:     sigHash,
    status:             "completed",
    idempotency_key:    idempotencyKey,
  }).select("id").single();
  if (claimErr || !claimRow) return jsonResponse({ error: claimErr?.message ?? "claim_insert_failed" }, 500);

  // Mark each token as claimed (enforces uniqueness via the unique constraint)
  const tokenRows = freshIds.map(id => ({
    campaign_id: campaignId, contract_address: FINILIAR_CONTRACT,
    token_id: id, claimed_by_wallet: wallet, holder_claim_id: claimRow.id,
  }));
  const { error: tokensErr } = await sb.from("claimed_token_ids").insert(tokenRows);
  if (tokensErr) {
    // rollback claim row
    await sb.from("holder_claims").delete().eq("id", claimRow.id);
    return jsonResponse({ error: "token_double_claim_detected: " + tokensErr.message }, 409);
  }

  // Credit balance via the atomic RPC
  const { data: credit, error: creditErr } = await sb.rpc("credit_balance", {
    p_wallet:          wallet,
    p_amount:          amount,
    p_reason:          "holder_claim",
    p_idempotency_key: `ledger:${idempotencyKey}`,
    p_claim_id:        claimRow.id,
    p_metadata:        { campaignId, tokenIds: freshIds },
  });
  if (creditErr) return jsonResponse({ error: creditErr.message }, 500);

  // Bump campaign distributed counter
  await sb.from("claim_campaigns")
    .update({ total_distributed: newTotal })
    .eq("id", campaignId);

  return jsonResponse({
    success: true,
    claimedAmount: amount,
    tokenIds: freshIds,
    newBalance: credit?.[0]?.new_balance,
    claimId: claimRow.id,
  });
});
