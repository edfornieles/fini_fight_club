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
  /** Claim the daily drop if available. Returns the amount granted (0 if on cooldown / failed). */
  claimDailyDrop: () => Promise<number>;
  /** Emergency top-up when nearly broke — always available under the floor. Returns amount. */
  rescueTopUp: () => Promise<number>;

  /** Operator-tunable economy levers (from economy_config; defaults until loaded). */
  economy: { dailyGrant: number; rescueAmount: number; rescueFloor: number };
  /** Pull the latest economy levers from the public economy_config row (online only). */
  loadEconomy: () => Promise<void>;
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
      economy: { dailyGrant: DAILY_DROP, rescueAmount: RESCUE_AMOUNT, rescueFloor: RESCUE_FLOOR },

      loadEconomy: async () => {
        if (!isOnline) return;
        try {
          const { data } = await supabase.from("economy_config")
            .select("daily_grant, rescue_amount, rescue_floor").eq("id", 1).maybeSingle();
          if (data) set({ economy: {
            dailyGrant:   Number(data.daily_grant   ?? DAILY_DROP),
            rescueAmount: Number(data.rescue_amount ?? RESCUE_AMOUNT),
            rescueFloor:  Number(data.rescue_floor  ?? RESCUE_FLOOR),
          } });
        } catch { /* keep defaults */ }
      },

      dropCooldownMs: () => {
        const w = get().activeWallet;
        if (!w) return DROP_COOLDOWN_MS;
        const last = get().lastDropByWallet[w] ?? 0;
        return Math.max(0, DROP_COOLDOWN_MS - (Date.now() - last));
      },
      claimDailyDrop: async () => {
        const w = get().activeWallet;
        if (!w) return 0;
        if (get().dropCooldownMs() > 0) return 0;

        // Online: the server is authoritative — it enforces the cooldown, reads
        // the configured amount, credits the ledger, and we adopt the result.
        if (isOnline) {
          try {
            const r = await api.claimGrant("daily");
            set(s => ({ lastDropByWallet: { ...s.lastDropByWallet, [w]: Date.now() } }));
            await get().refresh(w);
            return r.amount;
          } catch (e) {
            // Server says we're still on cooldown — sync the local clock so the
            // UI stops offering the button, and report "nothing granted".
            const msg = e instanceof Error ? e.message : "";
            if (msg.includes("cooldown")) {
              set(s => ({ lastDropByWallet: { ...s.lastDropByWallet, [w]: Date.now() } }));
            }
            return 0;
          }
        }

        // Offline / dev: keep the local grant.
        get().earn(get().economy.dailyGrant);
        set(s => ({ lastDropByWallet: { ...s.lastDropByWallet, [w]: Date.now() } }));
        return get().economy.dailyGrant;
      },
      rescueTopUp: async () => {
        const w = get().activeWallet;
        if (get().balance >= get().economy.rescueFloor) return 0;

        if (isOnline && w) {
          try {
            const r = await api.claimGrant("rescue");
            await get().refresh(w);
            return r.amount;
          } catch {
            return 0;
          }
        }

        // Offline / dev: keep the local top-up.
        get().earn(get().economy.rescueAmount);
        return get().economy.rescueAmount;
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
        // Pull the authoritative server balance. Online, the server is ALWAYS
        // the truth — including a genuine 0 (fresh signup before any claim, or
        // a busted bankroll). Keeping the local 1000 seed there is a lie: the
        // chip says you're flush while every bet 402s "insufficient_funds".
        // The seed only backs offline/dev play.
        if (isOnline) {
          get().loadEconomy();
          getBalance(w).then(serverBal => {
            if (get().activeWallet === w) {
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
      name: "cute-coin-cache-v3", // v3: CUTE$ rebrand (clean slate from FINI$ v2)
      partialize: (s) => ({ balancesByWallet: s.balancesByWallet, activeWallet: s.activeWallet, balance: s.balance, lastDropByWallet: s.lastDropByWallet }),
    },
  ),
);

export const COIN_LABEL = "CUTE$";

export function fmtCoin(n: number, opts: { compact?: boolean } = {}): string {
  if (opts.compact && n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (opts.compact && n >= 10_000)    return `${(n / 1_000).toFixed(0)}K`;
  if (opts.compact && n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("en-US");
}

// Pull operator-tuned economy levers once at startup so button labels/amounts
// reflect config even before a wallet connects.
if (isOnline) {
  useCoinStore.getState().loadEconomy();
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
