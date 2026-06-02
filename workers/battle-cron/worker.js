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

  // 3. House bots play — rational automated players that give the arena
  //    critical mass. Each active bot, for each open battle it isn't already
  //    in, may place one prediction this tick based on its strategy.
  try {
    await runHouseBots(env);
  } catch (e) { console.error("[house-bots] failed", e); }
}

const SVC = (env) => ({ "apikey": env.SUPABASE_SERVICE_ROLE_KEY, "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" });

async function runHouseBots(env) {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env;
  if (!SUPABASE_SERVICE_ROLE_KEY) { console.log("[house-bots] no service key — skipped"); return; }
  const h = SVC(env);

  // Load active bots + currently-open battles
  const [botsRes, battlesRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/house_bots?active=eq.true&select=wallet_address,handle,strategy_type,params,stake&limit=50`, { headers: h }),
    fetch(`${SUPABASE_URL}/rest/v1/battle_instances?status=eq.open&select=id,asset_a,asset_b,official_start_price_a,official_start_price_b&limit=40`, { headers: h }),
  ]);
  const bots = await botsRes.json();
  const battles = await battlesRes.json();
  if (!Array.isArray(bots) || !Array.isArray(battles) || battles.length === 0) return;

  // Existing open predictions, to avoid a bot doubling up on a battle
  const predRes = await fetch(`${SUPABASE_URL}/rest/v1/predictions?status=eq.open&select=battle_id,wallet_address&limit=1000`, { headers: h });
  const preds = await predRes.json();
  const taken = new Set((Array.isArray(preds) ? preds : []).map(p => `${p.wallet_address}:${p.battle_id}`));

  let placed = 0;
  for (const bot of bots) {
    // Each bot acts on at most 2 battles per tick (keeps volume sane)
    let actsLeft = 2;
    for (const battle of battles) {
      if (actsLeft <= 0) break;
      if (taken.has(`${bot.wallet_address}:${battle.id}`)) continue;
      const side = decideSide(bot, battle);
      if (!side) continue;

      // Debit the bot's balance, then record the prediction (service role).
      const stake = bot.stake || 100;
      const idem = `housebot:${bot.wallet_address}:${battle.id}`;
      const debit = await fetch(`${SUPABASE_URL}/rest/v1/rpc/debit_balance`, {
        method: "POST", headers: h,
        body: JSON.stringify({ p_wallet: bot.wallet_address, p_amount: stake, p_reason: "prediction_stake", p_idempotency_key: idem }),
      });
      if (!debit.ok) continue; // insufficient balance or dup — skip

      const ins = await fetch(`${SUPABASE_URL}/rest/v1/predictions`, {
        method: "POST", headers: { ...h, "Prefer": "resolution=ignore-duplicates" },
        body: JSON.stringify({ battle_id: battle.id, wallet_address: bot.wallet_address, side, stake, locked_pct: 50, idempotency_key: idem }),
      });
      if (ins.ok) { placed++; actsLeft--; taken.add(`${bot.wallet_address}:${battle.id}`); }
    }
  }
  console.log(`[house-bots] ${bots.length} active, placed ${placed} predictions`);
}

/** Lightweight server-side mirror of the Automated Attack strategy logic. */
function decideSide(bot, battle) {
  const params = bot.params || {};
  // Asset filter
  if (Array.isArray(params.assetFilter) && params.assetFilter.length) {
    const assets = [battle.asset_a, battle.asset_b].filter(Boolean);
    if (!assets.some(a => params.assetFilter.includes(a))) return null;
  }
  switch (bot.strategy_type) {
    case "loyalist":
    case "flat_bias":
      return params.sideFilter || "A";
    case "contrarian":
      // No live odds server-side here → lean to the structurally-favoured side
      // sparingly; act ~50% of ticks to avoid every bot piling on.
      return Math.random() < 0.5 ? "B" : null;
    case "momentum":
    case "momentum_underlying":
    case "late_sniper": {
      // Use start price as a weak proxy: bots back "A" (Up / first asset) more
      // often, with some entropy. Real edge comes from the client sim too;
      // these keep the DB populated with rational, mostly-favoured picks.
      return Math.random() < 0.62 ? "A" : "B";
    }
    case "mean_reversion":
      return Math.random() < 0.5 ? "B" : "A";
    default:
      return Math.random() < 0.5 ? "A" : null;
  }
}
