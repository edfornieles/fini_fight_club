/**
 * Crumbs 🍪 — the in-battle currency.
 *
 * Distinct from CUTE$ (which is the entry stake + prize for battles).
 * Crumbs pay for items, potions, snacks, shop rerolls — the small-stakes
 * tactical decisions a player makes between fights.
 *
 * Why two currencies?
 *   CUTE$  → the bankroll. Used to enter battles, won as prizes, cashed out
 *             to real money at the cashout tier.
 *   Crumbs → the per-run economy. Replenished automatically (1 battle = +20
 *             crumbs), reset on bust/restart. Skill at managing crumbs
 *             determines whether you can afford the right items at the right
 *             moment without dipping into your CUTE$ bankroll.
 *
 * Persisted to localStorage; reset by useFiniRecords.reset() callers.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

// Super Auto Pets-pure restraint: everyone starts with the same tiny wallet.
// Day-one you can afford a single cheap item OR a couple of rerolls — nothing
// more. Wins drip a little, losses drip even less. The whole tension of the
// economy is "did I spend my crumbs on the right thing this round?"
//
//   Start  = 10 🍪 — one common item or 3 rerolls
//   Win    = +8 🍪 — string ~3 wins for a rare
//   Loss   = +3 🍪 — losing streaks slowly starve you
const STARTING_CRUMBS = 10;
const CRUMBS_PER_WIN  = 8;
const CRUMBS_PER_LOSS = 3;

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
