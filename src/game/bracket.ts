/**
 * Single-elimination tournament bracket for Leagues.
 *
 * Instead of an instant round-robin table, a league now plays out as a
 * knockout bracket — Quarterfinals → Semifinals → Final — so there's a
 * climactic, watchable structure. Everything is resolved deterministically
 * and eagerly (same entries + seed → same bracket, forever) using the same
 * battle engine; the UI then *reveals* it stage by stage and plays the
 * player's matches in the arena.
 *
 * The money/economics are unchanged: we derive a standard `LeagueResult`
 * (champion = 1st, runner-up = 2nd) so the tested settle path in leagues.ts
 * pays out exactly as before.
 */

import type { BattleEvent, MarketSignalMap, Team } from "./types";
import type { League, LeagueResult, LeagueStanding } from "./leagues";
import { computePrizeBreakdown } from "./leagues";
import { teamFromSnapshot } from "./pvp";
import { runBattle } from "./battleEngine";
import { generateMockMarketSignals } from "./marketSignals";

export type BracketStageId = "QUARTER" | "SEMI" | "FINAL";

export const STAGE_LABEL: Record<BracketStageId, string> = {
  QUARTER: "Quarterfinals",
  SEMI: "Semifinals",
  FINAL: "Final",
};

export type BracketMatch = {
  id: string;
  /** 0-based round index (0 = first round played). */
  round: number;
  stage: BracketStageId;
  /** Position within its round (top match = 0). */
  slot: number;
  aPlayerId: string | null;
  bPlayerId: string | null;
  aName: string | null;
  bName: string | null;
  /** null until both sides are known / it's resolved. byes resolve instantly. */
  winnerPlayerId: string | null;
  loserPlayerId: string | null;
  aSurvivors: number;
  bSurvivors: number;
  totalRounds: number;
  isBye: boolean;
  /** Battle timeline; empty for byes. */
  events: BattleEvent[];
};

export type Bracket = {
  /** Power-of-two bracket size (2, 4 or 8). */
  size: number;
  rounds: number;
  /** Battle-ready team for every real entrant, keyed by playerId. */
  teamsById: Record<string, Team>;
  nameById: Record<string, string>;
  matches: BracketMatch[];
  championId: string | null;
  runnerUpId: string | null;
};

const BYE = "__bye__";

/** Standard tournament seed order for a power-of-two size (1-indexed → 0-indexed). */
function seedOrder(size: number): number[] {
  let layer = [1, 2];
  while (layer.length < size) {
    const span = layer.length * 2 + 1;
    const next: number[] = [];
    for (const x of layer) {
      next.push(x);
      next.push(span - x);
    }
    layer = next;
  }
  return layer.map((x) => x - 1);
}

function powTwoSize(n: number): number {
  if (n <= 2) return 2;
  if (n <= 4) return 4;
  return 8;
}

function stageFor(round: number, rounds: number): BracketStageId {
  const fromEnd = rounds - 1 - round;
  if (fromEnd === 0) return "FINAL";
  if (fromEnd === 1) return "SEMI";
  return "QUARTER";
}

/** Deterministic per-match seed mixing (Knuth multiplicative hash, uint32). */
function mixSeed(base: number, index: number): number {
  return (Math.imul(base ^ (index + 1), 2654435761) >>> 0) % 2_000_000_000;
}

function survivors(team: { fainted?: boolean; currentHealth: number }[]): number {
  return team.filter((f) => !f.fainted && f.currentHealth > 0).length;
}

/**
 * Build and fully resolve a knockout bracket from a league's entries.
 * Returns the bracket (for the UI) plus a LeagueResult (for settlement).
 */
export function runBracketLeague(league: League): {
  bracket: Bracket;
  result: LeagueResult;
} {
  // Seed real entrants by rating (strongest = top seed).
  const real = [...league.entries].sort(
    (a, b) => b.snapshot.rating - a.snapshot.rating,
  );
  const size = powTwoSize(real.length);
  const rounds = Math.round(Math.log2(size));

  const teamsById: Record<string, Team> = {};
  const nameById: Record<string, string> = {};
  for (const e of real) {
    teamsById[e.playerId] = teamFromSnapshot(e.snapshot);
    nameById[e.playerId] = e.snapshot.name;
  }

  // Place seeded entrants into bracket positions; empty positions are byes.
  const order = seedOrder(size);
  const positioned: (string | null)[] = new Array(size).fill(null);
  order.forEach((seedIdx, pos) => {
    positioned[pos] = seedIdx < real.length ? real[seedIdx]!.playerId : null;
  });

  const matches: BracketMatch[] = [];
  let matchCounter = 0;

  // Round 0 participants come straight from the seeded positions; later
  // rounds are filled by the winners of the previous round.
  let current: (string | null)[] = positioned;

  for (let round = 0; round < rounds; round++) {
    const stage = stageFor(round, rounds);
    const winners: (string | null)[] = [];
    for (let slot = 0; slot < current.length / 2; slot++) {
      const aId = current[slot * 2] ?? null;
      const bId = current[slot * 2 + 1] ?? null;
      const match: BracketMatch = {
        id: `m-${round}-${slot}`,
        round,
        stage,
        slot,
        aPlayerId: aId,
        bPlayerId: bId,
        aName: aId ? nameById[aId]! : null,
        bName: bId ? nameById[bId]! : null,
        winnerPlayerId: null,
        loserPlayerId: null,
        aSurvivors: 0,
        bSurvivors: 0,
        totalRounds: 0,
        isBye: !aId || !bId,
        events: [],
      };

      if (aId && bId) {
        const matchSeed = mixSeed(league.config.seed, matchCounter++);
        const signals: MarketSignalMap = generateMockMarketSignals(
          league.config.battleWindow,
          matchSeed,
        );
        const res = runBattle({
          teamA: teamFromSnapshot(league.entries.find((e) => e.playerId === aId)!.snapshot),
          teamB: teamFromSnapshot(league.entries.find((e) => e.playerId === bId)!.snapshot),
          marketSignals: signals,
          config: {
            mode: "RANKED",
            battleWindow: league.config.battleWindow,
            maxRounds: 30,
            marketInfluence: 0.65,
            statInfluence: 0.35,
            enablePassives: true,
            enableXP: false,
            liveMarket: true,
            seed: matchSeed,
          },
        });
        const aWon = res.winner === "teamA";
        match.winnerPlayerId = aWon ? aId : bId;
        match.loserPlayerId = aWon ? bId : aId;
        match.aSurvivors = survivors(res.finalTeams.teamA);
        match.bSurvivors = survivors(res.finalTeams.teamB);
        match.totalRounds = res.summary.totalRounds;
        match.events = res.events;
      } else {
        // Bye: the present side advances unopposed.
        match.winnerPlayerId = aId ?? bId ?? null;
        match.loserPlayerId = null;
      }

      matches.push(match);
      winners.push(match.winnerPlayerId ?? BYE);
    }
    current = winners;
  }

  const finalMatch = matches[matches.length - 1]!;
  const championId = finalMatch.winnerPlayerId;
  const runnerUpId = finalMatch.loserPlayerId;

  const result = buildResult(league, matches, real.map((e) => e.playerId));

  return {
    bracket: {
      size,
      rounds,
      teamsById,
      nameById,
      matches,
      championId,
      runnerUpId,
    },
    result,
  };
}

/**
 * Convert bracket outcomes into a standard LeagueResult: rank by how far each
 * entrant advanced (exit round), tie-broken by survivors then seed. Champion
 * takes 1st prize, runner-up 2nd — identical economics to the round-robin.
 */
function buildResult(
  league: League,
  matches: BracketMatch[],
  seededOrder: string[],
): LeagueResult {
  const wins: Record<string, number> = {};
  const losses: Record<string, number> = {};
  const survivorScore: Record<string, number> = {};
  const exitRound: Record<string, number> = {};

  for (const pid of seededOrder) {
    wins[pid] = 0;
    losses[pid] = 0;
    survivorScore[pid] = 0;
    exitRound[pid] = -1; // -1 = lost a real match before advancing at all
  }

  for (const m of matches) {
    if (m.isBye) {
      // A bye counts as advancing without a win contribution.
      continue;
    }
    const aId = m.aPlayerId!;
    const bId = m.bPlayerId!;
    const winnerId = m.winnerPlayerId!;
    const loserId = m.loserPlayerId!;
    wins[winnerId] = (wins[winnerId] ?? 0) + 1;
    losses[loserId] = (losses[loserId] ?? 0) + 1;
    survivorScore[aId] = (survivorScore[aId] ?? 0) + m.aSurvivors;
    survivorScore[bId] = (survivorScore[bId] ?? 0) + m.bSurvivors;
    // The loser exits at this round; the winner's exit is set later (deeper).
    exitRound[loserId] = m.round;
    exitRound[winnerId] = Math.max(exitRound[winnerId] ?? -1, m.round + 1);
  }

  const standings: LeagueStanding[] = seededOrder.map((pid) => ({
    rank: 0,
    playerId: pid,
    name: league.entries.find((e) => e.playerId === pid)!.snapshot.name,
    wins: wins[pid] ?? 0,
    losses: losses[pid] ?? 0,
    survivorScore: survivorScore[pid] ?? 0,
  }));

  const seedIndex: Record<string, number> = {};
  seededOrder.forEach((pid, i) => (seedIndex[pid] = i));

  standings.sort((a, b) => {
    const exA = exitRound[a.playerId] ?? -1;
    const exB = exitRound[b.playerId] ?? -1;
    if (exB !== exA) return exB - exA;
    if (b.survivorScore !== a.survivorScore) return b.survivorScore - a.survivorScore;
    return seedIndex[a.playerId]! - seedIndex[b.playerId]!;
  });
  standings.forEach((s, i) => (s.rank = i + 1));

  const prize = computePrizeBreakdown(
    league.config.buyIn * league.entries.length,
    league.config.prize,
  );
  const payouts: LeagueResult["payouts"] = [
    { playerId: standings[0]!.playerId, place: 1, amount: prize.firstPrize },
  ];
  if (standings.length >= 2) {
    payouts.push({ playerId: standings[1]!.playerId, place: 2, amount: prize.secondPrize });
  }

  // Flatten bracket matches into LeagueResult.matches shape for compatibility.
  const flatMatches = matches
    .filter((m) => !m.isBye)
    .map((m) => ({
      homeIndex: seedIndex[m.aPlayerId!]!,
      awayIndex: seedIndex[m.bPlayerId!]!,
      winnerPlayerId: m.winnerPlayerId!,
      loserPlayerId: m.loserPlayerId!,
    }));

  return { standings, matches: flatMatches, prize, payouts };
}
