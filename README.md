# Fini Fight Club

A Fini NFT auto-battler + crypto prediction arena built on the Finiliar collection (ETH mainnet `0x5a01…6480`).

Two halves of one game:

- **Fight Club** — SAP-style auto-battler. Pick 3 Finis from your wallet, equip items, fight 3v3 against power-matched ghost teams seeded from the full 1,712-holder snapshot. Win Crumbs 🍪 to spend on tactical items.
- **Crypto Arena** — Polymarket-style prediction battles on live BTC / ETH / SOL / DOGE / BNB / LINK / AVAX / UNI / MATIC / XTZ prices. Stake FINI$ 🪙, watch odds compress as resolution approaches, get paid out from the loser's pot.

## Stack

- **Frontend:** React 18 + Vite + TypeScript + Zustand + react-router
- **Wallet:** wagmi + viem + RainbowKit + SIWE
- **Prices:** Multi-source (CoinGecko + Coinbase + Binance) with median aggregation, basis-point spread checks
- **Backend (prod):** Supabase Postgres + Edge Functions (Deno) — see `SETUP.md`
- **Backend (dev):** Pure client-side simulation against `public/data/ownership.json` snapshot

## Dev

```bash
npm install --legacy-peer-deps
npm run dev        # vite dev server on :5173
npm run build      # tsc + vite build → dist/
npm run preview    # serve the built dist/
```

For dev/local testing without Supabase:
- Append `?dev=1` to any URL to enable the **DEV impersonation panel** (bottom-right)
- Pick a holder wallet from the quick-pick list (or paste any 0x address)
- All 1,712 holders' Finis load from the static `ownership.json` snapshot

## Game design

- Starting bank **1,000 FINI$**, stake **100 per battle** — SAP-style restrained economy
- Run until **bust** (balance < 100 → modal forces restart, Fini XP/items wiped)
- **Crumbs** 🍪 are a separate tactical currency for items, potions, rerolls (30 starting, +25 per win, +10 per loss)
- Opponent matching: ghost teams scaled to match player's actual battle stats (HP/ATK/DEF/SPD + item bonuses), targeting ~50% baseline win rate
- Crypto-arena odds compress near resolution using live-price-driven fair odds + late-stage bot bursts

## Project layout

```
src/
├── pages/        Route-level views (FightClubPage, CryptoArenaPage, BattlePage, …)
├── components/   Reusable widgets
├── game/         Battle engine, ghost-opponent matchmaker, Fini types
├── state/        Zustand stores (coinStore, crumbStore, finiRecords, myBets, …)
├── data/         Static seeds (mockBattles, cryptoSim, taxonomy)
├── lib/          Price providers, API client, Supabase glue
└── hooks/        useLivePrices, useSiweAuth, useTicker

supabase/
├── migrations/   Schema (users, battles, predictions, claims, ledger)
└── functions/    Edge functions (siwe, claim, predict, resolve, battle-factory)

scripts/          One-off node scripts (snapshot import, ghost-teams seed, …)
public/data/      On-chain snapshot + ghost teams (committed)
```

## Deployment

See [SETUP.md](./SETUP.md) for the full Supabase + Vercel deployment guide.
