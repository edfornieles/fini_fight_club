/**
 * Cloudflare Worker — Supabase free-tier keep-alive.
 *
 * Supabase's free tier pauses a project after 7 days of database inactivity.
 * During an active beta this never triggers, but if testing goes quiet for a
 * week the next visitor hits a cold-start delay. This Worker pings the DB
 * once a day to keep it warm — keeping the free tier viable indefinitely.
 *
 * Deploy:
 *   1. Create a new Worker in the Cloudflare dashboard (or `wrangler deploy`)
 *   2. Set two secrets:
 *        wrangler secret put SUPABASE_URL
 *        wrangler secret put SUPABASE_ANON_KEY
 *   3. Add a Cron Trigger: "0 6 * * *" (daily at 6am UTC)
 *
 * Cost: $0 — well within the Workers free tier (100k req/day; this is 1/day).
 */

export default {
  async scheduled(_event, env, _ctx) {
    if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
      console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
      return;
    }
    try {
      // A trivial REST query keeps the DB connection warm. We hit a tiny table
      // (battle_templates is small + always present). HEAD-style: limit 1.
      const res = await fetch(
        `${env.SUPABASE_URL}/rest/v1/battle_templates?select=id&limit=1`,
        {
          headers: {
            apikey: env.SUPABASE_ANON_KEY,
            Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
          },
        }
      );
      console.log(`[keepalive] ping → ${res.status}`);
    } catch (e) {
      console.error("[keepalive] failed:", e);
    }
  },
};
