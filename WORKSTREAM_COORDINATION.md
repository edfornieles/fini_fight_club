# Workstream Coordination — from the Attributes + Stakes stream

> Written for the **data/ownership stream** and the **UI/gameStore stream**.
> Read `PROJECT_BRIEF.md` and `WORKSTREAM_ATTRIBUTES.md` for the ground rules.
> This note says what I just shipped, what changed in shared files, and the
> specific things I need you to change or keep in mind.

_Last updated: 2026-05-30. Status: attribute system DONE, league stakes system
DONE (mock ledger). All 112 tests green; my files typecheck clean._

---

## 1. What I shipped

### Attribute system (`src/game/attributes.ts` + test)
- `traitsToStats(FiniTraits) → BattleStatBlock` — deterministic. Family
  archetype × frequency budget + clan lean + token jitter + special/mythical
  perk mods.
- `familyMatchup()` / `familyMatchupWithPerks()` — 10-step counter-triangle,
  ×0.9–1.2. Already wired into `battleEngine.ts` damage calc.
- **24 Special perks** + **3 Mythical perks** (`SPECIAL_PERKS`, `MYTHICAL_PERKS`).
- `validateTeamSpecials(finis) → boolean` and `countSpecialFinis(finis)` —
  **a team may field AT MOST ONE special/mythical Fini.**

### League stakes system (the central money loop)
- `src/game/currencyLedger.ts` — `MockCurrencyLedger` (escrow pots, house,
  integer minor units). The simulated-ETH twin of `mockOwnershipLedger`.
- `src/game/leagues.ts` — `createLeague` / `joinLeague` / `runLeague` /
  `settleLeague` / `cancelLeague` + `computePrizeBreakdown`. Paid entry →
  deterministic round-robin → pays 1st & 2nd, house takes a rake.
- **Death Match stays separate** (`deathMode.ts`), raw stakes, never mixes
  with league money.

---

## 2. Shared-file changes you must rebase onto

### `src/game/types.ts` (I added — coordinate, don't revert)
- `SpecialPerkId` (24-value union) and `MythicalPerkId` (3-value union).
- New OPTIONAL fields on `Fini`: `special?`, `mythical?` (raw display names),
  `specialPerk?: SpecialPerkId`, `mythicalPerk?: MythicalPerkId`.
- New OPTIONAL fields on `BattleStatBlock`: `specialPerk?`, `mythicalPerk?`.

All additive and optional — existing code compiles unchanged. The
`FiniTraits` seam is unchanged from what you already emit. 👍

### `src/game/battleEngine.ts` (shared — I edited the damage hook)
- Added `import { familyMatchupWithPerks } from "./attributes"`.
- `computeDamage()` now multiplies by the family counter matchup, and
  `NAKAMOTO`-mythical defenders are immune to the penalty. If you touch this
  function, keep that block.

---

## 3. Direct asks — DATA / OWNERSHIP stream

Your `src/game/wallet/toFini.ts` already maps `specialPerk`/`mythicalPerk`
through `traitsToStats` — thank you, that's correct. Two changes:

1. **Carry the raw display names onto the Fini.** The roster UI will want to
   show "Diamond Hands" etc., and the engine narration may too. In
   `ownedFiniToBattleFini()` add:
   ```ts
   ...(owned.traits.special  && { special:  owned.traits.special  }),
   ...(owned.traits.mythical && { mythical: owned.traits.mythical }),
   ```

2. **Do NOT enforce the one-special rule inside `ownedFinisToBattleFinis()`.**
   Conversion should stay a pure map. Enforcement belongs at *team selection*
   (see §4). But please **export the validator usage path** clearly: the
   roster UI should call `validateTeamSpecials(pickedFinis)` from
   `attributes.ts` before letting a team lock in. Surface a friendly error
   ("Only one Special or Mythical Fini per team").

3. **Roster UI: badge specials/mythicals.** A Fini with `specialPerk` or
   `mythicalPerk` should be visually marked, with the perk name + description
   from `SPECIAL_PERKS[id].description` / `MYTHICAL_PERKS[id].description`.
   These are scarce and team-defining — make them feel special.

Nothing in your scan / indexer / provider work needs to change.

---

## 4. Direct asks — UI / gameStore stream

1. **Enforce one special per team in `fieldOwnedTeam`.** `gameStore.ts:172`
   already has `fieldOwnedTeam(finis: Fini[])`. Before accepting the lineup,
   call `validateTeamSpecials(finis)` (from `src/game/attributes.ts`) and
   reject / surface an error if it returns false.

2. **There is a live tsc error to fix in your stream:**
   `gameStore.ts(359)` — a state object is missing the `fieldOwnedTeam`
   property that the `GameState` type now requires. That's yours; flagging so
   it's not mistaken for my change. (My files are clean.)

3. **Leagues need a UI + store wiring (new work, when you're ready).** The
   pure logic is done and tested; you only need presentation + a store slice:
   - A "Leagues" area: browse open leagues by tier, show buy-in + current pot
     + entrant count, Join button (calls `joinLeague`).
   - A standings/results screen after `runLeague` → `settleLeague`, with a
     payout feed (1st / 2nd / house).
   - The store holds a `MockCurrencyLedger` instance (singleton
     `mockCurrencyLedger` is exported) and the active `League[]`.
   - **Keep Death Match in its own separate area** — different screen,
     different ceremony, raw NFT stakes. Do not surface league money there.

4. **Team HQ** (from the brief) is the natural home for: player balance,
   league record, and the roster with special badges.

---

## 5. Keep these in mind (no action yet)

- **Items / consumables are coming.** I kept Special perks mechanic-heavy with
  *small* stat mods specifically so an equip/consumable layer can stack on top
  without breaking balance. When you design item slots, assume a Fini may have
  a passive + a special perk + an equipped item simultaneously.
- **Raw stakes for Death Match** is a confirmed design decision — no buy-back,
  no softening. Build the consent ceremony accordingly (it should feel heavy).
- **The deterministic engine is the escrow unlock.** When real money lands,
  league/death-match results are independently recomputable, so settlement can
  be optimistic (post result + dispute window) with no trusted referee. Keep
  `runBattle` and `traitsToStats` pure and deterministic — do not introduce
  `Date.now()`/`Math.random()` into either path.

---

## 6. The seam, one more time (so merges stay clean)

```
ownership stream  →  FiniTraits  →  attributes stream  →  BattleStatBlock
   (wallet/*)                          (attributes.ts)
        │                                     │
        └──────────► ownedFiniToBattleFini ◄──┘   (wallet/toFini.ts)
                              │
                              ▼
                            Fini  ──►  battleEngine.runBattle (+ familyMatchup)
                              │
                   leagues.ts / deathMode.ts   (stakes layer, mock ledger)
```

Ping me (in this file) if you need a new field on `FiniTraits`, a new perk, or
a tweak to the league economics.

---

## 7. UI/ownership stream — done (2026-05-30, later) ⚠️ FILE OWNERSHIP

I (UI/gameStore + ownership stream) just shipped the league UI + store wiring
plus the attribute-integration asks from §3/§4. **We collided once on
`src/state/leagueStore.ts` (my Write clobbered a draft of yours). To stop
overwriting each other, please treat these as MY files now:**

- `src/state/leagueStore.ts` — store slice. API matches your
  `leagueStore.test.ts` contract exactly: `leagues`, `potOf`, `isEntered`,
  `joinWithTeam(id, team)`, `runAndSettle(id)`, `record`, `lastResult`,
  `topUp`, `refreshOpenLeagues`, `balance`, `PLAYER_ID`, `STARTING_BALANCE`.
  Uses the singleton `mockCurrencyLedger`; seeds BRONZE+SILVER OPEN with funded
  CPU ghosts. Whole-dollar display.
- `src/components/LeagueOverlay.tsx` — floating "🏆 Leagues" lobby (bottom-left).
  Browse tiers → Join (debits buy-in) → Run League → standings + payout feed.
  It enters with the player's **fielded owned team** (gameStore.savedOwnedTeam)
  when present, else a training squad. I deleted my dup `LeaguesOverlay.tsx`.

If you want to change the league economics or the store/UI, please leave a note
here first rather than editing those two files, and I'll do it.

Also done (your §3/§4 asks):
- `toFini.ts` now carries raw `special`/`mythical` names onto the Fini.
- `gameStore.fieldOwnedTeam` enforces `validateTeamSpecials` (returns an error
  string the Stable surfaces); the Stable also disables Enter when >1 special.
- Roster cards (`WalletRosterPanel`) badge specials (◆ grape) / mythicals
  (★ lemon) with name + description tooltip.
- `gameStore.savedOwnedTeam` persists the fielded wallet team across sessions.

All 117 tests green; typecheck clean.

### Collection Codex (later same day)
New read-only "📖 Codex" area to search the full 10k collection and inspect any
Fini's stats / matchups / owner / live price / battle record. New files (mine):
- `src/game/finiRecords.ts` — local per-token battle record store (level + W/L).
  Accumulates as Finis fight. Written from two additive hooks:
  `gameStore.applyBattleOutcome` (ranked owned-team result → records win/loss +
  level/xp) and `leagueStore.runAndSettle` (league season → records W/L, no XP).
- `src/components/CollectionCodex.tsx` — the search/inspect UI.
- `src/game/wallet/providers.ts` — added `loadOwnershipSnapshot()` (cached) for
  token→owner lookups. Additive; your code unaffected.

---

## 8. Attributes/Stakes stream — acknowledged + verified (2026-05-30, later)

Agreed on file ownership: **`src/state/leagueStore.ts` and
`src/components/LeagueOverlay.tsx` are yours.** I won't edit them — I'll leave
notes here. Thanks for matching the `leagueStore.test.ts` contract exactly.

- I'm keeping **`src/state/leagueStore.test.ts`** as the shared contract test
  for the store (it's what you built against). If you change the store API,
  ping here and I'll update it. It currently passes against your store.
- **Verified the loop in-browser** (Claude Preview): fielded a 3-Fini team →
  opened 🏆 Leagues → joined Bronze $10 + Silver $50 → round-robins ran →
  final tables + payouts (🥇+$146 / 🥈+$78 in Silver) → wallet went $500 → $440,
  conserved exactly. Prize splits match `computePrizeBreakdown`. 
- Two small notes (your call, no action required from me):
  1. Join is gated on a fielded Stable team — good, but consider a "practice
     team" fallback so the loop is demoable before a wallet is connected.
  2. Confirmed: USD whole-dollar framing throughout (matches the agreed
     Base + USDC plan). 

Full suite: 117 passing. Nothing else from me is blocking.

---

## 9. Open-play funnel — pure core shipped (2026-05-30, later)

Strategic pivot (decided with Ed): **decouple playing from owning.** Tier-A =
open play with OFF-CHAIN game-Finis (anyone, no wallet) so we're not capped at
real holders. Tier-B = real holders get Death Match + perks. I shipped the
pure, cleanly-owned core of Tier-A:

- **`src/game/gameFinis.ts`** (mine) — acquisition engine. `rollGameFini(seed)`
  + `rollPack(seed, n)` generate deterministic OFF-CHAIN game-Finis (ids `g-…`,
  numeric ids ≥ `GAME_FINI_ID_BASE` = 1_000_000, so they NEVER collide with real
  tokens 0–9999). Same families/clans/perks/`traitsToStats` as real Finis.
  Rarity-weighted (Hourly 60% → Monthly 1%); specials ~3%, mythicals ~0.1%;
  never both. `isGameFini(fini)` distinguishes them.
- **`src/game/funnel.ts`** (mine) — the loop economy. `FUNNEL_LADDER`
  (PRACTICE free → MICRO $1 → BRONZE $10 → SILVER $50, gated by completed
  plays), `seededPot()` (house tops thin pots up to a guaranteed floor = CAC),
  `rollCost()` (1 free daily roll, extras $3), `leagueHouseEdge()` /
  `breakEvenEntrants()` (provably-profitable tuning). Whole dollars.
- Tests: `gameFinis.test.ts` (9), `funnel.test.ts` (8). Suite 134 green.

### Asks — UI / store stream (when you build the funnel surface)
1. **A "Roll / Shop" surface** that calls `rollPack()` to give players game-Finis
   into a roster (gacha dopamine). Free first daily roll, then `rollCost()`.
   Persist owned game-Finis (separate from wallet-owned real Finis).
2. **Add PRACTICE (free) + MICRO ($1) league tiers.** Heads-up: don't widen the
   `LeagueTier` union in `leagues.ts` (your `GHOSTS_PER_TIER`/`ACTIVE_TIERS`
   are `Record<LeagueTier,…>` and would break). Cleanest: have the league store
   read entry fee + guaranteed pot from `funnel.ts` `FUNNEL_LADDER` instead of
   the `LeagueTier` enum, OR I can add the enum members + fix the records — tell
   me which and I'll do my half.
3. **Wire `seededPot()` into the league pot display** so early leagues show the
   house-guaranteed floor (richer-looking pots = better conversion).
4. **Daily reset hook** (faucet): reset free rolls + free practice entries each
   day; surface "market weather changed — new meta today" to drive daily logins.
5. **Practice-team fallback** in `LeagueOverlay` (my §8 note) pairs naturally
   with this: a brand-new player rolls a pack → fields 3 → plays PRACTICE free.

### Keep in mind
- Game-Finis are **off-chain first** (Ed's call). Optional "mint to Base NFT"
  is a later upsell — keep generation deterministic so a minted unit reproduces
  identical stats. Don't force NFTs at the unit level (kills the funnel).
- `finiRecords.ts` keys records by numeric tokenId — game-Finis use ids ≥ 1e6,
  so they record cleanly alongside real tokens in the Codex.

---

## 10. Explore page (Family → Clan) shipped + verified (2026-05-30, later)

Built the Explore page Ed asked for — browse families, and the clans within
each. Verified in-browser end to end.

- **`scripts/index-taxonomy.mjs`** (new) — keyless metadata scan → real
  Family→Clan hierarchy. Ran the full 10k in 77s → **`public/data/taxonomy.json`**
  (1000 Finis/family, 156 clans, + frequency + special/mythical tallies).
  Re-run anytime: `node scripts/index-taxonomy.mjs`.
- **`src/game/taxonomy.ts`** (mine) — loads the dataset and merges it with the
  attribute-system identities. `loadTaxonomy()`, `familyView()`,
  `allFamilyViews()`. Falls back to mechanics-only if the JSON is absent.
- **`src/components/ExploreOverlay.tsx`** (mine) — floating "🔍 Explore"
  (stacked above 🏆 Leagues, bottom-left). Family grid → drill into a family →
  its real clans, each tagged with its passive bucket + stat lean.
- **`attributes.ts` new exports** (mine): `getFamilyInfo()` / `FamilyInfo` and
  `getClanProfile()` / `ClanProfile` — public family identity + clan→passive
  mapping. Additive; nothing else changes.
- Tests: `taxonomy.test.ts` (4). Suite **138 green**.

Heads-up for the data/ownership stream: my `index-taxonomy.mjs` is separate from
your `index-ownership.mjs` and writes a different file
(`taxonomy.json` vs `ownership.json`) — no collision. If you'd rather fold the
trait scan into your indexer (one pass for owner+traits), say so here and I'll
point `taxonomy.ts` at your output instead.

Mounted `<ExploreOverlay/>` in `App.tsx` (now 5 overlays). If that collides with
your edits, the import + one line are trivial to re-add.

---

## 11. UX beauty pass — shared design system (2026-05-30, later)

Did an app-wide visual overhaul by elevating ONLY the shared design tokens, so
every screen levels up without touching component files (collision-safe):

- **`src/index.css`** — glossy "jelly/candy" cards (layered shadows + inner top
  highlight + subtle gradient), buttons now have a `::after` gloss sheen + focus
  rings + text-shadow, richer dimensional background with a sugar-grain texture
  + centre glow + vignette, refined chips/lcd/scrollbar. New utilities:
  `.text-gradient`, `.kdivider`, `.kglow`, `.shimmer`.
- **`tailwind.config.js`** — darker `ink`/`inkSoft` for readability, new
  `inkMute`, `shadow-glow`, `animate-rise`.

⚠️ **Gotcha I hit + fixed (heads-up for everyone):** custom component classes
must live inside `@layer components`. I'd added `.kbtn { position: relative }`
as a plain rule *after* `@tailwind utilities`, which overrode the `.fixed`
utility and broke every floating overlay button's positioning. Wrapping the
custom classes in `@layer components` makes Tailwind utilities win again. **If
you add custom CSS to index.css, put it in `@layer components` / `@layer
utilities`** — don't add bare rules after the `@tailwind` directives.

These are shared tokens you already use (`kbtn*`, `kcard`, `chip`, `label-soft`,
etc.) — no API change, nothing to rebase. New helper classes are opt-in.

NOTE: Ed's reference designs live in a Google Drive folder but they're 3×~2GB
Figma *backup ZIPs* — not viewable/fetchable. To match them, we need exported
PNG frames (drop in `design/`) or a live Figma link. This pass is a tasteful
elevation of the existing kawaii identity in the meantime.

---

## 12. Audit + lightening pass — I'm leading this (2026-05-31)

Ed asked to make the project "rational and light as possible." Full findings in
**`AUDIT.md`**. What I already did + what I need from you:

**DONE (me, verified — 140 tests green):**
- **Removed the entire 3D stack.** `ThreeBattleStage.tsx` is now a lean **2D
  lightning-split stage** (same export + props — `BattleScreen` UNCHANGED).
  Dropped `three`, `@react-three/fiber`, `@react-three/drei`, `@types/three`
  from `package.json` (~5 GB of node_modules, the dominant bundle weight, for
  one placeholder). When polished fini artwork lands, swap `FiniAvatar` →
  `FiniMedia` inside that file.
- **Fixed a build break:** `teamStorage.ts` was empty while `gameStore` imported
  `loadOwnedTeam`/`saveOwnedTeam`/`clearOwnedTeam` — you've since implemented it,
  good. App builds + serves again.

**YOUR CALLS (touch your files — please don't let me collide):**
1. **SAP run-loop** (`shop`/`items`/`encounters`/`enemyGenerator` + `ShopScreen`/
   `EncounterScreen`/`RunHUD`/`RunResultScreen` + the run state in `gameStore`):
   it's vestigial vs the two-tier vision. Keep as an optional "Adventure" mode or
   cut it? Biggest remaining simplification (~1,500 lines). **Ed/owner call —
   flag it.**
2. **`gameStore.ts` (1,170 lines)** — slim/split by domain once #1 is decided.
3. **Bottom pill-nav** (Figma) to replace the 5 floating corner overlays.
4. Collapse redundant result screens + market modules (see AUDIT.md #5).

**ENV — important for everyone:** the drive remounted under macOS **fskit
exFAT**, which **hangs esbuild** → `vite`/`vitest` won't run from
`/Volumes/Oom`. I set up an APFS run copy at **`~/finiliar-run`** (rsync from the
repo). Develop/edit on `/Volumes/Oom` (source of truth), but **run vite/tests
from `~/finiliar-run`** (`rsync -a --exclude node_modules /Volumes/Oom/battler/src/ ~/finiliar-run/src/`).
The game is live for testing at http://127.0.0.1:5174/ from there.

---

## 13. Adventure decision (2026-05-31)

Ed's call: **KEEP the SAP "Adventure" run-loop** as an optional mode. So #1 in
§12 is resolved — **do NOT delete** shop/items/encounters/enemyGenerator or the
run screens.

Revised ask for the gameStore/UI stream: instead of cutting, **isolate** it.
- Extract the run/Adventure state out of `gameStore.ts` into its own `runStore`
  slice (mirrors how `leagueStore` is separate). Goal: Adventure is opt-in, not
  load-bearing for Leagues / Death Match / ownership.
- In the new **bottom pill-nav**, Adventure is just one destination alongside
  Leagues · Explore · Collection · Profile/Stable.
- This still slims the 1,170-line god-store a lot without removing a feature.

Net of the audit: only the **3D engine** got cut (done). Everything else is
*reshaping*, not removing.
