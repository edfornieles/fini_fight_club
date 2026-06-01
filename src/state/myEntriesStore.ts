/**
 * My Entries — the user's active battle predictions across the Crypto Arena.
 *
 * Persisted to localStorage so they survive reloads and navigation. When the
 * real backend is wired up this is the local cache mirror of the server's
 * `predictions` table.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface MyEntry {
  battleId: string;
  battleTitle: string;
  side: "A" | "B";
  sideLabel: string;
  stake: number;
  placedAt: number;     // epoch ms — when the entry was placed
  endsAt: number;       // epoch ms — when the battle resolves
  durationMs: number;   // total battle duration (for progress bar)
  status: "open" | "won" | "lost" | "voided";
  /** If the forecast was placed by a Strategy/Forecaster, the strategy's id. */
  strategyId?: string;
  /** Set when the battle resolves. Payout in FINI$ (0 for losses). */
  result?: {
    settledAt: number;
    payout: number;       // FINI$ paid to the user (0 if lost, stake refund if void)
    netProfit: number;    // payout - stake (negative for losses)
    winningSide: "A" | "B" | null;  // null = void/draw
  };
}

interface MyEntriesState {
  entries: MyEntry[];
  add: (entry: Omit<MyEntry, "placedAt" | "status"> & { placedAt?: number; status?: MyEntry["status"] }) => void;
  remove: (battleId: string) => void;
  /** Wipe everything (used by the run-restart flow). */
  clearAll: () => void;
  /** Returns the user's open entry on a given battle if any. */
  getForBattle: (battleId: string) => MyEntry | undefined;
  /** Settle an open entry. winningSide=null means void/draw (stake refunded). */
  resolveEntry: (battleId: string, winningSide: "A" | "B" | null) => MyEntry | null;
  /** Drop settled entries older than maxAgeMs to keep the list tidy. */
  pruneSettled: (maxAgeMs: number) => void;
}

export const useMyEntries = create<MyEntriesState>()(
  persist(
    (set, get) => ({
      entries: [],
      add: (entry) => set(state => {
        // If an entry on this battle already exists, replace it (idempotent).
        const filtered = state.entries.filter(b => b.battleId !== entry.battleId);
        return {
          entries: [{
            ...entry,
            placedAt: entry.placedAt ?? Date.now(),
            status: entry.status ?? "open",
          }, ...filtered],
        };
      }),
      remove: (battleId) => set(state => ({ entries: state.entries.filter(b => b.battleId !== battleId) })),
      clearAll: () => set({ entries: [] }),
      getForBattle: (battleId) => get().entries.find(b => b.battleId === battleId),
      resolveEntry: (battleId, winningSide) => {
        const entry = get().entries.find(e => e.battleId === battleId);
        if (!entry || entry.status !== "open") return null;
        // Payout rules: winner gets 2× stake. Void/draw refunds the stake.
        // Loser gets nothing — stake already spent.
        const won = winningSide !== null && winningSide === entry.side;
        const voided = winningSide === null;
        const payout = voided ? entry.stake : won ? entry.stake * 2 : 0;
        const netProfit = payout - entry.stake;
        const settled: MyEntry = {
          ...entry,
          status: voided ? "voided" : won ? "won" : "lost",
          result: { settledAt: Date.now(), payout, netProfit, winningSide },
        };
        set(state => ({
          entries: state.entries.map(e => e.battleId === battleId ? settled : e),
        }));
        return settled;
      },
      pruneSettled: (maxAgeMs) => {
        const now = Date.now();
        set(state => ({
          entries: state.entries.filter(e =>
            e.status === "open" || !e.result || (now - e.result.settledAt) < maxAgeMs
          ),
        }));
      },
    }),
    { name: "fini-myentries-v1" }
  )
);
