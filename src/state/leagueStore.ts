import { create } from "zustand";
import {
  createLeague,
  joinLeague,
  settleLeague,
  escrowIdFor,
  computePrizeBreakdown,
  TIER_BUYINS,
  type League,
  type LeagueResult,
  type LeagueTier,
} from "../game/leagues";
import { runBracketLeague, type Bracket } from "../game/bracket";
import { mockCurrencyLedger } from "../game/currencyLedger";
import { makeSeedSnapshots, snapshotFromTeam } from "../game/pvp";
import type { Team } from "../game/types";
import { createRng } from "../game/rng";
import { bumpFiniRecord } from "../game/finiRecords";

/**
 * League store — the presentation/state slice for the central money loop.
 *
 * The pure economics live in `game/leagues.ts` + `game/currencyLedger.ts`
 * (deterministic, tested). This store holds the player-facing surface: the
 * singleton ledger, a set of seeded OPEN leagues (each pre-filled with funded
 * CPU rivals so there's a real pot), the player's balance, and the most recent
 * settled result. Kept separate from the big run/ranked `gameStore` so the
 * stakes layer stays self-contained.
 */

export const PLAYER_ID = "you";
/** Simulated balance (whole dollars; UI shows "$"). No real funds. */
export const STARTING_BALANCE = 500;
const FAUCET_AMOUNT = 100;

/** Live, seedable tiers (the higher tiers exist in logic but aren't surfaced yet). */
export const ACTIVE_TIERS: LeagueTier[] = ["BRONZE", "SILVER"];
/**
 * CPU entrants pre-seeded per tier. Seven ghosts + you = an 8-team knockout
 * bracket (Quarterfinals → Semifinals → Final), so every league plays out as
 * a full tournament the moment you join.
 */
const GHOSTS_PER_TIER: Record<LeagueTier, number> = {
  BRONZE: 7,
  SILVER: 7,
  GOLD: 7,
  DIAMOND: 7,
};

let seq = 0;

function seedLeague(tier: LeagueTier): League {
  seq += 1;
  const seed = (TIER_BUYINS[tier] || 1) * 1000 + seq;
  const league = createLeague({
    id: `lg-${tier.toLowerCase()}-${seq}`,
    tier,
    seed,
    minEntrants: 2,
    maxEntrants: 8,
  });
  // Fund + enrol CPU ghosts so the escrow pot is real and the league is
  // runnable the moment the player joins. Each ghost pays its own buy-in.
  const ghosts = makeSeedSnapshots(createRng(seed)).slice(0, GHOSTS_PER_TIER[tier]);
  ghosts.forEach((snap, i) => {
    const pid = `cpu-${tier}-${i}`;
    mockCurrencyLedger.credit(pid, league.config.buyIn);
    joinLeague({ league, entry: { playerId: pid, snapshot: snap }, ledger: mockCurrencyLedger });
  });
  return league;
}

function seedActiveLeagues(): League[] {
  return ACTIVE_TIERS.map((tier) => seedLeague(tier));
}

let creditedStarting = false;
function ensureStartingFunds(): void {
  if (creditedStarting) return;
  creditedStarting = true;
  if (mockCurrencyLedger.getBalance(PLAYER_ID) === 0) {
    mockCurrencyLedger.credit(PLAYER_ID, STARTING_BALANCE);
  }
}

export type LeagueRecord = {
  played: number;
  firsts: number;
  seconds: number;
  earnings: number;
};

export interface LeagueStoreState {
  balance: number;
  leagues: League[];
  lastResult: { leagueId: string; result: LeagueResult } | null;
  /** The knockout bracket to watch play out (set by runAndSettle). */
  activeTournament: { leagueId: string; bracket: Bracket } | null;
  record: LeagueRecord;
  message: string | null;

  /** Escrow pot (current total stake) for a league. */
  potOf: (leagueId: string) => number;
  /** Is the player already entered in this league? */
  isEntered: (leagueId: string) => boolean;

  joinWithTeam: (leagueId: string, team: Team) => string | null;
  runAndSettle: (leagueId: string) => void;
  /** Dismiss the tournament viewer (settlement already happened on run). */
  closeTournament: () => void;
  refreshOpenLeagues: () => void;
  topUp: () => void;
  clearMessage: () => void;
}

function playerBalance(): number {
  return mockCurrencyLedger.getBalance(PLAYER_ID);
}

export const useLeagueStore = create<LeagueStoreState>((set, get) => {
  ensureStartingFunds();
  return {
    balance: playerBalance(),
    leagues: seedActiveLeagues(),
    lastResult: null,
    activeTournament: null,
    record: { played: 0, firsts: 0, seconds: 0, earnings: 0 },
    message: null,

    potOf: (leagueId) => {
      const lg = get().leagues.find((l) => l.config.id === leagueId);
      if (!lg) return 0;
      return mockCurrencyLedger.escrowBalance(escrowIdFor(lg));
    },

    isEntered: (leagueId) => {
      const lg = get().leagues.find((l) => l.config.id === leagueId);
      return !!lg?.entries.some((e) => e.playerId === PLAYER_ID);
    },

    joinWithTeam: (leagueId, team) => {
      const lg = get().leagues.find((l) => l.config.id === leagueId);
      if (!lg) return "League not found.";
      const snapshot = snapshotFromTeam({
        team,
        name: "You",
        rating: 1000,
        origin: "player",
      });
      const res = joinLeague({
        league: lg,
        entry: { playerId: PLAYER_ID, snapshot },
        ledger: mockCurrencyLedger,
      });
      if (!res.ok) {
        set({ message: res.detail });
        return res.detail;
      }
      set({
        balance: playerBalance(),
        leagues: [...get().leagues],
        message: `Entered ${lg.config.name}. Pot is now $${mockCurrencyLedger.escrowBalance(escrowIdFor(lg))}.`,
      });
      return null;
    },

    runAndSettle: (leagueId) => {
      const lg = get().leagues.find((l) => l.config.id === leagueId);
      if (!lg) return;
      if (lg.status !== "OPEN") return;
      if (lg.entries.length < lg.config.minEntrants) {
        set({ message: "Not enough entrants to run yet." });
        return;
      }
      // Resolve the whole knockout bracket deterministically, then settle the
      // money exactly as before (champion = 1st, runner-up = 2nd).
      const { bracket, result } = runBracketLeague(lg);
      lg.status = "RUNNING";
      settleLeague({ league: lg, result, ledger: mockCurrencyLedger });

      // Fold the season's W/L into each fielded owned Fini's record (leagues
      // freeze snapshots, so no XP/level change — just battle history).
      const standing = result.standings.find((s) => s.playerId === PLAYER_ID);
      const myEntry = lg.entries.find((e) => e.playerId === PLAYER_ID);
      if (standing && myEntry) {
        for (const f of myEntry.snapshot.finis) {
          if (!f.id.startsWith("owned-")) continue;
          const tid = Number(f.tokenId);
          if (!Number.isFinite(tid)) continue;
          bumpFiniRecord(tid, { wins: standing.wins, losses: standing.losses });
        }
      }

      const mine = result.payouts.find((p) => p.playerId === PLAYER_ID);
      const prev = get().record;
      const record: LeagueRecord = {
        played: prev.played + 1,
        firsts: prev.firsts + (mine?.place === 1 ? 1 : 0),
        seconds: prev.seconds + (mine?.place === 2 ? 1 : 0),
        earnings: prev.earnings + (mine?.amount ?? 0),
      };

      set({
        balance: playerBalance(),
        leagues: [...get().leagues],
        lastResult: { leagueId, result },
        activeTournament: { leagueId, bracket },
        record,
        message: mine
          ? `You placed ${mine.place === 1 ? "1st 🥇" : "2nd 🥈"} — won $${mine.amount}!`
          : "You didn't place this time. Bench, retrain, return.",
      });
    },

    closeTournament: () => set({ activeTournament: null }),

    refreshOpenLeagues: () => {
      // Replace any settled/cancelled leagues with fresh open ones per tier.
      const kept = get().leagues.filter(
        (l) => l.status === "OPEN" || l.status === "RUNNING",
      );
      const tiersPresent = new Set(kept.map((l) => l.config.tier));
      const fresh = ACTIVE_TIERS.filter((t) => !tiersPresent.has(t)).map((t) =>
        seedLeague(t),
      );
      set({ leagues: [...kept, ...fresh], lastResult: null });
    },

    topUp: () => {
      mockCurrencyLedger.credit(PLAYER_ID, FAUCET_AMOUNT);
      set({ balance: playerBalance(), message: `Faucet: +$${FAUCET_AMOUNT} (simulated).` });
    },

    clearMessage: () => set({ message: null }),
  };
});

/** Display helper: whole-dollar simulated money. */
export function money(n: number): string {
  return `$${n.toLocaleString()}`;
}

export { TIER_BUYINS, computePrizeBreakdown };
