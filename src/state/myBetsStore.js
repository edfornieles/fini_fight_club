/**
 * MyBets — the user's active predictions across the Crypto Arena.
 * Persisted to localStorage so they survive reloads and navigation. When the
 * real backend is wired up this is the local cache mirror of the server's
 * `predictions` table.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
export const useMyBets = create()(persist((set, get) => ({
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
}), { name: "fini-mybets-v1" }));
