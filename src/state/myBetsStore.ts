/**
 * MyBets — the user's active predictions across the Crypto Arena.
 * Persisted to localStorage so they survive reloads and navigation. When the
 * real backend is wired up this is the local cache mirror of the server's
 * `predictions` table.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface MyBet {
  battleId: string;
  battleTitle: string;
  side: "A" | "B";
  sideLabel: string;
  stake: number;
  placedAt: number;     // epoch ms — when the bet was placed
  endsAt: number;       // epoch ms — when the battle resolves
  durationMs: number;   // total battle duration (for progress bar)
  status: "open" | "won" | "lost" | "voided";
}

interface MyBetsState {
  bets: MyBet[];
  add: (bet: Omit<MyBet, "placedAt" | "status"> & { placedAt?: number; status?: MyBet["status"] }) => void;
  remove: (battleId: string) => void;
  /** Wipe everything (used by the run-restart flow). */
  clearAll: () => void;
  /** Returns the user's open bet on a given battle if any. */
  getForBattle: (battleId: string) => MyBet | undefined;
}

export const useMyBets = create<MyBetsState>()(
  persist(
    (set, get) => ({
      bets: [],
      add: (bet) => set(state => {
        // If a bet on this battle already exists, replace it (idempotent).
        const filtered = state.bets.filter(b => b.battleId !== bet.battleId);
        return {
          bets: [{
            ...bet,
            placedAt: bet.placedAt ?? Date.now(),
            status: bet.status ?? "open",
          }, ...filtered],
        };
      }),
      remove: (battleId) => set(state => ({ bets: state.bets.filter(b => b.battleId !== battleId) })),
      clearAll: () => set({ bets: [] }),
      getForBattle: (battleId) => get().bets.find(b => b.battleId === battleId),
    }),
    { name: "fini-mybets-v1" }
  )
);
