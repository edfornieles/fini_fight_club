# Finiliar Battler — Project Brief

> Self-contained briefing. No prior chat context required.

## 1. What it is
A prototype **auto-battler game** for the **Finiliar** NFT project (10,000 living
creature NFTs by Ed Fornieles; each is bonded to a cryptocurrency and visibly
changes mood as that coin's price moves — happy/buoyant when up, sad/sick when
down). The game blends **Super Auto Pets** (draft a team, auto-resolved combat),
**Auto Chess** (synergies), and **crypto-market simulation**, while keeping
Finiliar's cute, emotional spirit.

**One-line pitch:** _Collect living market-creatures, send your best three into
battle, and win by reading the market better than your opponent._

**Core principle:** battle outcomes are ~**60–70% market conditions** and
~**30–40% character stats**, so skill (reading the market) beats raw wallet size.

## 2. Tech stack & repo
- **React 18 + TypeScript + Vite**, **Tailwind CSS**, **Zustand** (state),
  **React Three Fiber / Three.js** (3D stage, placeholder geometry), **Vitest**.
- Pure game logic in `src/game/*` (zero React deps, deterministic Mulberry32 RNG,
  unit-tested). UI in `src/components/*`. State in `src/state/gameStore.ts`.
- Repo on external drive `/Volumes/Oom/battler`; dev server `http://127.0.0.1:5174/`.
  (Vite cache redirected to `/tmp/finiliar-vite-cache` due to exFAT permission quirks.)
- **No real money / no NFT transfers** — everything mock/simulated; clear Web3
  extension points left.

## 3. What's already built
- **Battle engine** — deterministic, market-influenced damage; 10 passive
  abilities; XP/levelling; narrated battle log; battle events.
- **Run loop (SAP-style)** — lives, gold, shop (buy/roll/lock/sell), items/treats,
  stages, procedural encounters (Fight / Boss / Shop / Rest / Treasure / Death Match),
  enemy generation.
- **Market systems** — real **CoinGecko** price feed (LIVE) with mock fallback; a
  **daily market regime** ("weather": Risk-on/off, Volatile, Choppy + hot/cold
  families); a **pre-battle "market read"** (call a family; if it's pumping at
  battle time the whole team gets +15% attack, no penalty if wrong).
- **Async PvP / Ranked** — drafted teams freeze into **snapshots** ("ghosts") in a
  pool; ELO ratings; opponent matched near your rating; leaderboard; localStorage
  persistence. (Single-machine, no backend yet; ghosts only fight when a human queues.)
- **Death Mode** — simulated high-stakes mode; each side stakes a Fini, winner
  "claims" it (mock ledger only, no real transfer).
- **Kawaii UI** — pastel candy theme; `Fredoka`/`Nunito` fonts; rounded puffy cards;
  squishy buttons; a `FiniAvatar` SVG blob face with **market-driven moods**
  (happy/ok/sad/KO); Tamagotchi-style LCD market readout; expressive faces on the 3D
  blobs; real pixel-art kawaii GIFs as mascots on title/victory/game-over.

## 4. Design direction (pivot to real ownership)
Moving from disposable SAP units to **real NFT ownership**:

- **You own Finis (from your wallet), field 3, bench the rest. Never "sell" them.**
  The "sell for gold" mechanic is wrong for owned assets → replace with
  **bench/lineup management**. Per-run variety comes from items + optional
  **temporary "free agents"** (unowned Finis borrowed for one run so f2p players can
  still field 3).
- **Two distinct numbers (important):**
  - **Fini Level** — belongs to the creature, **up-only** (earned via XP), never
    degrades. Protects NFT value; avoids loss-aversion that stops people playing.
  - **Ladder Rank (ELO)** — belongs to the player, goes **up and down**, drives
    matchmaking + bragging rights.
- **Matchmaking:** bracket by team strength, refine on a **hidden power score** =
  f(levels, base attributes, items) — _not_ just sum-of-levels (too gameable).
- **Anti pay-to-win:** family **counter-triangle** (no family strictly best); keep
  owned-stat influence small vs. market + skill; whales matched with whales.
- **"Utility → price":** universally-known attributes mean useful Finis gain
  secondary-market value — on-brand, but balance changes effectively move real NFT
  prices (favor telegraphed, seasonal changes).
- **Team identity ("Team HQ"):** editable team name, emblem, stats
  (record/win-rate/streak/peak rating), roster (owned Finis, levels, fielded vs
  benched), and a **match-history feed** (needs adding — only aggregate W/L stored now).
- **Offline defense (parked):** team is safe — being fought while away never damages
  owned Finis; if surfaced later, make it upside-only with a "while you were away" report.

## 5. On-chain integration — VERIFIED, NO API KEY NEEDED
All ownership + identity + live-market data is **public and keyless**:

- **Contract:** Finiliar (FINI), ERC-721, Ethereum mainnet
  `0x5a0121a0a21232ec0d024dab9017314509026480`. **Not** ERC721Enumerable.
- **Free public RPCs that work** (no key): `https://ethereum-rpc.publicnode.com`,
  `https://eth.drpc.org`, `https://1rpc.io/eth`. (Cloudflare/llamarpc flaky; ankr now
  needs a key.)
- **Reads confirmed:** `ownerOf(tokenId)` works; `tokenURI(id)` →
  `https://api-public.finiliar.com/metadata/{id}`.
- **Public metadata API** returns per token: `Family` (the coin), `Frequency`
  (Hourly→Monthly = rarity), `Clan`, plus rare `Special` (48) and `Mythical` (3); the
  artwork (`image`/`animation_url` on Arweave `ar://…` → `https://arweave.net/…`);
  `background` color; **and live `latestPrice` + `latestDelta` + `priceHistory`**
  (each NFT's real current mood — possibly removes the need for a separate feed).
- **Trait taxonomy (OpenSea holders page):** Family 10 · Frequency 5 · Clan 146 ·
  Special 48 · Mythical 3.
- **Family naming mismatch:** metadata uses full names (Ethereum, Tezos, …); the game
  uses tickers (`ETH`, `XTZ`, …). The data stream normalizes this.
- **Wallet → tokens:** not Enumerable, so plan a one-time **`ownerOf` scan of tokenIds
  0–9,999** (batched JSON-RPC, ~minutes) → cached `tokenId → owner` map; per-wallet =
  filter. (Alt: per-wallet `Transfer`-log scan.)
- **Validation wallet:** `0xff3dc70f41c60008ea17b03dcbad843abec43ea3` — confirmed via
  `balanceOf` to own **8 Finiliar**.

## 6. Build status — data stream

**DONE (data stream):**
1. ✅ **Keyless ownership indexer** — `scripts/index-ownership.mjs` (`npm run index:ownership`).
   Batched JSON-RPC `ownerOf` scan with multi-RPC failover, zero deps. Full **10,000**
   tokens (ids 0–9999) scanned → **1,712 owners**. Writes `data/ownership.json` and
   publishes a copy to `public/data/ownership.json` (so Vite serves it at runtime).
   Reconciled: example wallet shows exactly its **8** tokens, matching live `balanceOf`.
2. ✅ **`OwnershipProvider` interface** + 3 impls in `src/game/wallet/`:
   - `MockOwnershipProvider` (no network, deterministic — Free Mode / offline dev),
   - `SnapshotOwnershipProvider` (lists from the prebuilt snapshot + live metadata),
   - `LiveOwnershipProvider` (snapshot listing + on-chain `ownerOf` verification).
   `resolveProvider()` picks snapshot, falls back to mock. All read-only/keyless.
3. ✅ **Metadata normalization** — `src/game/wallet/normalize.ts` maps the public
   metadata payload → `FiniTraits` (family-name→ticker, frequency, clan, special,
   mythical, `latestDelta`) + `OwnedFini` (artwork `ar://`→gateway, price). Unit-tested.
4. ✅ **Read-only wallet roster UI** — `WalletRosterPanel` + `StableOverlay` (floating
   "👛 Stable" button on every screen). Paste an address → see owned Finis → pick 3 →
   confirm. Browser-validated against the example wallet (all 8 with correct traits).
   - **Real wallet artwork** via `FiniMedia`: plays each Fini's actual animated **mp4**
     (≈375 KB, streams fast) → falls back to the **gif** (≈3.8 MB) → then the SVG
     `FiniAvatar`. Each media type walks an ordered list of **Arweave gateways**
     (`permagate.io`, `ar-io.dev`, then `arweave.net` last — arweave.net currently 404s
     Finiliar's path-manifest assets). Muted video-only autoplay is forced imperatively
     to dodge the browser autoplay race; off-screen clips pause to save power.
5. ✅ **Shared types** added to `src/game/types.ts`: `FiniFrequency`, `FiniTraits`,
   `BattleStatBlock` (the seam the attributes stream builds against).

**INTEGRATED with the attributes stream (✅ landed):**
- `src/game/wallet/toFini.ts` — `ownedFiniToBattleFini()` calls the attributes stream's
  `traitsToStats()` to turn an owned NFT into a battle-ready `Fini` (stats + clan-derived
  passive + special/mythical perks).
- `gameStore.fieldOwnedTeam(finis)` — drops the 3 owned Finis into the ranked `teamSlots`,
  so the existing battle pipeline (which already applies `familyMatchup()` + perks in
  `computeDamage`) runs unchanged.
- `StableOverlay` shows each pick's trait-derived STR/HP/SPD/DEF + archetype + passive +
  perk, then "⚔️ Enter Ranked Battle" fields them. Browser-validated full loop: load wallet
  → pick 3 → trait stats shown → ranked shop with owned team → Queue Match → live battle
  → ELO update (won +14 → 1034).

**NEXT:**
- Optional WalletConnect (replace paste-address); `verifyOnChain` toggle in the UI.
- Persist a chosen owned team as the player's ranked snapshot identity.
- Re-run `npm run index:ownership` periodically (or move to `Transfer`-log deltas) to
  keep the snapshot fresh.

> Note: `npm run build` (`tsc -b`) is currently red only because `src/game/attributes.test.ts`
> imports `MYTHICAL_PERKS` without using it (attributes stream's file). The dev server +
> all gameplay are unaffected; that one-line unused import is theirs to clear.

## 7. Open decisions
- Bench: purely inactive, or contributes (aura / mid-run reserve sub)?
- Temporary "free agents" yes/no (f2p variety vs. ownership-only)?
- Exact trait → stat formulas; how Special/Mythical act as perks.
- In-game market layer: use each Fini's real `latestDelta` (purest) vs. existing
  CoinGecko/regime system?
- Read-only address first vs. full wallet-connect now.

## 8. Parallel workstreams
- **Data stream (✅ landed):** ownership indexer + snapshot, wallet→Finis,
  metadata normalization, roster UI. Lives in **`src/game/wallet/*`** (not
  `ownership/*` — the existing `src/game/ownership.ts` holds the Death-Mode mock
  ledger), `scripts/index-ownership.mjs`, `src/components/WalletRosterPanel.tsx` +
  `StableOverlay.tsx`.
- **Attribute stream (see `WORKSTREAM_ATTRIBUTES.md`):** trait→stats + family
  counter-triangle + engine balance. Owns `src/game/attributes.ts` (in progress).
- **Shared/coordinate:** `battleEngine.ts` (balance hook), `types.ts` — the
  `FiniTraits`/`FiniFrequency`/`BattleStatBlock` seam is now committed there.
  **Off-limits during this phase:** `gameStore.ts`, kawaii UI components (both in flux).

> **Integration handshake:** the roster UI emits `OwnedFini[]` whose `.traits` is a
> ready `FiniTraits`. As soon as `traitsToStats(traits)` exists, fielding a team is a
> straight `traits → BattleStatBlock → Fini` mapping — no rework on either side.
