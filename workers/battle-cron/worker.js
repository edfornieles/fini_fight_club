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

// How many new bot bets to add to each open battle per tick, and the odds band
// the book is kept inside so no battle ever shows 0%/100% (which reads as broken,
// not Polymarket-like). Tune these to dial arena liveliness.
const MAKERS_PER_BATTLE = 5;
const MIN_PCT = 8, MAX_PCT = 92;

async function runHouseBots(env) {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env;
  if (!SUPABASE_SERVICE_ROLE_KEY) { console.log("[house-bots] no service key — skipped"); return; }
  const h = SVC(env);

  // Operator kill switch: economy_config.bots_paused halts all bot play.
  try {
    const cfgRes = await fetch(`${SUPABASE_URL}/rest/v1/economy_config?id=eq.1&select=bots_paused`, { headers: h });
    const cfg = await cfgRes.json();
    if (Array.isArray(cfg) && cfg[0]?.bots_paused === true) {
      console.log("[house-bots] paused via economy_config — skipped");
      return;
    }
  } catch (e) { /* config unreadable → default to running */ }

  // Active bots, open battles, and all open predictions (to know current pools
  // + which bot is already in which battle).
  const [botsRes, battlesRes, predRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/house_bots?active=eq.true&select=wallet_address,handle,strategy_type,params,stake&limit=200`, { headers: h }),
    fetch(`${SUPABASE_URL}/rest/v1/battle_instances?status=eq.open&select=id,asset_a,asset_b,end_time&limit=60`, { headers: h }),
    fetch(`${SUPABASE_URL}/rest/v1/predictions?status=eq.open&select=battle_id,wallet_address,side,stake&limit=5000`, { headers: h }),
  ]);
  const bots = await botsRes.json();
  const battles = await battlesRes.json();
  const preds = await predRes.json();
  if (!Array.isArray(bots) || !Array.isArray(battles) || battles.length === 0) return;

  // Current pool per battle + bot membership.
  const pool = new Map();      // battleId -> { A, B }
  const inBattle = new Set();  // `${wallet}:${battleId}`
  for (const p of (Array.isArray(preds) ? preds : [])) {
    const e = pool.get(p.battle_id) || { A: 0, B: 0 };
    e[p.side === "A" ? "A" : "B"] += (p.stake || 0);
    pool.set(p.battle_id, e);
    inBattle.add(`${p.wallet_address}:${p.battle_id}`);
  }

  let placed = 0;
  // Battle-centric: seed every open battle with balanced two-sided depth so the
  // odds are always live and within band — never one-sided.
  for (const battle of shuffle(battles)) {
    const e = pool.get(battle.id) || { A: 0, B: 0 };
    const cands = shuffle(bots.filter(b =>
      !inBattle.has(`${b.wallet_address}:${battle.id}`) && botAllows(b, battle)));
    let ci = 0;
    for (let m = 0; m < MAKERS_PER_BATTLE && ci < cands.length; m++) {
      const bot = cands[ci++];
      // 70% of bets balance the book (push the lighter side); 30% follow the
      // bot's strategy lean — keeps depth two-sided but not mechanical.
      const lighter = e.A <= e.B ? "A" : "B";
      const lean = strategySide(bot);
      const side = (Math.random() < 0.7 || !lean) ? lighter : lean;

      // locked_pct = the side's live implied probability BEFORE this bet
      // (Polymarket-style: you take the price that's on the board now).
      const total = e.A + e.B;
      const sidePool = side === "A" ? e.A : e.B;
      const lockedPct = total > 0
        ? Math.min(MAX_PCT, Math.max(MIN_PCT, Math.round((sidePool / total) * 100)))
        : 50;
      const stake = variedStake();

      const idem = `housebot:${bot.wallet_address}:${battle.id}`;
      const debit = await fetch(`${SUPABASE_URL}/rest/v1/rpc/debit_balance`, {
        method: "POST", headers: h,
        body: JSON.stringify({ p_wallet: bot.wallet_address, p_amount: stake, p_reason: "prediction_stake", p_idempotency_key: idem }),
      });
      if (!debit.ok) continue; // insufficient balance or dup — skip

      const ins = await fetch(`${SUPABASE_URL}/rest/v1/predictions`, {
        method: "POST", headers: { ...h, "Prefer": "resolution=ignore-duplicates" },
        body: JSON.stringify({ battle_id: battle.id, wallet_address: bot.wallet_address, side, stake, locked_pct: lockedPct, idempotency_key: idem }),
      });
      if (ins.ok) {
        placed++;
        inBattle.add(`${bot.wallet_address}:${battle.id}`);
        if (side === "A") e.A += stake; else e.B += stake;
      } else if (new Date(battle.end_time).getTime() < Date.now() + 3 * 60_000) {
        // Debit landed but the prediction insert failed, and the battle closes
        // before the next tick can retry (debit idem no-op + insert) — without
        // this the stake would be debited forever with no pooled bet. Refunding
        // ONLY in the no-retry window means a later successful retry can never
        // double-credit. Idempotent key: at most one refund per bot+battle.
        await fetch(`${SUPABASE_URL}/rest/v1/rpc/credit_balance`, {
          method: "POST", headers: h,
          body: JSON.stringify({
            p_wallet: bot.wallet_address, p_amount: stake, p_reason: "admin_grant",
            p_idempotency_key: `housebot-refund:${bot.wallet_address}:${battle.id}`,
            p_battle_id: battle.id, p_metadata: { kind: "bot_insert_failed_refund" },
          }),
        }).catch(() => { /* ledger reconciliation will catch it */ });
      }
    }
    pool.set(battle.id, e);
  }
  console.log(`[house-bots] ${bots.length} active, placed ${placed} two-sided predictions across ${battles.length} battles`);
}

function shuffle(arr) {
  return arr.map(v => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
}

// Varied bet sizes — skewed toward small bets with the occasional whale, so
// pools build realistic depth and odds form smooth distributions, not 100-unit steps.
function variedStake() {
  const r = Math.random();
  const base = 50 + Math.floor(r * r * 450);                       // 50..~500, skewed small
  const whale = Math.random() < 0.08 ? Math.floor(Math.random() * 1500) : 0; // ~8% big bets
  return base + whale;
}

// Asset filter only (does the bot's mandate cover this battle's assets?).
function botAllows(bot, battle) {
  const params = bot.params || {};
  if (Array.isArray(params.assetFilter) && params.assetFilter.length) {
    const assets = [battle.asset_a, battle.asset_b].filter(Boolean);
    return assets.some(a => params.assetFilter.includes(a));
  }
  return true;
}

// The bot's directional lean (used for ~30% of its bets). null = no strong lean.
function strategySide(bot) {
  const params = bot.params || {};
  switch (bot.strategy_type) {
    case "loyalist":
    case "flat_bias":
      return params.sideFilter || "A";
    case "contrarian":
      return "B";
    case "momentum":
    case "momentum_underlying":
    case "late_sniper":
      return Math.random() < 0.62 ? "A" : "B";
    case "mean_reversion":
      return Math.random() < 0.5 ? "B" : "A";
    default:
      return null;
  }
}
