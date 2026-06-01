/**
 * Single-elimination tournament bracket — the watchable league format.
 *
 * Turns a field of entrants into a knockout: Quarterfinals → Semifinals →
 * Final. Standard seeding keeps the top seeds apart until late rounds. Each
 * match resolves through the deterministic battle engine, so the whole bracket
 * is reproducible from one seed, and the UI can play matches out one at a time.
 *
 * Pure: no React, no I/O. The store drives playback; this just computes.
 */

import type { BattleResult, BattleWindow, MarketSignalMap } from "./types";
import type { LeagueEntry } from "./leagues";
import { teamFromSnapshot } from "./pvp";
import { quickBattle } from "./battleEngine";
import { generateMockMarketSignals } from "./marketSignals";

export type BracketMatch = {
  id: string;
  round: number; // 0 = first round (e.g. QF), last round = final
  slot: number; // index within the round
  /** playerIds of the two competitors, or null while still TBD. */
  aId: string | null;
  bId: string | null;
  winnerId?: string;
  result?: BattleResult;
  /** Where this match's winner advances. */
  next?: { matchId: string; side: "a" | "b" };
};

export type Bracket = {
  entrants: LeagueEntry[];
  byId: Record<string, LeagueEntry>;
  rounds: BracketMatch[][];
  battleWindow: BattleWindow;
  seed: number;
  championId?: string;
};

// ─────────────────────────────────────────────────────────────────────────
// Seeding
// ─────────────────────────────────────────────────────────────────────────

/** Standard bracket seed order for a power-of-two field (1-based seeds). */
export function seedOrder(n: number): number[] {
  let order = [1, 2];
  while (order.length < n) {
    const span = order.length * 2 + 1;
    const next: number[] = [];
    for (const s of order) {
      next.push(s);
      next.push(span - s);
    }
    order = next;
  }
  return order;
}

function isPowerOfTwo(n: number): boolean {
  return n >= 2 && (n & (n - 1)) === 0;
}

export function roundName(round: number, totalRounds: number): string {
  const fromEnd = totalRounds - 1 - round;
  if (fromEnd === 0) return "Final";
  if (fromEnd === 1) return "Semifinal";
  if (fromEnd === 2) return "Quarterfinal";
  return `Round ${round + 1}`;
}

// ─────────────────────────────────────────────────────────────────────────
// Build
// ─────────────────────────────────────────────────────────────────────────

/**
 * Build an empty bracket with the first round seeded. Entrants are seeded by
 * snapshot rating (desc); the field must be a power of two (8 for a league).
 */
export function createBracket(args: {
  entrants: LeagueEntry[];
  seed: number;
  battleWindow?: BattleWindow;
}): Bracket {
  const { entrants, seed } = args;
  if (!isPowerOfTwo(entrants.length)) {
    throw new Error(`Bracket needs a power-of-two field, got ${entrants.length}.`);
  }
  const battleWindow = args.battleWindow ?? "1h";

  // Seed by rating desc (stable on playerId for ties → deterministic).
  const seeded = [...entrants].sort(
    (a, b) => b.snapshot.rating - a.snapshot.rating || a.playerId.localeCompare(b.playerId),
  );
  const order = seedOrder(seeded.length); // 1-based seed positions, bracket order

  const totalRounds = Math.log2(seeded.length);
  const rounds: BracketMatch[][] = [];
  for (let r = 0; r < totalRounds; r++) {
    const count = seeded.length / 2 ** (r + 1);
    const round: BracketMatch[] = [];
    for (let s = 0; s < count; s++) {
      round.push({ id: `m-${r}-${s}`, round: r, slot: s, aId: null, bId: null });
    }
    rounds.push(round);
  }

  // Fill round 0 from the seed order (pairs of consecutive seeds).
  for (let i = 0; i < order.length; i += 2) {
    const match = rounds[0][i / 2];
    match.aId = seeded[order[i] - 1].playerId;
    match.bId = seeded[order[i + 1] - 1].playerId;
  }

  // Wire winners forward: match (r, s) feeds (r+1, floor(s/2)) into a or b.
  for (let r = 0; r < totalRounds - 1; r++) {
    for (const m of rounds[r]) {
      m.next = { matchId: `m-${r + 1}-${Math.floor(m.slot / 2)}`, side: m.slot % 2 === 0 ? "a" : "b" };
    }
  }

  const byId: Record<string, LeagueEntry> = {};
  for (const e of entrants) byId[e.playerId] = e;

  return { entrants, byId, rounds, battleWindow, seed, championId: undefined };
}

// ─────────────────────────────────────────────────────────────────────────
// Play
// ─────────────────────────────────────────────────────────────────────────

export function allMatches(bracket: Bracket): BracketMatch[] {
  return bracket.rounds.flat();
}

export function findMatch(bracket: Bracket, id: string): BracketMatch | undefined {
  return allMatches(bracket).find((m) => m.id === id);
}

/** The next match that's ready to play (both competitors known, no winner yet). */
export function nextPlayableMatch(bracket: Bracket): BracketMatch | undefined {
  return allMatches(bracket).find((m) => m.aId && m.bId && !m.winnerId);
}

export function isComplete(bracket: Bracket): boolean {
  return !!bracket.championId;
}

/** Deterministic per-match signals + seed so every match is reproducible. */
function matchSeed(bracketSeed: number, round: number, slot: number): number {
  return (Math.imul(bracketSeed ^ ((round + 1) * 73856093 + (slot + 1) * 19349663), 2654435761) >>> 0) % 2_000_000_000;
}

/**
 * Resolve one match: run the battle, return the BattleResult (with its event
 * timeline for playback). Does NOT mutate the bracket — call recordResult to
 * advance the winner once playback finishes.
 */
export function playMatch(bracket: Bracket, match: BracketMatch): BattleResult {
  if (!match.aId || !match.bId) throw new Error(`Match ${match.id} is not ready.`);
  const a = bracket.byId[match.aId];
  const b = bracket.byId[match.bId];
  const seed = matchSeed(bracket.seed, match.round, match.slot);
  const signals: MarketSignalMap = generateMockMarketSignals(bracket.battleWindow, seed);
  return quickBattle({
    teamA: teamFromSnapshot(a.snapshot),
    teamB: teamFromSnapshot(b.snapshot),
    signals,
    seed,
  });
}

/**
 * Record a finished match: set the winner, advance them into the next round
 * (or crown the champion). Returns the winner's playerId.
 */
export function recordResult(bracket: Bracket, matchId: string, result: BattleResult): string {
  const match = findMatch(bracket, matchId);
  if (!match) throw new Error(`No match ${matchId}.`);
  const winnerId = result.winner === "teamA" ? match.aId! : match.bId!;
  match.winnerId = winnerId;
  match.result = result;

  if (match.next) {
    const target = findMatch(bracket, match.next.matchId)!;
    if (match.next.side === "a") target.aId = winnerId;
    else target.bId = winnerId;
  } else {
    bracket.championId = winnerId; // final
  }
  return winnerId;
}

/** Convenience: the player's path so the UI can highlight it. */
export function matchesFor(bracket: Bracket, playerId: string): BracketMatch[] {
  return allMatches(bracket).filter((m) => m.aId === playerId || m.bId === playerId);
}
