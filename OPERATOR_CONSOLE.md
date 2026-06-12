# Operator Console — deploy & use

The operator console (`/admin/bots`) lets you monitor + control the house bots,
manually resolve battles the auto-resolver flagged, and tune the economics of
both games (Crypto Arena + Fight Club). It talks to a new `admin-ops` edge
function, gated by real admin auth.

The **frontend is built and bundles clean**. The **backend pieces below must be
deployed** (this session had no Supabase CLI login, so they're code-complete but
not yet pushed). Until they're deployed, the console renders in read-only mode
and write actions will fail.

## What's new in this change
- `supabase/migrations/0010_admin.sql` — `economy_config` (tunable levers, seeded
  with today's hardcoded defaults), `users.is_admin`, `admin_actions` audit log,
  and the `spawn_house_bot` RPC. (`sweep_house_bot` already existed.)
- `supabase/functions/admin-ops/` + `_shared/admin.ts` — the admin-gated,
  service-role endpoint behind every console write.
- Frontend: `src/pages/AdminBotsPage.tsx` (now the tabbed console),
  `src/components/admin/*`, `src/hooks/useAdminGate.ts`, `api.admin.*` in
  `src/lib/api.ts`.

## Deploy steps
```bash
cd ~/finiliar-run
supabase login                 # one-time, opens browser
# project is already linked (cxgkbgtmczrgpgafwdox)

# 1. Apply the migration
supabase db push

# 2. Set the admin allowlist secret (comma-separated, lowercased wallets).
#    This is the bootstrap admin before any users.is_admin row exists.
supabase secrets set ADMIN_WALLETS=0xYOURWALLET

# 3. Deploy the function
supabase functions deploy admin-ops
```

Then add the **frontend** allowlist so the console shows its controls for your
wallet, and redeploy the site (Cloudflare Pages picks up the branch push):
```bash
# .env.production
VITE_ADMIN_WALLETS=0xYOURWALLET   # same address(es), comma-separated
```

## Arena: fixed-odds payouts + two-sided liquidity (same deploy)

This batch also makes the arena pay **fixed odds at entry** (Polymarket-style) and
keeps every battle two-sided so odds never read as 0/100. Deploy alongside the
console:

```bash
supabase db push                       # applies 0013_fixed_odds + 0012_more_house_bots
cd workers/battle-cron && npx wrangler deploy   # the new two-sided market-maker bots
```

- `0013_fixed_odds.sql` — `resolve_battle` now pays winners `stake × 100/locked_pct`
  (the exact "To win" the bet panel shows), instead of parimutuel. Void path
  unchanged. Returns `house_pl` per battle for the economy view.
- `0012_more_house_bots.sql` — +30 bots (idempotent, ledger-funded 200k each).
- `workers/battle-cron/worker.js` — `runHouseBots` rewritten battle-centric:
  seeds **both sides** of every open battle each tick, **varied stakes**, and
  `locked_pct` = the side's live implied probability at entry. Tunables at top:
  `MAKERS_PER_BATTLE` (depth/tick) and `MIN_PCT`/`MAX_PCT` (odds band).

After deploy, give the cron a few ticks, then check the arena — battles should
show two-sided odds inside the band and a busy live feed. The Profile page's
"Your battles" list + record populate from the same `predictions` (no deploy
needed for the client side — it reads live data).

## Auth model (important)
- `VITE_ADMIN_WALLETS` is a **UX gate only** — it decides whether the browser
  shows the controls. It is not security.
- The real enforcement is **server-side**: every `admin-ops` call runs
  `requireAdmin`, which checks the SIWE-JWT wallet against the `ADMIN_WALLETS`
  secret (or `users.is_admin = true`) and 403s otherwise. A faked client gate can
  at most *view*; it can never mutate.
- `?dev=1` opens a local read-only view without a wallet (handy offline). Writes
  still require a real admin session.

## Verify
1. Connect your admin wallet on the site → open `/admin/bots`. Header should show
   `● Admin · 0x…`.
2. **Bots tab**: 20 bots with live P&L. Expand one → Pause, change stake → Save,
   Retire & sweep. Spawn a new bot. Each action should reflect on refresh and
   appear in the **Audit** tab.
3. **Economy tab**: CUTE$ circulation (players vs bots), open-battle pool,
   treasury. Toggle "Pause ALL bots" and Save → bots stop placing (cron reads
   `economy_config.bots_paused` — see note below).
4. **Resolution queue**: if any battle is in `manual_review`, pick a winner or
   void+refund; it should settle and leave the queue.

## Follow-up wiring — DONE
- ✅ The cron worker now reads `economy_config.bots_paused` and skips
  `runHouseBots()` when true — the kill switch actually halts the bots.
- ✅ Daily grant + rescue are now server-backed (`claim-grant` edge fn) reading
  `economy_config` amounts; `coinStore.loadEconomy()` pulls them on load. Fight
  Club caps (`treasuryStore`) are still client-side — a remaining swap.

See `LAUNCH_DEPLOY.md` for the full, consolidated deploy checklist.
