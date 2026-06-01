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
}

interface MyEntriesState {
  entries: MyEntry[];
  add: (entry: Omit<MyEntry, "placedAt" | "status"> & { placedAt?: number; status?: MyEntry["status"] }) => void;
  remove: (battleId: string) => void;
  /** Wipe everything (used by the run-restart flow). */
  clearAll: () => void;
  /** Returns the user's open entry on a given battle if any. */
  getForBattle: (battleId: string) => MyEntry | undefined;
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
    }),
    { name: "fini-myentries-v1" }
  )
);
