/**
 * POST /battle-factory
 *
 * Generates rolling battle instances from active templates. Idempotent —
 * uses a deterministic id like `btc-updown-1h:2026-06-01T14`, so re-running
 * the cron in the same window is a no-op.
 *
 * Each new battle records the multi-source official start price + per-source
 * audit trail. If <2 sources agree, the battle is NOT created (we don't want
 * battles with untrusted start prices).
 *
 * Schedule:  supabase functions schedule add battle-factory --cron "*​/5 * * * *"
 */
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/auth.ts";
import { fetchPriceSnapshot, type Symbol } from "../_shared/prices.ts";

Deno.serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;
  if (req.method !== "POST" && req.method !== "GET") return jsonResponse({ error: "method_not_allowed" }, 405);

  const internalKey = req.headers.get("x-internal-key");
  if (internalKey !== Deno.env.get("INTERNAL_API_KEY")) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  const sb = supabaseAdmin();
  const { data: templates, error } = await sb.from("battle_templates").select("*").eq("active", true);
  if (error || !templates) return jsonResponse({ error: error?.message ?? "no_templates" }, 500);

  const created: string[] = [];
  const skipped: { id: string; reason: string }[] = [];
  const now = new Date();

  for (const t of templates) {
    const start = snapToWindow(now, t.duration_minutes);
    const end   = new Date(start.getTime() + t.duration_minutes * 60_000);
    const cutoff = new Date(end.getTime() - t.entry_cutoff_seconds * 1000);
    const id = `${t.id}:${start.toISOString().slice(0, 16)}`;

    const { data: existing } = await sb.from("battle_instances").select("id").eq("id", id).maybeSingle();
    if (existing) continue;

    const snapA = await fetchPriceSnapshot(t.asset_a as Symbol, t.max_deviation_bps ?? 50);
    if (!snapA.trustworthy) {
      skipped.push({ id, reason: `start_price_untrusted_${t.asset_a}: ${snapA.samples.length}src ${snapA.spreadBps}bps` });
      continue;
    }
    let snapB = null;
    if (t.asset_b) {
      snapB = await fetchPriceSnapshot(t.asset_b as Symbol, t.max_deviation_bps ?? 50);
      if (!snapB.trustworthy) {
        skipped.push({ id, reason: `start_price_untrusted_${t.asset_b}: ${snapB.samples.length}src ${snapB.spreadBps}bps` });
        continue;
      }
    }

    const { error: insErr } = await sb.from("battle_instances").insert({
      id,
      template_id: t.id,
      asset_a: t.asset_a,
      asset_b: t.asset_b,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      entry_cutoff: cutoff.toISOString(),
      status: "open",
      official_start_price_a: snapA.median,
      official_start_price_b: snapB?.median ?? null,
      start_price_source: snapA.samples.map(s => s.source).join(","),
      start_price_recorded_at: new Date(snapA.fetchedAt).toISOString(),
      backup_checks: {
        asset_a: { samples: snapA.samples, spreadBps: snapA.spreadBps },
        ...(snapB ? { asset_b: { samples: snapB.samples, spreadBps: snapB.spreadBps } } : {}),
      },
      resolution_formula: t.battle_type === "updown"
        ? "endPrice > startPrice → Up (A) wins"
        : t.battle_type === "outperform"
          ? `% change ${t.asset_a} vs ${t.asset_b} — higher wins`
          : "see template",
    });
    if (!insErr) created.push(id);
    else skipped.push({ id, reason: insErr.message });
  }

  return jsonResponse({ created, skipped, count: created.length });
});

function snapToWindow(now: Date, durationMinutes: number): Date {
  const ms = durationMinutes * 60_000;
  return new Date(Math.floor(now.getTime() / ms) * ms);
}
