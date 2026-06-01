# Fini Fight Club — Real Test Readiness Plan

Last updated: 2026-06-01

This document is the source-of-truth roadmap to get from "deployed demo with localStorage" to "real users testing with real wallets, real cross-device persistence, real audited data." Each tier is a real shippable milestone.

---

## Tier 0 — what's live right now

- **Site:** https://fini-fight-club.pages.dev (Cloudflare Pages)
- **Art bundle:** 1.24GB on R2 + bundled with deploy
- **Live prices:** CoinGecko + Coinbase + Binance, median, 3-source verified
- **Battle resolution:** uses real opening-vs-close price movement
- **Automated traders:** top 100 Fini holders run persona-driven strategies
- **Dev impersonation:** instant testing without MetaMask (default ON)

Good enough for "play and tell me what's broken." Not enough for cross-device testing or real value.

---

## Tier 1 — real wallets + server persistence (~2–3 days, $25/mo)

**Goal: testers' progress survives across devices; SIWE-verified wallets; server-authoritative battle settlement.**

### Tasks
- [ ] Deploy Supabase project (migrations 0001–0006 already written, run from `supabase/migrations/`)
- [ ] Deploy 8 edge functions (`supabase functions deploy <name>`)
- [ ] Wire `.env.production` to Supabase URL/anon key, re-deploy to Cloudflare Pages
- [ ] Test SIWE flow end-to-end with a real MetaMask wallet (code already in `src/hooks/useSiweAuth.ts`)
- [ ] Run `scripts/import-snapshot.mjs` to load 1,712-holder snapshot
- [ ] Schedule `battle-factory` cron (every 5 min — rolling battle creation)
- [ ] Schedule `resolve-battle` cron (every 1 min — settle expired battles)
- [ ] Flip `DevWalletSwitcher.isDevModeEnabled()` default back to OFF for public testers (one-line change)

Full instructions: `SETUP.md`. Total focused work: ~6 hours. Cost: **Supabase Pro $25/mo**.

---

## Tier 2 — verifiable data + safety (~1 week, +$20/mo)

**Goal: every claim the site makes is auditable; reasonable safety guardrails.**

### Data verification
- [ ] Create `public.battle_audit` view in Postgres exposing opening/closing prices, sources, formula
- [ ] Build `/audit` page in frontend showing last 100 resolved battles with all the receipts
- [ ] Public counter: "X battles resolved, Y disputes, 100% verifiable"

### Lightweight legal
- [ ] Terms of Use (1 page, in-game currency, no real-money, etc.)
- [ ] Privacy notice
- [ ] Geo-block US/China/France at Cloudflare edge

### Safety
- [ ] Per-wallet rate limit on `/predict-place` (max 1/sec)
- [ ] Server log retention 30 days
- [ ] Disclaimer on `/crypto` about delayed/inaccurate prices
- [ ] Bug bounty channel (Discord or email)

### Cost adds
- Cloudflare Pro: $20/mo (DDoS, page rules for geo-blocking)
- **Total now: ~$45/mo**

---

## Tier 3 — going on-chain (FINI$ as ERC-20) — ~3 weeks, $5–15k

**One-way door. Only if you're committed to running this long-term.**

### Phase A — Token deploy
- Minimal OpenZeppelin ERC-20 on Base ($0.20 gas)
- 10M supply to a Safe.global multisig

### Phase B — Merkle airdrop
- Fresh snapshot of `0x5a01…6480`
- Merkle tree: tokenId → owner → 10,000 FINI$
- Deploy MerkleDistributor on Base
- Wire `/claim` page to call contract

### Phase C — Liquidity (optional)
- Seed Uniswap V3: 5,000 FINI$ + ~$5k USDC

### Phase D — Cash-out
- Wire bust modal `cashOut()` to FINI$ → USDC swap on Base

### Risks
- Legal exposure if it looks like gambling → set up entity in IoM or Malta
- Audit MerkleDistributor before deploy (~$3–5k OpenZeppelin Defender)
- Don't do this until 100+ actual active testers have proven the loop

---

## Tier 4 — community + formal launch

### Pre-launch
- Twitter thread (5 tweets + GIF of battle resolving)
- Pin in Fini community channels
- Direct DM 30 top holders
- Curated invite to 50 holders + 50 crypto-curious art folks

### Launch
- Seeded leaderboard prize pool (first week)
- Live update Twitter thread (hourly screenshots)
- Newsletter to Finiliar holders if list exists

### Ongoing
- Weekly newsletter
- Monthly $500 USDC tournament
- Public roadmap + stats page

### Brand assets
- Custom domain ($12/yr) — `finifight.club` or `play.finiliar.com`
- Favicon + OG image
- 1-pager press kit
- 2-min demo video

---

## Recommended priority order

### Week 1: Tier 1 (~14h work, $25/mo)
Deploy Supabase, wire real wallets, set up crons, redeploy.
**Result:** system that survives real testing.

### Weeks 2–3: rest of Tier 2 (~10h work, +$20/mo)
Geo-block, rate limits, ToU, `/audit` page, Cloudflare Pro.
**Result:** 50–100 actual players with verifiable data.

### Hold off
- Tier 3 (tokenize) — wait for proof the loop works
- Strategy marketplace, fancy features — wait for real complaints
- Mobile app — wait
- Custom domain — `fini-fight-club.pages.dev` is fine

---

## Decisions only you can make

1. **Treasury seeding** — pre-mint 10M to a multisig, or keep off-chain virtual? (Recommend off-chain through Tier 2.)
2. **Geographic strategy** — US users via sweepstakes mode or geo-block? (Recommend geo-block until lawyer says otherwise.)
3. **Beta cohort size** — 20 invitees or 200? (Recommend 50–100 — large enough for real data, small enough to read all feedback.)
4. **Monetization** — eventually a small "house edge" on battles? Item-shop revenue? Subscription? (TBD — first prove engagement.)

---

## Cost summary

| | Free | Tier 1 | Tier 2 | Tier 3 |
|---|---|---|---|---|
| Hosting (Pages) | $0 | $0 | $0 | $0 |
| R2 storage | $0 | $0 | $0 | $0 |
| Supabase | — | $25/mo | $25/mo | $25/mo |
| Cloudflare Pro | — | — | $20/mo | $20/mo |
| Token deploy | — | — | — | ~$1 one-time |
| Audit | — | — | — | ~$3–5k one-time |
| LP seed | — | — | — | $5–15k one-time |
| **Monthly run-rate** | $0 | $25 | $45 | $45 |
| **One-time** | $0 | $0 | $0 | $5–20k |

---

## Key files / paths

- **Repo:** https://github.com/edfornieles/fini_fight_club
- **Live URL:** https://fini-fight-club.pages.dev
- **Setup guide:** [SETUP.md](./SETUP.md)
- **Beta test guide for invitees:** [BETA_TESTING.md](./BETA_TESTING.md)
- **Backend migrations:** `supabase/migrations/`
- **Edge functions:** `supabase/functions/`
- **Snapshot import:** `scripts/import-snapshot.mjs`
- **Asset CDN env var:** `VITE_ASSET_CDN` (point at R2 public URL when wired)
- **R2 bucket:** `s3://fini-fight-club-art/` (Cloudflare R2, 1,017 files)

---

## Tier 1 = the only thing that absolutely needs doing before real testers can give meaningful feedback. Everything else is optional or sequencing.
