/**
 * Population simulation harness.
 *
 * Loads the REAL Finiliar ownership snapshot, turns every wallet that holds 3+
 * Finis into a "player" with a randomly-drawn 3-Fini team, then drives the REAL
 * game systems (battle engine, leagues, death matches, ELO ladder) to answer:
 *
 *   1. How many viable players does the current collection actually support?
 *   2. Is the battle system balanced (do stats matter, or is it a coin flip)?
 *   3. Do leagues + death matches resolve cleanly and conserve money?
 *   4. How many *concurrent* players do we need for good matchmaking?
 *
 * Run:  npx vite-node scripts/simulate.ts
 * Tunables (env): MATCHES_PER_TEAM, MAX_TEAMS, SEED
 *
 * Traits are generated deterministically per tokenId (we don't need live
 * metadata to test whether the *system* works — these are hypothetical teams).
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  ALL_COIN_FAMILIES,
  type CoinFamily,
  type FiniFrequency,
  type FiniTraits,
  type Fini,
  type Team,
  type BattleConfig,
} from "../src/game/types";
import { traitsToStats, validateTeamSpecials, countSpecialFinis } from "../src/game/attributes";
import { runBattle } from "../src/game/battleEngine";
import { generateMockMarketSignals } from "../src/game/marketSignals";
import { applyEloResult } from "../src/game/pvp";
import {
  createLeague,
  joinLeague,
  runLeague,
  settleLeague,
  TIER_BUYINS,
  type LeagueTier,
} from "../src/game/leagues";
import { MockCurrencyLedger } from "../src/game/currencyLedger";
import { snapshotFromTeam } from "../src/game/pvp";
import { createRng, type RNG } from "../src/game/rng";

// ───────────────────────── config ─────────────────────────
const MATCHES_PER_TEAM = Number(process.env.MATCHES_PER_TEAM ?? 12);
const MAX_TEAMS = Number(process.env.MAX_TEAMS ?? 0); // 0 = all eligible
const SEED = Number(process.env.SEED ?? 0xf101);
const rng = createRng(SEED);

// ───────────────────────── deterministic trait gen ─────────────────────────
const FREQS: FiniFrequency[] = ["Hourly", "Daily", "Twice-Daily", "Weekly", "Monthly"];
const CLANS = [
  "Stickies", "Blades", "Miners", "Sprites", "Wisps", "Coots",
  "Gourds", "Fens", "Drips", "Embers",
];

function hash(n: number): number {
  let h = (n ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

function genTraits(tokenId: number): FiniTraits {
  const h = hash(tokenId);
  const family: CoinFamily = ALL_COIN_FAMILIES[h % ALL_COIN_FAMILIES.length];
  const frequency = FREQS[(h >>> 5) % FREQS.length];
  const clan = CLANS[(h >>> 9) % CLANS.length];
  // ~8% specials, ~0.4% mythicals. Distinct names → traitsToStats hash-assigns
  // varied perk IDs across the population.
  const roll = (h >>> 13) % 1000;
  const special = roll < 80 ? `special-${tokenId}` : undefined;
  const mythical = roll >= 996 ? `mythical-${tokenId}` : undefined;
  const latestDelta = (((h >>> 20) % 400) - 200) / 1000; // -0.20..+0.20
  return { tokenId, family, frequency, clan, special, mythical, latestDelta };
}

function buildFini(tokenId: number): Fini {
  const traits = genTraits(tokenId);
  const s = traitsToStats(traits);
  return {
    id: `owned-${tokenId}`,
    tokenId: String(tokenId),
    name: `finiliar #${tokenId}`,
    family: traits.family,
    level: 1,
    xp: 0,
    strength: s.strength,
    maxHealth: s.maxHealth,
    currentHealth: s.maxHealth,
    speed: s.speed,
    defense: s.defense,
    volatilityAffinity: s.volatilityAffinity,
    cuteness: s.cuteness,
    passiveAbility: s.passiveAbility,
    ...(s.specialPerk ? { specialPerk: s.specialPerk } : {}),
    ...(s.mythicalPerk ? { mythicalPerk: s.mythicalPerk } : {}),
    ...(traits.special ? { special: traits.special } : {}),
  };
}

function power(t: Team): number {
  return t.finis.reduce((a, f) => a + f.strength + f.maxHealth + f.speed + f.defense, 0);
}

// ───────────────────────── team drafting ─────────────────────────
/** Pick 3 tokens, preferring a legal lineup (≤1 special). Returns null if <3. */
function draftTeam(owner: string, tokenIds: number[], r: RNG): { team: Team; constrained: boolean } | null {
  if (tokenIds.length < 3) return null;
  const finis = tokenIds.map(buildFini);
  // shuffle
  for (let i = finis.length - 1; i > 0; i--) {
    const j = r.int(0, i);
    [finis[i], finis[j]] = [finis[j], finis[i]];
  }
  // Greedy legal pick: take 3 with at most one special.
  const picked: Fini[] = [];
  let specials = 0;
  for (const f of finis) {
    const isSpecial = !!f.specialPerk || !!f.mythicalPerk;
    if (isSpecial && specials >= 1) continue;
    picked.push(f);
    if (isSpecial) specials++;
    if (picked.length === 3) break;
  }
  let constrained = false;
  if (picked.length < 3) {
    // Wallet can't field a legal team from a clean draw — fill anyway, flag it.
    constrained = true;
    for (const f of finis) {
      if (picked.includes(f)) continue;
      picked.push(f);
      if (picked.length === 3) break;
    }
  }
  const team: Team = {
    id: `team-${owner.slice(0, 8)}`,
    playerId: owner,
    name: `${owner.slice(0, 6)}…${owner.slice(-4)}`,
    finis: [picked[0], picked[1], picked[2]] as [Fini, Fini, Fini],
  };
  return { team, constrained: constrained || !validateTeamSpecials(picked) };
}

// ───────────────────────── battle helper ─────────────────────────
function baseConfig(seed: number): BattleConfig {
  return {
    mode: "RANKED",
    battleWindow: "1h",
    maxRounds: 30,
    marketInfluence: 0.65,
    statInfluence: 0.35,
    enablePassives: true,
    enableXP: false,
    seed,
  };
}

/** Returns { winner: 0|1, survivors } for teams[a] vs teams[b]. */
function fight(a: Team, b: Team, seed: number): { winnerIsA: boolean; winnerSurvivors: number; rounds: number } {
  const signals = generateMockMarketSignals("1h", seed);
  const res = runBattle({ teamA: a, teamB: b, marketSignals: signals, config: baseConfig(seed) });
  const winnerIsA = res.winner === "teamA";
  const winTeam = winnerIsA ? res.finalTeams.teamA : res.finalTeams.teamB;
  const survivors = winTeam.filter((f) => !f.fainted && f.currentHealth > 0).length;
  return { winnerIsA, winnerSurvivors: survivors, rounds: res.summary.totalRounds };
}

// ───────────────────────── load ownership ─────────────────────────
function loadOwnership(): Record<string, number[]> {
  const candidates = ["public/data/ownership.json", "data/ownership.json"];
  for (const rel of candidates) {
    try {
      const raw = readFileSync(resolve(process.cwd(), rel), "utf8");
      const json = JSON.parse(raw) as { byOwner?: Record<string, number[]> };
      if (json.byOwner) return json.byOwner;
    } catch {
      /* try next */
    }
  }
  throw new Error("Could not find ownership.json (looked in public/data and data).");
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function pct(n: number, d: number): string {
  return d === 0 ? "—" : `${((100 * n) / d).toFixed(1)}%`;
}

// ═════════════════════════ run ═════════════════════════
function main() {
  const t0 = Date.now();
  console.log("\n=== FINILIAR POPULATION SIMULATION ===\n");

  const byOwner = loadOwnership();
  const owners = Object.entries(byOwner);
  const heldTotal = owners.reduce((a, [, ids]) => a + ids.length, 0);
  const eligibleOwners = owners.filter(([, ids]) => ids.length >= 3);

  console.log("── Collection / population ──");
  console.log(`Wallets holding ≥1 Fini : ${owners.length}`);
  console.log(`Total Finis held         : ${heldTotal}`);
  console.log(`Wallets holding ≥3 (=players): ${eligibleOwners.length}  ← addressable player base`);
  const dist = { 3: 0, 4: 0, 5: 0, "6-9": 0, "10+": 0 } as Record<string, number>;
  for (const [, ids] of eligibleOwners) {
    if (ids.length === 3) dist[3]++;
    else if (ids.length === 4) dist[4]++;
    else if (ids.length === 5) dist[5]++;
    else if (ids.length <= 9) dist["6-9"]++;
    else dist["10+"]++;
  }
  console.log(`  by holdings: 3=${dist[3]}  4=${dist[4]}  5=${dist[5]}  6-9=${dist["6-9"]}  10+=${dist["10+"]}`);

  // Build teams
  let pool = eligibleOwners;
  if (MAX_TEAMS > 0 && pool.length > MAX_TEAMS) pool = pool.slice(0, MAX_TEAMS);
  const teams: Team[] = [];
  let constrainedCount = 0;
  let specialTeams = 0;
  for (const [owner, ids] of pool) {
    const drafted = draftTeam(owner, ids, rng);
    if (!drafted) continue;
    teams.push(drafted.team);
    if (drafted.constrained) constrainedCount++;
    if (countSpecialFinis(drafted.team.finis) >= 1) specialTeams++;
  }
  console.log(`\nTeams drafted            : ${teams.length}`);
  console.log(`  with a special/mythical: ${specialTeams} (${pct(specialTeams, teams.length)})`);
  console.log(`  special-constrained draw: ${constrainedCount} (${pct(constrainedCount, teams.length)}) ← wallets whose Finis can't all be fielded together`);

  if (teams.length < 2) {
    console.log("\nNot enough teams to simulate. Need ≥2.");
    return;
  }

  const powers = teams.map(power);
  const pMin = Math.min(...powers), pMax = Math.max(...powers), pMed = median(powers);
  console.log(`\n── Team strength (Σ STR+HP+SPD+DEF) ──`);
  console.log(`min ${pMin} · median ${pMed} · max ${pMax} · spread ${pMax - pMin}`);

  // ── ELO ladder + 1v1 balance ──
  console.log(`\n── 1v1 ladder (${MATCHES_PER_TEAM} matches/team) ──`);
  const rating = new Map<number, number>();
  teams.forEach((_, i) => rating.set(i, 1000));
  const totalMatches = Math.floor((teams.length * MATCHES_PER_TEAM) / 2);
  let higherPowerWins = 0, decided = 0, equalPower = 0;
  let survivorSum = 0, roundsSum = 0, sweeps = 0;
  for (let m = 0; m < totalMatches; m++) {
    const a = rng.int(0, teams.length - 1);
    let b = rng.int(0, teams.length - 1);
    if (b === a) b = (b + 1) % teams.length;
    const seed = hash(m * 2654435761);
    const r = fight(teams[a], teams[b], seed);
    const ra = rating.get(a)!, rb = rating.get(b)!;
    const elo = applyEloResult({ ratingA: ra, ratingB: rb, aWon: r.winnerIsA });
    rating.set(a, elo.ratingA);
    rating.set(b, elo.ratingB);

    const pa = powers[a], pb = powers[b];
    if (pa === pb) equalPower++;
    else {
      decided++;
      const higherIsA = pa > pb;
      if (higherIsA === r.winnerIsA) higherPowerWins++;
    }
    survivorSum += r.winnerSurvivors;
    roundsSum += r.rounds;
    if (r.winnerSurvivors === 3) sweeps++;
  }
  console.log(`matches played          : ${totalMatches}`);
  console.log(`higher-power team wins  : ${pct(higherPowerWins, decided)}  (≈50% = pure luck, ~65-75% = healthy skill+variance)`);
  console.log(`avg winner survivors    : ${(survivorSum / totalMatches).toFixed(2)} / 3   · 3-0 sweeps ${pct(sweeps, totalMatches)}`);
  console.log(`avg rounds per battle   : ${(roundsSum / totalMatches).toFixed(1)}  (equal-power coin-flips: ${equalPower})`);

  const ratings = [...rating.values()];
  console.log(`ELO spread after ladder : ${Math.round(Math.min(...ratings))}–${Math.round(Math.max(...ratings))} (median ${Math.round(median(ratings))})`);

  // ── matchmaking depth: nearest-rating opponent vs concurrent pool size ──
  console.log(`\n── Matchmaking depth (median nearest-ELO gap by concurrent pool) ──`);
  console.log(`   target: a fresh opponent within ~50 ELO for a fair, fast queue`);
  const sortedRatings = [...ratings].sort((a, b) => a - b);
  const sampleSizes = [10, 25, 50, 100, 200, 500].filter((n) => n <= teams.length);
  if (!sampleSizes.includes(teams.length)) sampleSizes.push(teams.length);
  for (const n of sampleSizes) {
    // average the median adjacent gap over several random subsamples
    const trials = 12;
    let acc = 0;
    for (let t = 0; t < trials; t++) {
      const pick = sampleK(sortedRatings, n, rng).sort((a, b) => a - b);
      const gaps: number[] = [];
      for (let i = 1; i < pick.length; i++) gaps.push(pick[i] - pick[i - 1]);
      acc += median(gaps);
    }
    const g = acc / trials;
    const verdict = g <= 50 ? "good" : g <= 120 ? "ok" : "thin";
    console.log(`  ${String(n).padStart(4)} concurrent → median gap ${g.toFixed(0).padStart(4)} ELO  [${verdict}]`);
  }

  // ── leagues ──
  console.log(`\n── Leagues (real leagues.ts + ledger; pot conservation check) ──`);
  const ledger = new MockCurrencyLedger();
  for (const tier of ["BRONZE", "SILVER", "GOLD"] as LeagueTier[]) {
    const sizes = [4, 6, 8];
    for (const size of sizes) {
      if (teams.length < size) continue;
      const runs = 20;
      let houseTotal = 0, conserved = 0, playerWinShare = 0;
      for (let k = 0; k < runs; k++) {
        const lg = createLeague({ id: `${tier}-${size}-${k}`, tier, seed: hash(k + size), minEntrants: 2, maxEntrants: size });
        const entrants = sampleIdx(teams.length, size, rng);
        for (const idx of entrants) {
          const pid = teams[idx].playerId + ":" + idx;
          ledger.credit(pid, TIER_BUYINS[tier]);
          const snap = snapshotFromTeam({ team: { ...teams[idx], playerId: pid }, name: teams[idx].name, rating: 1000 });
          joinLeague({ league: lg, entry: { playerId: pid, snapshot: snap }, ledger });
        }
        const result = runLeague(lg);
        settleLeague({ league: lg, result, ledger });
        const paid = result.payouts.reduce((a, p) => a + p.amount, 0);
        if (paid + result.prize.houseCut === result.prize.pool) conserved++;
        houseTotal += result.prize.houseCut;
        playerWinShare += result.payouts[0].amount / TIER_BUYINS[tier];
      }
      const buyIn = TIER_BUYINS[tier];
      console.log(
        `  ${tier.padEnd(6)} ${size}p · buy-in $${buyIn} · pot $${buyIn * size} · ` +
        `1st place ROI ${(playerWinShare / runs).toFixed(1)}× buy-in · house/league $${(houseTotal / runs).toFixed(1)} · ` +
        `conserves ${pct(conserved, runs)}`,
      );
    }
  }

  // ── death matches ──
  console.log(`\n── Death matches (winner takes a staked Fini) ──`);
  const dmRuns = Math.min(2000, totalMatches);
  let upsets = 0, dmDecided = 0, dmHigherWins = 0;
  for (let k = 0; k < dmRuns; k++) {
    const a = rng.int(0, teams.length - 1);
    let b = rng.int(0, teams.length - 1);
    if (b === a) b = (b + 1) % teams.length;
    const r = fight(teams[a], teams[b], hash(k * 40503 + 7));
    const pa = powers[a], pb = powers[b];
    if (pa !== pb) {
      dmDecided++;
      const higherIsA = pa > pb;
      if (higherIsA === r.winnerIsA) dmHigherWins++; else upsets++;
    }
  }
  console.log(`  ${dmRuns} death matches · favourite wins ${pct(dmHigherWins, dmDecided)} · upsets ${pct(upsets, dmDecided)}`);
  console.log(`  → high upset% = scary/volatile stakes (degens love it, whales hate it); low% = whales dominate`);

  // ── bottom line ──
  console.log(`\n── BOTTOM LINE ──`);
  const eligible = eligibleOwners.length;
  console.log(`• Addressable players from the live collection: ${eligible} wallets (hold ≥3).`);
  console.log(`• These are WALLETS, not humans or daily-actives — treat as the supply ceiling, not DAU.`);
  console.log(`• Matchmaking: see the table above — you need enough *concurrent* teams to keep the`);
  console.log(`  nearest-ELO gap small. Async ghosts (already built) let you reuse stored teams, so`);
  console.log(`  effective concurrency = active teams + recent ghosts.`);
  console.log(`• Leagues fill fine at 4-8 entrants; with ${eligible} eligible you could run`);
  console.log(`  ~${Math.floor(eligible / 8)} eight-player leagues at once if all were active.`);
  console.log(`• This is exactly why Tier-1 minted Finis matter: ${eligible} wallets caps you hard;`);
  console.log(`  uncapped Tier-1 teams are what make matchmaking + leagues reliably full.`);
  console.log(`\n(done in ${((Date.now() - t0) / 1000).toFixed(1)}s · seed ${SEED} · ${MATCHES_PER_TEAM} matches/team)\n`);
}

// sample k distinct indices in [0, n)
function sampleIdx(n: number, k: number, r: RNG): number[] {
  const idx = new Set<number>();
  while (idx.size < Math.min(k, n)) idx.add(r.int(0, n - 1));
  return [...idx];
}
function sampleK<T>(arr: T[], k: number, r: RNG): T[] {
  if (k >= arr.length) return [...arr];
  return sampleIdx(arr.length, k, r).map((i) => arr[i]);
}

main();
