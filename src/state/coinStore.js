import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api, getBalance } from "../lib/api";
import { supabase, isOnline } from "../lib/supabase";
export const useCoinStore = create()(persist((set, get) => ({
    balance: 0,
    loaded: false,
    refresh: async (wallet) => {
        if (!isOnline)
            return;
        try {
            const b = await getBalance(wallet);
            set({ balance: b, loaded: true });
        }
        catch { /* leave cached balance */ }
    },
    setBalance: (n) => set({ balance: n, loaded: true }),
    spend: (n) => set(s => ({ balance: Math.max(0, s.balance - n) })),
    earn: (n) => set(s => ({ balance: s.balance + n })),
    spendOnServer: async (args) => {
        if (!isOnline) {
            get().spend(args.amount);
            return { newBalance: get().balance };
        }
        try {
            const r = await api.debitBalance(args);
            set({ balance: r.newBalance });
            return { newBalance: r.newBalance };
        }
        catch (e) {
            return { error: e instanceof Error ? e.message : "spend_failed" };
        }
    },
}), {
    name: "fini-coin-cache-v1",
    partialize: (s) => ({ balance: s.balance }), // only persist the cache, not loaded flag
}));
export const COIN_LABEL = "FINI$";
export function fmtCoin(n, opts = {}) {
    if (opts.compact && n >= 1_000_000)
        return `${(n / 1_000_000).toFixed(1)}M`;
    if (opts.compact && n >= 10_000)
        return `${(n / 1_000).toFixed(0)}K`;
    if (opts.compact && n >= 1_000)
        return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString("en-US");
}
// Auto-refresh balance whenever wallet connects (subscribe to supabase auth).
if (isOnline) {
    supabase.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
            const wallet = session?.user?.user_metadata?.wallet?.toLowerCase();
            if (wallet)
                useCoinStore.getState().refresh(wallet);
        }
        if (event === "SIGNED_OUT")
            useCoinStore.setState({ balance: 0, loaded: false });
    });
}
