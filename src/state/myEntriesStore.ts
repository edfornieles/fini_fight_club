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
  /** Implied probability of the backed side at entry time (0-100). Used for
   *  Polymarket-style position valuation: shares = stake / (entryPct/100). */
  entryPct: number;
  placedAt: number;     // epoch ms — when the entry was placed
  endsAt: number;       // epoch ms — when the battle resolves
  durationMs: number;   // total battle duration (for progress bar)
  status: "open" | "won" | "lost" | "voided" | "sold";
  /** If the forecast was placed by a Strategy/Forecaster, the strategy's id. */
  strategyId?: string;
  /** Set when the player sells the position early (cash-out before resolution). */
  soldFor?: number;     // FINI$ received on early exit
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
  /** Sell an open position early at the given current value. Marks it "sold". */
  sellEntry: (battleId: string, value: number) => MyEntry | null;
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
        // Polymarket-style share payout: you "bought" stake/(entryPct/100)
        // shares, each worth 1 FINI$ if your side wins. Backing an underdog
        // (low entryPct) pays more; backing a favourite pays less.
        //   win   → stake × 100/entryPct   (50%→2×, 40%→2.5×, 70%→1.43×)
        //   void  → stake refunded
        //   loss  → 0
        const entryPct = entry.entryPct || 50;
        const won = winningSide !== null && winningSide === entry.side;
        const voided = winningSide === null;
        const payout = voided ? entry.stake : won ? Math.round(entry.stake * 100 / entryPct) : 0;
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
      sellEntry: (battleId, value) => {
        const entry = get().entries.find(e => e.battleId === battleId);
        if (!entry || entry.status !== "open") return null;
        const sold: MyEntry = {
          ...entry,
          status: "sold",
          soldFor: value,
          result: { settledAt: Date.now(), payout: value, netProfit: value - entry.stake, winningSide: null },
        };
        set(state => ({
          entries: state.entries.map(e => e.battleId === battleId ? sold : e),
        }));
        return sold;
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

/**
 * Current mark-to-market value of an open position, Polymarket-style.
 * You hold stake/(entryPct/100) shares; each is worth currentSidePct/100 now.
 *   value = stake × (currentSidePct / entryPct)
 * Entered at 45%, now 70% → 100 × 70/45 = 156. Now 30% → 100 × 30/45 = 67.
 */
export function positionValue(entry: MyEntry, currentSidePct: number): number {
  const entryPct = entry.entryPct || 50;
  if (currentSidePct <= 0) return 0;
  return Math.round(entry.stake * (currentSidePct / entryPct));
}
