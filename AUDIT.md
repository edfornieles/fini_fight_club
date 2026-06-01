# Project Audit — make it rational & light

> Goal we're building toward: a **two-tier game** — open-play funnel (roll
> off-chain game-Finis → paid Leagues) + holder **Death Match**, with
> **Explore** (Family→Clan) and **Collection**, on the clean 2D Finiliar brand.
> Everything is measured against that. Date: 2026-05-31.

## TL;DR

The codebase is sound but carries weight from earlier directions (a 3D engine,
a Super-Auto-Pets roguelike) that no longer serve the goal. Cutting them makes
the project dramatically lighter without losing anything we want.

| # | Finding | Action | Status |
|---|---------|--------|--------|
| 1 | **3D stack** (`three`+`three-stdlib`+`stats-gl`+`@react-three/*`+`@types/three`+`hls.js`) ≈ **5 GB of 12 GB** node_modules, dominant bundle weight, used by **one** placeholder component. Design is 2D. | Replaced `ThreeBattleStage` with a 2D lightning-split stage (same API); removed the 4 deps from `package.json`. | ✅ **DONE** |
| 2 | **SAP "Adventure" run-loop** — `shop`/`items`/`encounters`/`enemyGenerator` + `ShopScreen`/`EncounterScreen`/`RunHUD`/`RunResultScreen` + run state in `gameStore`. | **KEEP** (owner decision, 2026-05-31) as an optional **Adventure mode**. Don't delete; just isolate it cleanly (see #3) so it's opt-in, not load-bearing. | ✅ keep |
| 3 | **`gameStore.ts` = 1,170 lines** — a god-store mixing run/ranked/death/ownership. | Split by domain (or it shrinks a lot once #2 goes). | 🔶 agent |
| 4 | **5 floating corner overlays** (Stable, Leagues, Codex, Explore + run HUD). | Consolidate into the Figma **bottom pill-nav** (home·search·crown·profile). | 🔶 agent |
| 5 | **Redundant screens** — `BattleResult`/`RunResult`/`RankedResult`/`Victory`/`GameOver`; `MarketTodayPanel`+`MarketSignalPanel`+`marketData`+`dailyRegime`+`marketSignals`. | Collapse to one result screen + one market module. | 🔶 agent |
| 6 | **node_modules = 12 GB** (exFAT block-size inflates this, but 3D was real). | After #1, run `npm install` (clean) → expect ~1–2 GB. | 🔶 do on APFS |
| 7 | **Dev env is broken on the drive** — `/Volumes/Oom` remounted under macOS **fskit exFAT**, which hangs native binaries (esbuild) → vite won't start. | Develop from an **APFS copy** (`~/finiliar-run`, set up). The repo stays the source of truth; run/build from APFS. | ✅ workaround live |

## What is core (keep, it's lean & tested)

`attributes` · `leagues` · `currencyLedger` · `funnel` · `gameFinis` ·
`taxonomy` · `battleEngine` · `pvp`/`pvpStorage` · `deathMode` · `finiRecords` ·
`marketSignals` (one of them) · wallet/* · `ExploreOverlay` · `CollectionCodex`.
These map 1:1 to the two-tier vision. 140 tests green.

## Recommended order of operations

1. ✅ Drop 3D (done) → `npm install` on APFS to reclaim disk.
2. ✅ **Adventure mode stays** (owner decision). Don't cut it — but *isolate* it:
   move its run state into a `runStore` slice so it's an opt-in mode, not woven
   through the core store. Adventure becomes one nav destination among the rest.
3. Bottom pill-nav replaces the 5 overlays (Figma): Adventure · Leagues ·
   Explore · Collection · Profile/Stable.
4. Slim `gameStore` by extracting the run/Adventure slice (it keeps its logic,
   just stops being load-bearing for Leagues/Death Match/ownership).
5. One result screen, one market module.

## The "rational" shape we're aiming for

```
Acquire:  Stable (real NFTs)  +  Roll (off-chain game-Finis, funnel)
Compete:  Leagues ($ loop)    +  Death Match (holder stakes)
Browse:   Explore (Family→Clan)  +  Collection (per-token)
Shell:    one bottom nav · clean 2D brand · slim domain stores
```

Each box is a system we already have or have specced. The audit is mostly about
**removing the two things that aren't in this picture** (3D engine, SAP run).
