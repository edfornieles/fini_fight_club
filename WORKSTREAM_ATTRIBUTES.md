# Workstream: Attribute & Balance System

> For the AI/engineer taking the **attributes** stream. Read `PROJECT_BRIEF.md`
> first for full context. This document is your scope, contract, and rules.

## Your goal
Turn a Fini's real on-chain traits (Family / Frequency / Clan / Special / Mythical)
into battle stats, and keep the meta fair: **no family strictly best** and the
**60–70% market / 30–40% stats** influence split intact.

You are building the "universally known attribute chart" — the deterministic rules
that make collectors care which Finis they own.

## Why this matters
We are pivoting the game to **real NFT ownership**: players bring Finis they actually
own (pulled from their wallet) and field 3. Your system decides what each owned Fini
is _worth in battle_, purely from its traits. It must be deterministic (same token →
same stats, forever — no rerolling) and balanced (owning expensive Finis must not be
auto-win).

## The seam / interface contract
The **data stream** delivers normalized traits; **you** turn them into stats. Agree
these types in `src/game/types.ts` before coding so our work merges cleanly.

```ts
// PROVIDED TO YOU (data stream emits this, already normalized):
export type FiniFrequency =
  | "Hourly" | "Daily" | "Twice-Daily" | "Weekly" | "Monthly"; // rarity, Hourly common → Monthly rarest

export type FiniTraits = {
  tokenId: number;
  family: CoinFamily;       // already mapped: "Ethereum"→"ETH", "Tezos"→"XTZ", etc.
  frequency: FiniFrequency; // rarity tier → stat budget
  clan: string;             // 146 possible values
  special?: string;         // 48 possible (rare perk)
  mythical?: string;        // 3 possible (very rare perk)
  latestDelta: number;      // live price move (real mood); informational
};

// YOU DELIVER:
export type BattleStatBlock = {
  strength: number;
  maxHealth: number;
  speed: number;
  defense: number;
  volatilityAffinity: number; // 0..1
  cuteness: number;           // 0..1, flavour/tiebreak
  passiveAbility: PassiveAbility;
};

export function traitsToStats(t: FiniTraits): BattleStatBlock;

// Fairness layer — counter-triangle multiplier applied to attacker vs defender:
export function familyMatchup(attacker: CoinFamily, defender: CoinFamily): number;
```

### Existing enums you target (from `src/game/types.ts`)
```ts
CoinFamily = "BTC" | "ETH" | "SOL" | "DOGE" | "LINK" | "UNI" | "AVAX" | "BNB" | "MATIC" | "XTZ";

PassiveAbility =
  "DIAMOND_BODY" | "COMPOUND" | "HIGH_THROUGHPUT" | "MEME_SPIKE" | "ORACLE" |
  "SWAP" | "AVALANCHE" | "FEE_BURN" | "SCALING" | "SELF_AMEND";
```
The `Fini` type already has fields: `strength, maxHealth, currentHealth, speed,
defense, volatilityAffinity, cuteness, passiveAbility`. Your `BattleStatBlock` feeds
those.

## Concrete deliverables
1. **`src/game/attributes.ts`** (new, pure, no React, no I/O):
   - `traitsToStats()` — **deterministic**. Suggested model:
     - **Family** → base identity / stat lean (e.g. BTC tanky, SOL fast, DOGE swingy).
       Also pick a sensible default `passiveAbility` per family/clan.
     - **Frequency** → **stat budget multiplier** (rarity): Hourly = baseline …
       Monthly = strongest. Keep the spread modest so rarity ≠ auto-win.
     - **Clan** (146) → maps onto one of the 10 `PassiveAbility`s + a small stat lean.
       (A grouping table is fine; you don't need 146 unique behaviours.)
     - **Special** (48) / **Mythical** (3) → rare **perks** (small extra modifier or a
       stronger passive). Most Finis have none.
     - Use `tokenId` only for tiny deterministic jitter (so clones aren't identical),
       not for power.
   - **Family counter-triangle** + `familyMatchup()` so e.g. a cycle like
     BTC > X > Y > … > BTC. Return a multiplier (~0.9–1.1) applied in damage.
2. **Engine balance hook** in `src/game/battleEngine.ts` (the ONE shared file —
   coordinate before editing): apply `familyMatchup()` in damage and confirm the
   **60–70% market / 30–40% stats** split still holds with trait-derived stats.
   The market modifiers already live there; keep market dominant.
3. **Tests** — `src/game/attributes.test.ts`:
   - Determinism: same `FiniTraits` → identical stats across runs.
   - Rarity budget: Monthly > Weekly > … > Hourly on aggregate stat total, bounded.
   - Fairness: simulate the matchup matrix across families and assert **no family
     wins > ~55%** in neutral-market mirror matchups.

## Design rules (non-negotiable)
- **Deterministic & public** — same token always yields the same stats; no rerolls.
- **Market > stats** (60–70 / 30–40). A correct market read should beat a
  statistically better team often enough to matter.
- **No family strictly best** — counter-triangle guarantees soft counters.
- **Level is up-only** — do NOT encode win/loss-down into stats. Level scaling is a
  separate concern (ELO ladder handles up/down elsewhere). `traitsToStats` is the
  base (level 1) block; the engine/xp system already scales by level.
- **Rarity is a gentle edge, not a wall** — Monthly Finis are a bit stronger, not
  unbeatable.

## File ownership (avoid merge conflicts)
- **Yours:** `src/game/attributes.ts` + `src/game/attributes.test.ts` (new).
- **Coordinate (shared):** `src/game/battleEngine.ts` (balance/matchup hook),
  `src/game/types.ts` (add `FiniTraits` / `FiniFrequency` / `BattleStatBlock` once).
- **Off-limits this phase (in flux):** `src/state/gameStore.ts`, `src/game/ownership/*`
  (data stream), and `src/components/*` (kawaii UI).

## How to validate without the data stream
You don't need live ownership to build/test this. Hand-write a few `FiniTraits`
fixtures (use the real examples below) and unit-test against them. The data stream
will feed real `FiniTraits` later; if the contract above holds, it just works.

### Real metadata examples (from `api-public.finiliar.com/metadata/{id}`)
```
#1     Family: Tezos     Frequency: Hourly  Clan: Stickies
#7777  Family: Ethereum  Frequency: Hourly  Clan: Blades
```
(Family arrives pre-mapped to tickers: Tezos→XTZ, Ethereum→ETH, Bitcoin→BTC,
Solana→SOL, Dogecoin→DOGE, Chainlink→LINK, Uniswap→UNI, Avalanche→AVAX,
Binance→BNB, Polygon→MATIC.)

## Optional 2nd task (only if capacity; coordinate first)
**Level (up-only) vs Ladder (ELO) split + Team HQ screen + match-history logging.**
Valuable but touches `gameStore.ts` and `pvp.ts` — hold until the attribute system
lands to avoid conflicts.
