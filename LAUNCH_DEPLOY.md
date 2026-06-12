# CUTE$ soft-launch — deploy checklist

Single source of truth for shipping everything built for the beta. The backend
needs a one-time `supabase login` (the desktop session had no CLI auth). The
frontend deploys to Cloudflare Pages on branch push.

## 1. Database migrations
```bash
cd ~/finiliar-run
supabase login            # one-time; project already linked (cxgkbgtmczrgpgafwdox)
supabase db push          # applies 0010–0014
```
| migration | what it does |
|---|---|
| `0010_admin.sql` | `economy_config` (tunable levers), `users.is_admin`, `admin_actions` audit, `spawn_house_bot` |
| `0011_rescue_reason.sql` | adds `rescue_grant` ledger reason |
| `0012_more_house_bots.sql` | +30 house bots (ledger-funded 200k each) |
| `0013_fixed_odds.sql` | `resolve_battle` → **fixed odds at entry** (`stake × 100/locked_pct`) |
| `0014_beta_gate.sql` | `economy_config.open_beta` + `beta_allowlist` (invite gate) |

## 2. Edge function secrets + deploy
```bash
supabase secrets set ADMIN_WALLETS=0xYOURWALLET   # bootstrap operator(s), lowercased, comma-sep
supabase functions deploy admin-ops claim-grant siwe-verify predict-place
```
- **admin-ops** (new) — operator console backend (bot control, manual resolve, config).
- **claim-grant** (new) — server-enforced daily drop + rescue (cooldown/floor from `economy_config`).
- **siwe-verify** (changed) — now enforces the invite gate when `open_beta = false`.
- **predict-place** (changed) — per-wallet velocity cap (30/min).
- (other functions unchanged; redeploy is harmless.)

## 3. Cron worker (house bots + resolution)
```bash
cd workers/battle-cron && npx wrangler deploy
```
New: battle-centric `runHouseBots` seeds **both sides** of every open battle with
varied stakes + realistic locked odds; honours the `bots_paused` kill switch.
Tunables at top of `worker.js`: `MAKERS_PER_BATTLE`, `MIN_PCT`/`MAX_PCT`.

## 4. Frontend env + deploy
Add to `.env.production`, then push the branch (Cloudflare Pages builds):
```
VITE_ADMIN_WALLETS=0xYOURWALLET        # operator console UX gate (server still enforces)
# optional, only once the token is deployed:
VITE_CUTE_TOKEN_ADDRESS=0x...
VITE_CUTE_RPC_URL=https://sepolia.base.org
```

## 5. CUTE$ token (optional for beta)
The off-chain ledger IS the currency; the ERC20 is optional. To deploy it, follow
`contracts/README.md` (Remix or Foundry, Base Sepolia), then set the env vars above.

---

## Post-deploy smoke test
1. **Bots/odds**: wait a few cron ticks → `/crypto` shows battles with two-sided
   odds inside the band and a busy live feed. (`select two-sided` check in
   §"feels real" of the chat held this back before.)
2. **Play loop**: connect wallet → SIWE → `/claim` for CUTE$ → place a prediction
   → it hits `predict-place` (network tab) → settles from the server when the
   battle resolves → payout matches the "To win" shown.
3. **Profile**: `/profile` "Your battles" lists real bets + results; record is real.
4. **Operator**: `/admin/bots` as an admin wallet → pause a bot (stops next tick),
   toggle "Pause ALL bots", manually resolve a `manual_review` battle, edit a
   grant amount → reflected in `claim-grant`.
5. **Invite gate**: flip Economy → Access → "INVITE-ONLY"; a non-allowlisted
   wallet now gets `not_invited` on sign-in. Add wallets to `beta_allowlist`.
6. **Terms**: first visit shows the play-only disclaimer modal; `/terms` reads.

## What's already live (no deploy)
The Supabase backend, the 20 original bots, and the cron were already running in
production; this batch upgrades them. The client reads (arena, profile history)
work against live data immediately once the frontend ships.
