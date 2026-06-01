# Fini Crypto Arena — Deployment setup

End-to-end checklist to take the app from local-only to a live closed-beta deployment on **Supabase (backend) + Vercel (frontend)**.

Roughly: 30 min for Supabase, 10 min for Vercel, 10 min for env vars. The code is ready — these are just the project setup steps you have to do once.

---

## 1. Create a Supabase project

1. Sign in at https://supabase.com and click **New project**.
2. Name it something like `fini-crypto-arena`. Pick a region close to your users (e.g. `eu-west-2` for London).
3. Save the database password somewhere safe — you'll need it for the CLI.
4. Wait ~2 minutes for the project to provision.

Grab three values from **Settings → API**:
- **Project URL** → `VITE_SUPABASE_URL` and `SUPABASE_URL`
- **anon public key** → `VITE_SUPABASE_ANON_KEY`
- **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (server-only, never ship to client)

## 2. Install the Supabase CLI

```bash
brew install supabase/tap/supabase
supabase login
```

Then in the project root:

```bash
cd /Users/edfornieles/finiliar-run
supabase link --project-ref <your-project-ref>   # the ref from your project URL
```

## 3. Run the SQL migrations

The migrations are in `supabase/migrations/`:
- `0001_core.sql` — users, balances, ledger, fini_records, battles_log
- `0002_predictions.sql` — battle templates + instances + predictions (crypto arena)
- `0003_claims.sql` — claim campaigns, holder snapshots, wallet signatures
- `0004_balance_rpcs.sql` — atomic credit_balance / debit_balance / record_battle_outcome RPCs

Push them:

```bash
supabase db push
```

If you'd rather paste them by hand: go to **SQL Editor** in the Supabase dashboard, open each file in order, paste, run.

## 4. Deploy the Edge Functions

```bash
supabase functions deploy siwe-verify
supabase functions deploy claim-fini
supabase functions deploy debit-balance
supabase functions deploy credit-balance
supabase functions deploy record-battle
supabase functions deploy predict-place
supabase functions deploy resolve-battle
supabase functions deploy battle-factory
```

Set the function secrets:

```bash
supabase secrets set \
  SIWE_DOMAIN=fini.xyz \
  INTERNAL_API_KEY=$(openssl rand -hex 32)
```

(`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set automatically by Supabase.)

## 5. Populate the claim snapshot

The snapshot tells the `claim-fini` endpoint which wallets are eligible. Run the included script — it reads `public/data/ownership.json` and bulk-inserts into `holder_snapshots`:

```bash
export SUPABASE_URL=https://<your-ref>.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
node scripts/import-snapshot.mjs
```

The script:
- defaults to the Genesis campaign id (`00000000-0000-0000-0000-000000000001`)
- wipes existing snapshot rows for that campaign first (idempotent reruns)
- handles both `{ tokenOwners: { id: wallet } }` and `{ byOwner: { wallet: [ids] } }` formats
- inserts in batches of 1000 with progress output

For a fresh on-chain snapshot at a specific block, extend `src/game/wallet/rpc.ts`'s `balanceOf`/`ownerOf` plumbing into a scanner — but the existing `ownership.json` is fine for closed beta.

## 5b. Schedule the Battle Factory + Resolver

The Crypto Arena needs two crons running:

```bash
# Generate new rolling battles every 5 minutes
supabase functions schedule add battle-factory --cron "*/5 * * * *" --http-method POST

# Settle ended battles every minute
supabase functions schedule add resolve-battle-cron --cron "* * * * *" --http-method POST
```

Both calls require the `INTERNAL_API_KEY` header (set in step 4). For the resolver cron specifically, you'll want a tiny wrapper edge function that finds ended battles and posts to `/resolve-battle` for each one — for closed beta you can also just call it manually for testing.

## 6. Local frontend env

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in:

```env
VITE_SUPABASE_URL=https://<your-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
VITE_WALLETCONNECT_PROJECT_ID=<from cloud.walletconnect.com>
```

Then:

```bash
npm install
npm run dev
```

Open http://localhost:5173, connect MetaMask, sign the SIWE message, and you should see your real on-chain Finis.

## 7. Deploy to Vercel

```bash
npm install -g vercel
vercel login
vercel link        # link this folder to a Vercel project
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY
vercel env add VITE_WALLETCONNECT_PROJECT_ID
vercel deploy --prod
```

`vercel.json` already handles the SPA rewrite for react-router.

## 8. Smoke test the live site

- Connect wallet → SIWE modal appears in MetaMask → signature → Supabase session created (check `Authentication → Users` in dashboard, you should see a new user with `wallet` in metadata)
- Go to `/claim` → click through the steps → real claim hits the endpoint
- Check `fini_balances` table — your wallet should have 10,000 × (your Fini count)
- Open `/fight-club`, enter a battle → on resolution, check `battles_log` for the row and `fini_records` for updated XP

---

## What's still TODO post-beta

Now scoped down — the closed-beta-critical pieces are all done. Remaining:

- **PvP matchmaking** — `record-battle` currently accepts the client-supplied outcome. Safe for PvE vs deterministic opponents; unsafe for real PvP. For PvP, replace with `/start-battle` that pairs two waiting wallets and runs the resolution server-side.
- **Resolver wrapper cron** — `resolve-battle` settles a single battleId. Add a tiny wrapper that queries `battle_instances` where `end_time < now() AND resolution_status = 'pending'` and posts to `/resolve-battle` for each. Then schedule that wrapper at `* * * * *`.
- **Daily holder grant cron** — nightly edge function that credits eligible holders, idempotency key = `daily:{wallet}:{date}`.
- **Admin dashboard** — Supabase already has one for raw data; for game admin (pause claims, mark battle manual_review, ban user) build a small `/admin` page that calls service-role-only endpoints.
- **Price feed hardening** — `resolve-battle` only fetches CoinGecko. The `priceIntegrity.ts` schema is designed for primary + backup verification with deviation thresholds — extend the resolver to fetch all sources and validate before settling.

Completed in this build:
- ✅ Schema + RPCs (0001–0006)
- ✅ SIWE auth (`siwe-verify`)
- ✅ Atomic spend/credit (`debit-balance`, `credit-balance`)
- ✅ Holder claim flow (`claim-fini`)
- ✅ Fight Club settlement (`record-battle`)
- ✅ Crypto Arena predict endpoint (`predict-place`)
- ✅ Crypto Arena resolver (`resolve-battle`)
- ✅ Battle factory (`battle-factory`)
- ✅ Snapshot import (`scripts/import-snapshot.mjs`)
- ✅ Frontend wiring (zustand stores → API, ClaimPage, BattlePage predict, FightClubPage settle)

---

## Files reference

```
supabase/
  migrations/0001_core.sql         users + balances + ledger + records
  migrations/0002_predictions.sql  crypto arena
  migrations/0003_claims.sql       claim campaigns + SIWE nonces
  migrations/0004_balance_rpcs.sql atomic transactional RPCs
  migrations/0005_arena_rpcs.sql   bump_battle_volume + resolve_battle RPCs
  migrations/0006_seed_templates.sql initial battle templates
  functions/siwe-verify/           SIWE → Supabase session
  functions/claim-fini/            wallet claim flow
  functions/debit-balance/         user-initiated spend
  functions/credit-balance/        server-issued credit (internal API key)
  functions/record-battle/         fight club settlement
  functions/predict-place/         crypto arena prediction placement
  functions/resolve-battle/        crypto arena settlement (called by cron)
  functions/battle-factory/        rolls out new battles (called by cron)

scripts/
  import-snapshot.mjs              load ownership.json into holder_snapshots

src/
  lib/supabase.ts                  client init
  lib/api.ts                       typed fetch helpers
  lib/wagmi.ts                     wagmi + RainbowKit config
  hooks/useSiweAuth.ts             connect → SIWE → Supabase session bridge
  hooks/useWalletRoster.ts         real on-chain roster via game/wallet providers
  state/coinStore.ts               FINI$ balance (zustand cache + server sync)
  state/finiRecords.ts             per-Fini records (zustand cache + server sync)
  state/inventory.ts               potions (buyPotion uses server debit)
  components/WalletSync.tsx        mounts useSiweAuth + mirrors wagmi → uiStore
  components/ConnectWalletButton.tsx  opens RainbowKit modal

vercel.json                        SPA rewrite + cache headers
.env.example                       template
```
