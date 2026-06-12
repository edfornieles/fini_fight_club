/**
 * My Entries — the user's active battle predictions, per wallet.
 *
 * Each connected/impersonated wallet keeps its OWN list of entries. Switching
 * accounts in DevWalletSwitcher (or via a real MetaMask connect) swaps the
 * active list — every dev/bot/holder you "play as" has its own track record.
 * Persisted to localStorage so they survive reloads.
 *
 * Shape (v2):
 *   entriesByWallet: Record<wallet, MyEntry[]>
 *   activeWallet:    the wallet whose list is "live"
 *   entries:         mirror of the active wallet's list (for components
 *                    that read `s.entries` directly — kept in sync on every
 *                    mutation so React subscriptions still fire correctly)
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { supabase, isOnline } from "../lib/supabase";

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
  soldFor?: number;     // CUTE$ received on early exit
  /** Set when the battle resolves. Payout in CUTE$ (0 for losses). */
  result?: {
    settledAt: number;
    payout: number;       // CUTE$ paid to the user (0 if lost, stake refund if void)
    netProfit: number;    // payout - stake (negative for losses)
    winningSide: "A" | "B" | null;  // null = void/draw
  };
}

interface MyEntriesState {
  /** All entries, keyed by the owning wallet. */
  entriesByWallet: Record<string, MyEntry[]>;
  /** The wallet whose entries are currently "active". */
  activeWallet: string | null;
  /** Mirror of the active wallet's entries — so existing `s.entries` reads keep working. */
  entries: MyEntry[];

  /** Switch the active wallet (called when the player impersonates a dev/bot or
   *  connects a real wallet). Creates an empty list if unseen. */
  useWallet: (wallet: string) => void;

  add: (entry: Omit<MyEntry, "placedAt" | "status"> & { placedAt?: number; status?: MyEntry["status"] }) => void;
  remove: (battleId: string) => void;
  /** Wipe everything for the active wallet (used by the run-restart flow). */
  clearAll: () => void;
  /** Returns the active wallet's entry on a given battle if any. */
  getForBattle: (battleId: string) => MyEntry | undefined;
  /** Settle an open entry. winningSide=null means void/draw (stake refunded). */
  resolveEntry: (battleId: string, winningSide: "A" | "B" | null) => MyEntry | null;
  /** Settle an open entry from SERVER truth: the server's prediction status +
   *  pari-mutuel payout (used when online — never recompute the payout locally). */
  settleServer: (battleId: string, serverStatus: string, payout: number) => MyEntry | null;
  /** Sell an open position early at the given current value. Marks it "sold". */
  sellEntry: (battleId: string, value: number) => MyEntry | null;
  /** Drop settled entries older than maxAgeMs (active wallet only). */
  pruneSettled: (maxAgeMs: number) => void;
}

/** Merge entries: replace by battleId if present, otherwise prepend (idempotent). */
function upsert(arr: MyEntry[], entry: MyEntry): MyEntry[] {
  const filtered = arr.filter(b => b.battleId !== entry.battleId);
  return [entry, ...filtered];
}

/** Mutate the active wallet's list AND keep the mirror in sync. */
function mutateActive(get: () => MyEntriesState, set: (partial: Partial<MyEntriesState>) => void, fn: (list: MyEntry[]) => MyEntry[]) {
  const w = get().activeWallet;
  if (!w) return;
  const map = get().entriesByWallet;
  const next = fn(map[w] ?? []);
  set({
    entries: next,
    entriesByWallet: { ...map, [w]: next },
  });
}

export const useMyEntries = create<MyEntriesState>()(
  persist(
    (set, get) => ({
      entriesByWallet: {},
      activeWallet: null,
      entries: [],

      useWallet: (wallet) => {
        const w = wallet.toLowerCase();
        const map = get().entriesByWallet;
        const list = map[w] ?? [];
        set({
          activeWallet: w,
          entries: list,
          entriesByWallet: map[w] ? map : { ...map, [w]: [] },
        });
      },

      add: (entry) => mutateActive(get, set, list => upsert(list, {
        ...entry,
        placedAt: entry.placedAt ?? Date.now(),
        status: entry.status ?? "open",
      })),

      remove: (battleId) => mutateActive(get, set, list => list.filter(b => b.battleId !== battleId)),

      clearAll: () => mutateActive(get, set, () => []),

      getForBattle: (battleId) => get().entries.find(b => b.battleId === battleId),

      resolveEntry: (battleId, winningSide) => {
        const entry = get().entries.find(e => e.battleId === battleId);
        if (!entry || entry.status !== "open") return null;
        // Polymarket-style share payout: you "bought" stake/(entryPct/100)
        // shares, each worth 1 CUTE$ if your side wins. Backing an underdog
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
        mutateActive(get, set, list => list.map(e => e.battleId === battleId ? settled : e));
        return settled;
      },

      settleServer: (battleId, serverStatus, payout) => {
        const entry = get().entries.find(e => e.battleId === battleId);
        if (!entry || entry.status !== "open") return null;
        const voided = serverStatus === "voided";
        const won = !voided && payout > 0;
        // Server payout is the source of truth: void → stake refunded (netProfit 0),
        // win → pari-mutuel amount, loss → 0. winningSide is inferred from our own
        // outcome (we know the side we backed).
        const settled: MyEntry = {
          ...entry,
          status: voided ? "voided" : won ? "won" : "lost",
          result: {
            settledAt: Date.now(),
            payout,
            netProfit: payout - entry.stake,
            winningSide: voided ? null : won ? entry.side : (entry.side === "A" ? "B" : "A"),
          },
        };
        mutateActive(get, set, list => list.map(e => e.battleId === battleId ? settled : e));
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
        mutateActive(get, set, list => list.map(e => e.battleId === battleId ? sold : e));
        return sold;
      },

      pruneSettled: (maxAgeMs) => {
        const now = Date.now();
        mutateActive(get, set, list => list.filter(e =>
          e.status === "open" || !e.result || (now - e.result.settledAt) < maxAgeMs
        ));
      },
    }),
    {
      // v2: per-wallet shape change → new storage key so legacy v1 state
      // doesn't crash the new code on first load.
      name: "fini-myentries-v2",
      partialize: (s) => ({
        entriesByWallet: s.entriesByWallet,
        activeWallet: s.activeWallet,
        entries: s.entries,
      }),
    }
  )
);

// Keep the active entries list pointed at the SIWE-authed wallet (mirrors the
// coinStore behaviour) so settlement reads the right wallet's predictions.
if (isOnline) {
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
      const wallet = (session?.user?.user_metadata?.wallet as string | undefined)?.toLowerCase();
      if (wallet) useMyEntries.getState().useWallet(wallet);
    }
  });
}

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
