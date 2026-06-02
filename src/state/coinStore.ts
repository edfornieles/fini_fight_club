import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api, getBalance } from "../lib/api";
import { supabase, isOnline } from "../lib/supabase";

// Default starting balance for a brand-new local (dev/play) account.
const DEFAULT_SEED = 1000;

interface CoinState {
  /** Per-wallet balances — each impersonated/connected account has its own. */
  balancesByWallet: Record<string, number>;
  /** The wallet whose balance is currently "active" / displayed. */
  activeWallet: string | null;
  /** Mirror of the active wallet's balance, so existing `s.balance` reads work. */
  balance: number;
  loaded: boolean;

  /** Switch the active wallet. Seeds a fresh local balance if unseen, then
   *  pulls the server balance (bots/real claims) if online. */
  useWallet: (wallet: string, seed?: number) => void;
  refresh: (wallet: string) => Promise<void>;
  setBalance: (n: number) => void;
  spend: (n: number) => void;
  earn:  (n: number) => void;
  spendOnServer: (args: { amount: number; reason: string; idempotencyKey: string; battleId?: string; metadata?: Record<string, unknown> }) => Promise<{ newBalance: number } | { error: string }>;

  /** Last daily-drop claim time per wallet (epoch ms). */
  lastDropByWallet: Record<string, number>;
  /** Ms until the active wallet can claim its next daily drop (0 = available). */
  dropCooldownMs: () => number;
  /** Claim the daily drop if available. Returns the amount granted (0 if on cooldown). */
  claimDailyDrop: () => number;
  /** Emergency top-up when nearly broke — always available under the floor. Returns amount. */
  rescueTopUp: () => number;
}

const DAILY_DROP = 500;
const DROP_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const RESCUE_FLOOR = 100;   // below this you can always grab a rescue top-up
const RESCUE_AMOUNT = 500;

export const useCoinStore = create<CoinState>()(
  persist(
    (set, get) => ({
      balancesByWallet: {},
      activeWallet: null,
      balance: 0,
      loaded: false,
      lastDropByWallet: {},

      dropCooldownMs: () => {
        const w = get().activeWallet;
        if (!w) return DROP_COOLDOWN_MS;
        const last = get().lastDropByWallet[w] ?? 0;
        return Math.max(0, DROP_COOLDOWN_MS - (Date.now() - last));
      },
      claimDailyDrop: () => {
        const w = get().activeWallet;
        if (!w) return 0;
        if (get().dropCooldownMs() > 0) return 0;
        get().earn(DAILY_DROP);
        set(s => ({ lastDropByWallet: { ...s.lastDropByWallet, [w]: Date.now() } }));
        return DAILY_DROP;
      },
      rescueTopUp: () => {
        if (get().balance >= RESCUE_FLOOR) return 0;
        get().earn(RESCUE_AMOUNT);
        return RESCUE_AMOUNT;
      },

      useWallet: (wallet, seed = DEFAULT_SEED) => {
        const w = wallet.toLowerCase();
        const map = get().balancesByWallet;
        const existing = map[w];
        const bal = existing ?? seed;
        set({
          activeWallet: w,
          balance: bal,
          loaded: true,
          balancesByWallet: existing == null ? { ...map, [w]: bal } : map,
        });
        // Pull the authoritative server balance if available (bots/real claims).
        if (isOnline) {
          getBalance(w).then(serverBal => {
            // Only adopt the server balance if it's meaningful (>0) and this is
            // still the active wallet. Server is source of truth for funded
            // accounts; local seed covers fresh play accounts.
            if (serverBal > 0 && get().activeWallet === w) {
              set(s => ({ balance: serverBal, balancesByWallet: { ...s.balancesByWallet, [w]: serverBal } }));
            }
          }).catch(() => { /* keep local */ });
        }
      },

      refresh: async (wallet: string) => {
        if (!isOnline) return;
        const w = wallet.toLowerCase();
        try {
          const b = await getBalance(w);
          set(s => ({
            balance: get().activeWallet === w ? b : s.balance,
            balancesByWallet: { ...s.balancesByWallet, [w]: b },
            loaded: true,
          }));
        } catch { /* leave cached balance */ }
      },

      setBalance: (n) => set(s => {
        const w = s.activeWallet;
        return { balance: n, loaded: true, balancesByWallet: w ? { ...s.balancesByWallet, [w]: n } : s.balancesByWallet };
      }),
      spend: (n) => set(s => {
        const next = Math.max(0, s.balance - n);
        const w = s.activeWallet;
        return { balance: next, balancesByWallet: w ? { ...s.balancesByWallet, [w]: next } : s.balancesByWallet };
      }),
      earn: (n) => set(s => {
        const next = s.balance + n;
        const w = s.activeWallet;
        return { balance: next, balancesByWallet: w ? { ...s.balancesByWallet, [w]: next } : s.balancesByWallet };
      }),

      spendOnServer: async (args) => {
        if (!isOnline) { get().spend(args.amount); return { newBalance: get().balance }; }
        try {
          const r = await api.debitBalance(args);
          get().setBalance(r.newBalance);
          return { newBalance: r.newBalance };
        } catch (e) {
          return { error: e instanceof Error ? e.message : "spend_failed" };
        }
      },
    }),
    {
      name: "fini-coin-cache-v2", // v2: per-wallet balances
      partialize: (s) => ({ balancesByWallet: s.balancesByWallet, activeWallet: s.activeWallet, balance: s.balance, lastDropByWallet: s.lastDropByWallet }),
    },
  ),
);

export const COIN_LABEL = "FINI$";

export function fmtCoin(n: number, opts: { compact?: boolean } = {}): string {
  if (opts.compact && n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (opts.compact && n >= 10_000)    return `${(n / 1_000).toFixed(0)}K`;
  if (opts.compact && n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("en-US");
}

// Auto-switch balance whenever a real wallet connects via SIWE.
if (isOnline) {
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
      const wallet = (session?.user?.user_metadata?.wallet as string | undefined)?.toLowerCase();
      if (wallet) useCoinStore.getState().useWallet(wallet);
    }
  });
}
