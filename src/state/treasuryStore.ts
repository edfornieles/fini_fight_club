/**
 * Treasury — the platform's reserve of FINI$ that funds ghost-battle payouts
 * during beta. Public-facing so players can see "Treasury: 9.8M remaining"
 * and trust the numbers.
 *
 * How it works today (beta, mostly ghost opponents):
 *  - Player wins a ghost battle → treasury pays out `stake` (the +winnings
 *    on top of refunding the player's own stake)
 *  - Player loses a ghost battle → their stake feeds back to the treasury
 *  - Net flow at 50% win rate ≈ zero; off-50% it drifts but slowly
 *
 * When real PvP launches, both sides escrow their stakes and the treasury
 * is only tapped to fill gaps when no opponent is in band.
 *
 * Daily per-wallet cap prevents a single player draining the bank.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

const INITIAL_TREASURY    = 10_000_000;  // 10M FINI$ — matches the claim cap
const DAILY_PAYOUT_CAP    = 1_000;       // per-wallet daily cap on net wins from treasury

interface TreasuryState {
  treasuryBalance: number;
  // Per-wallet daily tally → resets each UTC day
  dailyPayouts: Record<string, { date: string; netFromTreasury: number }>;

  /** Called when a ghost battle resolves. Net flow = +payout (to player) or -stake (to treasury). */
  settleGhostBattle: (wallet: string, payoutToPlayer: number, stakeFromPlayer: number) => {
    actualPayout: number; cappedAt?: number;
  };
  /** Current today-date string in UTC for daily-cap keying */
  todayKey: () => string;
  /** Remaining daily allowance for a wallet */
  dailyRemainingFor: (wallet: string) => number;
}

export const useTreasury = create<TreasuryState>()(
  persist(
    (set, get) => ({
      treasuryBalance: INITIAL_TREASURY,
      dailyPayouts: {},

      todayKey: () => new Date().toISOString().slice(0, 10),

      dailyRemainingFor: (wallet) => {
        const today = get().todayKey();
        const entry = get().dailyPayouts[wallet.toLowerCase()];
        if (!entry || entry.date !== today) return DAILY_PAYOUT_CAP;
        return Math.max(0, DAILY_PAYOUT_CAP - entry.netFromTreasury);
      },

      settleGhostBattle: (wallet, payoutToPlayer, stakeFromPlayer) => {
        const w = wallet.toLowerCase();
        const today = get().todayKey();
        const currentEntry = get().dailyPayouts[w];
        const todayTally = (currentEntry?.date === today ? currentEntry.netFromTreasury : 0);

        // Net delta to treasury from this battle:
        //   loss: +stake (player's stake feeds the pool)
        //   draw: 0 (stake refunded to player)
        //   win:  -(payout - stake) = -stake (treasury pays the +winnings only)
        const grossPayout = payoutToPlayer - stakeFromPlayer; // 0 / stake / -stake equivalent
        let actualPayout = payoutToPlayer;
        let cappedAt: number | undefined;

        if (grossPayout > 0) {
          // Player won — check daily cap
          const remainingCap = DAILY_PAYOUT_CAP - todayTally;
          if (grossPayout > remainingCap) {
            actualPayout = stakeFromPlayer + Math.max(0, remainingCap);
            cappedAt = DAILY_PAYOUT_CAP;
          }
        }

        const winningsFromTreasury = actualPayout - stakeFromPlayer;
        set(state => ({
          treasuryBalance: state.treasuryBalance - winningsFromTreasury,
          dailyPayouts: {
            ...state.dailyPayouts,
            [w]: { date: today, netFromTreasury: todayTally + Math.max(0, winningsFromTreasury) },
          },
        }));
        return { actualPayout, cappedAt };
      },
    }),
    { name: "fini-treasury-v1" }
  )
);

export const DAILY_PAYOUT_CAP_AMOUNT = DAILY_PAYOUT_CAP;
export const INITIAL_TREASURY_AMOUNT = INITIAL_TREASURY;
