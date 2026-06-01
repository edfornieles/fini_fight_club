/**
 * Crumbs 🍪 — the in-battle currency.
 *
 * Distinct from FINI$ (which is the entry stake + prize for battles).
 * Crumbs pay for items, potions, snacks, shop rerolls — the small-stakes
 * tactical decisions a player makes between fights.
 *
 * Why two currencies?
 *   FINI$  → the bankroll. Used to enter battles, won as prizes, cashed out
 *             to real money at the cashout tier.
 *   Crumbs → the per-run economy. Replenished automatically (1 battle = +20
 *             crumbs), reset on bust/restart. Skill at managing crumbs
 *             determines whether you can afford the right items at the right
 *             moment without dipping into your FINI$ bankroll.
 *
 * Persisted to localStorage; reset by useFiniRecords.reset() callers.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

// SAP-style restrained economy: start with just enough for one cheap snack
// or a couple of common items. Surviving multiple battles is the unlock —
// after ~4 wins you can afford a rare item, after ~10 a legendary.
const STARTING_CRUMBS = 30;
const CRUMBS_PER_WIN  = 25;  // bigger drip on win (rewards skill)
const CRUMBS_PER_LOSS = 10;  // smaller drip on loss (don't fully starve)

interface CrumbState {
  crumbs: number;
  /** Spend N crumbs. Returns false (and does nothing) if insufficient. */
  spend: (n: number) => boolean;
  /** Add N crumbs. */
  earn: (n: number) => void;
  /** Force-set the balance (used by restart + dev tools). */
  setCrumbs: (n: number) => void;
  /** Reset to the fresh-run starting amount. */
  resetRun: () => void;
  /** Award the per-battle drip — outcome-dependent (win > loss). */
  rewardBattle: (outcome: "win" | "loss" | "draw") => void;
}

export const useCrumbStore = create<CrumbState>()(
  persist(
    (set, get) => ({
      crumbs: STARTING_CRUMBS,
      spend: (n) => {
        if (get().crumbs < n) return false;
        set(s => ({ crumbs: s.crumbs - n }));
        return true;
      },
      earn:        (n) => set(s => ({ crumbs: s.crumbs + n })),
      setCrumbs:   (n) => set({ crumbs: n }),
      resetRun:    ()  => set({ crumbs: STARTING_CRUMBS }),
      rewardBattle: (outcome) => set(s => ({
        crumbs: s.crumbs + (outcome === "win" ? CRUMBS_PER_WIN : outcome === "draw" ? Math.floor((CRUMBS_PER_WIN + CRUMBS_PER_LOSS) / 2) : CRUMBS_PER_LOSS),
      })),
    }),
    { name: "fini-crumbs-v1" }
  )
);

export const CRUMBS_PER_WIN_AMOUNT  = CRUMBS_PER_WIN;
export const CRUMBS_PER_LOSS_AMOUNT = CRUMBS_PER_LOSS;
export const CRUMBS_STARTING_AMOUNT = STARTING_CRUMBS;
