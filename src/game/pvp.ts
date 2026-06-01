import {
  ALL_COIN_FAMILIES,
  type CoinFamily,
  type Fini,
  type PassiveAbility,
  type Team,
} from "./types";
import type { RNG } from "./rng";
import { createRng } from "./rng";

/**
 * Async PvP via team snapshots.
 *
 * There is no live netcode here — and there doesn't need to be. Like
 * Super Auto Pets, every player's team is frozen into a *snapshot* and
 * dropped into a shared pool. When you queue, you fight a snapshot of a
 * real team near your rating. The pool lives in localStorage today; the
 * exact same shape can be served by a backend later (see pvpStorage.ts).
 *
 * This module is pure: ELO math, opponent selection, snapshot creation,
 * and seed data. No storage, no React.
 */

export type TeamSnapshot = {
  id: string;
  /** display handle for the team's owner */
  name: string;
  rating: number;
  finis: [Fini, Fini, Fini];
  createdAt: number;
  origin: "seed" | "player";
  wins: number;
  losses: number;
};

export type PvpProfile = {
  name: string;
  rating: number;
  wins: number;
  losses: number;
  /** current win/loss streak, signed (+3 = three wins in a row) */
  streak: number;
};

export const DEFAULT_RATING = 1000;
export const ELO_K = 32;

export function makeDefaultProfile(name = "You"): PvpProfile {
  return { name, rating: DEFAULT_RATING, wins: 0, losses: 0, streak: 0 };
}

// ─────────────────────────────────────────────────────────────────────────
// ELO
// ─────────────────────────────────────────────────────────────────────────

/** Probability that A beats B given their ratings. */
export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}

/**
 * New rating after a match. `score` is 1 for a win, 0 for a loss.
 * Returns the integer-rounded rating.
 */
export function nextRating(
  rating: number,
  opponentRating: number,
  score: 0 | 1,
  k: number = ELO_K,
): number {
  const expected = expectedScore(rating, opponentRating);
  return Math.round(rating + k * (score - expected));
}

/** Symmetric ELO update for both sides of a match. */
export function applyEloResult(args: {
  ratingA: number;
  ratingB: number;
  aWon: boolean;
  k?: number;
}): { ratingA: number; ratingB: number; deltaA: number; deltaB: number } {
  const { ratingA, ratingB, aWon } = args;
  const k = args.k ?? ELO_K;
  const newA = nextRating(ratingA, ratingB, aWon ? 1 : 0, k);
  const newB = nextRating(ratingB, ratingA, aWon ? 0 : 1, k);
  return {
    ratingA: newA,
    ratingB: newB,
    deltaA: newA - ratingA,
    deltaB: newB - ratingB,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Opponent selection
// ─────────────────────────────────────────────────────────────────────────

/**
 * Pick an opponent snapshot near the player's rating. We take the N
 * closest by rating and choose randomly among them so the ladder feels
 * fresh instead of always serving the single nearest team.
 */
export function pickOpponent(args: {
  pool: TeamSnapshot[];
  rating: number;
  excludeIds?: string[];
  rng?: RNG;
  windowSize?: number;
}): TeamSnapshot | null {
  const { pool, rating } = args;
  const rng = args.rng ?? createRng();
  const exclude = new Set(args.excludeIds ?? []);
  const candidates = pool.filter((s) => !exclude.has(s.id));
  if (candidates.length === 0) return null;

  const windowSize = Math.min(args.windowSize ?? 5, candidates.length);
  const closest = [...candidates]
    .sort(
      (a, b) => Math.abs(a.rating - rating) - Math.abs(b.rating - rating),
    )
    .slice(0, windowSize);
  return rng.pick(closest);
}

// ─────────────────────────────────────────────────────────────────────────
// Snapshots
// ─────────────────────────────────────────────────────────────────────────

let snapshotCounter = 0;

/** Freeze a live battle team into a rated snapshot for the pool. */
export function snapshotFromTeam(args: {
  team: Team;
  name: string;
  rating: number;
  origin?: "seed" | "player";
}): TeamSnapshot {
  const finis = args.team.finis.map((f) => ({
    ...f,
    currentHealth: f.maxHealth,
    fainted: false,
  })) as [Fini, Fini, Fini];
  snapshotCounter += 1;
  return {
    id: `snap-${Date.now().toString(36)}-${snapshotCounter}`,
    name: args.name,
    rating: args.rating,
    finis,
    createdAt: Date.now(),
    origin: args.origin ?? "player",
    wins: 0,
    losses: 0,
  };
}

/** Convert a snapshot back into a battle-ready Team. */
export function teamFromSnapshot(snap: TeamSnapshot): Team {
  return {
    id: `team-${snap.id}`,
    playerId: snap.id,
    name: snap.name,
    finis: snap.finis.map((f) => ({
      ...f,
      currentHealth: f.maxHealth,
      fainted: false,
    })) as [Fini, Fini, Fini],
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Seed pool — kawaii rivals so the ladder is never empty
// ─────────────────────────────────────────────────────────────────────────

const FAMILY_PASSIVE: Record<CoinFamily, PassiveAbility> = {
  BTC: "DIAMOND_BODY",
  ETH: "COMPOUND",
  SOL: "HIGH_THROUGHPUT",
  DOGE: "MEME_SPIKE",
  LINK: "ORACLE",
  UNI: "SWAP",
  AVAX: "AVALANCHE",
  BNB: "FEE_BURN",
  MATIC: "SCALING",
  XTZ: "SELF_AMEND",
};

const KAWAII_NAMES = [
  "Mochi Squad",
  "Boba Gang",
  "Pastel Panic",
  "Cloud Nibblers",
  "Sugar Wick",
  "Plushie Protocol",
  "Tiny Bonk",
  "Marshmallow Maxi",
  "Sleepy Candles",
  "Puff Validators",
  "Bubble Bears",
  "Kitten Liquidity",
];

const KAWAII_FINI_NAMES = [
  "Pip",
  "Bean",
  "Nibble",
  "Pudding",
  "Tofu",
  "Sprinkle",
  "Dango",
  "Wisp",
  "Pebble",
  "Cotton",
];

function makeSnapshotFini(
  family: CoinFamily,
  rating: number,
  rng: RNG,
  idTag: string,
): Fini {
  // Higher-rated rivals get stronger stat blocks.
  const power = 1 + (rating - DEFAULT_RATING) / 800; // ~0.75–1.75
  return {
    id: `seedfini-${idTag}-${Math.floor(rng.next() * 1e9)}`,
    tokenId: `${1000 + Math.floor(rng.next() * 9000)}`,
    name: rng.pick(KAWAII_FINI_NAMES),
    family,
    level: 1 + Math.floor(Math.max(0, (rating - DEFAULT_RATING) / 250)),
    xp: 0,
    strength: Math.round((5 + rng.range(0, 4)) * power),
    maxHealth: Math.round((16 + rng.range(0, 10)) * power),
    currentHealth: 1,
    speed: Math.round((3 + rng.range(0, 5)) * power),
    defense: Math.round((2 + rng.range(0, 4)) * power),
    volatilityAffinity: 0.3 + rng.next() * 0.6,
    cuteness: 0.5 + rng.next() * 0.5,
    passiveAbility: FAMILY_PASSIVE[family],
  };
}

/**
 * Build a spread of rival snapshots across the rating range so a fresh
 * player always has someone to fight near their level.
 */
export function makeSeedSnapshots(rng: RNG = createRng()): TeamSnapshot[] {
  const ratings = [820, 900, 950, 1000, 1040, 1090, 1150, 1220, 1300, 1400, 1500];
  return ratings.map((rating, i) => {
    const finis = Array.from({ length: 3 }, (_, slot) =>
      makeSnapshotFini(rng.pick(ALL_COIN_FAMILIES), rating, rng, `${i}-${slot}`),
    ) as [Fini, Fini, Fini];
    return {
      id: `seed-${i}`,
      name: KAWAII_NAMES[i % KAWAII_NAMES.length]!,
      rating,
      finis,
      createdAt: 0,
      origin: "seed" as const,
      wins: 0,
      losses: 0,
    };
  });
}

/** Sorted top-N leaderboard view, with the player optionally injected. */
export function leaderboard(
  pool: TeamSnapshot[],
  player?: { id: string; name: string; rating: number },
  limit = 10,
): { id: string; name: string; rating: number; isPlayer: boolean }[] {
  const rows = pool.map((s) => ({
    id: s.id,
    name: s.name,
    rating: s.rating,
    isPlayer: false,
  }));
  if (player) {
    rows.push({ ...player, isPlayer: true });
  }
  return rows.sort((a, b) => b.rating - a.rating).slice(0, limit);
}
