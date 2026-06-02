/**
 * useLiveActivity — real prediction feed from Supabase.
 *
 * Every bet placed by a house bot (and eventually any real player) lands in
 * `public.predictions`. This hook polls that table every N seconds, joins
 * each row to its bot handle (when applicable), and exposes a normalised
 * "Live" activity feed that replaces the synthetic ghost-persona sim.
 *
 * Why polling, not realtime: Supabase realtime websockets count against a
 * different free-tier quota and add complexity. REST polls are simple,
 * cacheable at the edge, and 10s is plenty fresh for an arena feed.
 */
import { useEffect, useState } from "react";
import { supabase, isOnline } from "../lib/supabase";

export interface ActivityEvent {
  id: number;
  battleId: string;
  walletAddress: string;
  /** Handle for bots; truncated wallet for real users. */
  handle: string;
  isBot: boolean;
  side: "A" | "B";
  stake: number;
  at: number; // epoch ms
}

interface ActivityOptions {
  /** Optional — only events on this battle. Omit for global feed. */
  battleId?: string;
  /** Max rows to surface. */
  limit?: number;
  /** Poll interval. Default 8s. */
  pollMs?: number;
}

function truncateWallet(addr: string): string {
  return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

type PredictionRow = {
  id: number;
  battle_id: string;
  wallet_address: string;
  side: string;
  stake: number;
  created_at: string;
};

// In-memory cache of bot handles by wallet — refreshed on demand.
const _botHandleByWallet = new Map<string, string>();
let _botCacheAt = 0;
async function ensureBotCache() {
  if (Date.now() - _botCacheAt < 5 * 60_000 && _botHandleByWallet.size > 0) return;
  const { data } = await supabase.from("house_bots").select("wallet_address,handle");
  for (const r of (data ?? []) as { wallet_address: string; handle: string }[]) {
    _botHandleByWallet.set(r.wallet_address, r.handle);
  }
  _botCacheAt = Date.now();
}

export function useLiveActivity({ battleId, limit = 30, pollMs = 8_000 }: ActivityOptions = {}): {
  events: ActivityEvent[];
  loading: boolean;
} {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOnline) { setLoading(false); return; }
    let alive = true;

    async function fetchOnce() {
      try {
        // Two queries in parallel: the recent predictions feed + the bot-handle
        // lookup table. Merging client-side avoids needing an explicit FK
        // between predictions.wallet_address and house_bots.wallet_address.
        await ensureBotCache();
        let q = supabase
          .from("predictions")
          .select("id,battle_id,wallet_address,side,stake,created_at")
          .order("created_at", { ascending: false })
          .limit(limit);
        if (battleId) {
          // Server-spawned battles use IDs like "btc-updown-15m:2026-06-02T08:30".
          // The page often passes the short template ID ("btc-updown-15m").
          // Match either: exact, or template-prefix followed by a colon.
          q = q.or(`battle_id.eq.${battleId},battle_id.like.${battleId}:%`);
        }
        const { data } = await q;
        if (!alive || !data) return;
        const mapped: ActivityEvent[] = (data as PredictionRow[]).map(r => {
          const botHandle = _botHandleByWallet.get(r.wallet_address);
          return {
            id: r.id,
            battleId: r.battle_id,
            walletAddress: r.wallet_address,
            handle: botHandle ?? truncateWallet(r.wallet_address),
            isBot: !!botHandle,
            side: (r.side === "A" || r.side === "B" ? r.side : "A") as "A" | "B",
            stake: r.stake,
            at: new Date(r.created_at).getTime(),
          };
        });
        setEvents(mapped);
      } catch { /* keep stale on failure */ }
      finally { if (alive) setLoading(false); }
    }

    fetchOnce();
    const t = setInterval(fetchOnce, pollMs);
    // Refetch when the tab returns to focus — feels alive
    const onVis = () => { if (document.visibilityState === "visible") fetchOnce(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [battleId, limit, pollMs]);

  return { events, loading };
}

/**
 * Real volume per battle — sum of stakes for every prediction on that battle.
 * Returns FINI$. Cached per battleId for `pollMs` so repeat callers don't
 * each fire their own query.
 */
const _volCache = new Map<string, { value: number; at: number }>();

export async function getBattleVolume(battleId: string, ttlMs = 30_000): Promise<number> {
  if (!isOnline) return 0;
  const cached = _volCache.get(battleId);
  if (cached && Date.now() - cached.at < ttlMs) return cached.value;
  try {
    const { data } = await supabase
      .from("predictions")
      .select("stake")
      // Same matching trick as the activity feed — exact ID or
      // template-prefix:slot form.
      .or(`battle_id.eq.${battleId},battle_id.like.${battleId}:%`);
    const total = (data ?? []).reduce((s, r: { stake: number }) => s + (r.stake || 0), 0);
    _volCache.set(battleId, { value: total, at: Date.now() });
    return total;
  } catch {
    return cached?.value ?? 0;
  }
}
