/**
 * Cloudflare Worker — server-side battle spawning + resolution.
 *
 * Runs on a cron trigger (every 5 min). Two jobs:
 *   1. POST /battle-factory   → spawn fresh battle instances with verified
 *      start prices (idempotent — re-runs in the same window are no-ops)
 *   2. Find battle_instances past end_time + still open, POST /resolve-battle
 *      for each so they settle server-side, consistently for all users.
 *
 * Secrets (wrangler secret put …):
 *   SUPABASE_URL, SUPABASE_ANON_KEY, INTERNAL_API_KEY
 */
export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(run(env));
  },
  // Allow manual trigger via GET for testing
  async fetch(_req, env) {
    await run(env);
    return new Response("ran", { status: 200 });
  },
};

async function run(env) {
  const { SUPABASE_URL, SUPABASE_ANON_KEY, INTERNAL_API_KEY } = env;
  const authHeaders = {
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    "apikey": SUPABASE_ANON_KEY,
    "x-internal-key": INTERNAL_API_KEY,
    "Content-Type": "application/json",
  };

  // 1. Spawn fresh battles
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/battle-factory`, { method: "POST", headers: authHeaders });
    console.log("[battle-factory]", r.status, (await r.text()).slice(0, 200));
  } catch (e) { console.error("[battle-factory] failed", e); }

  // 2. Find ended-but-open battles and resolve each
  try {
    const nowIso = new Date().toISOString();
    const q = `${SUPABASE_URL}/rest/v1/battle_instances?status=eq.open&end_time=lt.${nowIso}&select=id&limit=50`;
    const res = await fetch(q, { headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` } });
    const ended = await res.json();
    console.log(`[resolve] ${Array.isArray(ended) ? ended.length : 0} ended battles`);
    for (const b of (Array.isArray(ended) ? ended : [])) {
      try {
        const rr = await fetch(`${SUPABASE_URL}/functions/v1/resolve-battle`, {
          method: "POST", headers: authHeaders, body: JSON.stringify({ battleId: b.id }),
        });
        console.log(`[resolve] ${b.id} → ${rr.status}`);
      } catch (e) { console.error(`[resolve] ${b.id} failed`, e); }
    }
  } catch (e) { console.error("[resolve] query failed", e); }
}
