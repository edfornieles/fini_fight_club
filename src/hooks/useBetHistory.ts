/**
 * useBetHistory — a wallet's real Crypto Arena prediction history + record,
 * straight from Supabase (predictions joined to their battle outcome). Powers
 * the Profile's battle record and bet list. Read-only; safe for any viewer.
 */
import { useEffect, useState } from "react";
import { supabase, isOnline } from "../lib/supabase";

export interface BetRow {
  id: number;
  battleId: string;
  side: "A" | "B";
  stake: number;
  payout: number | null;
  status: "open" | "resolved" | "voided" | "locked";
  createdAt: string;
  title: string;
  assetA: string;
  assetB: string | null;
  winningSide: "A" | "B" | null;
  outcome: "open" | "won" | "lost" | "void";
}

export interface BetStats {
  played: number;   // settled battles bet on
  won: number;
  lost: number;
  voided: number;
  open: number;
  winRatePct: number;
  staked: number;
  returned: number;
  net: number;      // returned - staked over settled
  bestStreak: number; // longest run of consecutive wins (voids don't break it)
  firstAt: string | null; // earliest prediction timestamp
}

const EMPTY: BetStats = { played: 0, won: 0, lost: 0, voided: 0, open: 0, winRatePct: 0, staked: 0, returned: 0, net: 0, bestStreak: 0, firstAt: null };

type RawRow = {
  id: number; battle_id: string; side: string; stake: number; payout: number | null;
  status: string; created_at: string;
  battle_instances: { asset_a: string; asset_b: string | null; winning_side: string | null } | null;
};

export function useBetHistory(wallet: string | null | undefined) {
  const [bets, setBets] = useState<BetRow[]>([]);
  const [stats, setStats] = useState<BetStats>(EMPTY);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!wallet || !isOnline) { setBets([]); setStats(EMPTY); return; }
    let alive = true;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("predictions")
        .select("id,battle_id,side,stake,payout,status,created_at,battle_instances(asset_a,asset_b,winning_side)")
        .eq("wallet_address", wallet.toLowerCase())
        .order("created_at", { ascending: false })
        .limit(200);
      if (!alive) return;
      const rows = (data ?? []) as unknown as RawRow[];
      const mapped: BetRow[] = rows.map((r) => {
        const side = r.side === "A" ? "A" : "B";
        const bi = r.battle_instances;
        const outcome: BetRow["outcome"] =
          r.status === "open" ? "open"
          : r.status === "voided" ? "void"
          : (r.payout ?? 0) > 0 ? "won" : "lost";
        return {
          id: r.id, battleId: r.battle_id, side, stake: r.stake, payout: r.payout,
          status: r.status as BetRow["status"], createdAt: r.created_at,
          assetA: bi?.asset_a ?? "?", assetB: bi?.asset_b ?? null,
          winningSide: bi?.winning_side === "A" ? "A" : bi?.winning_side === "B" ? "B" : null,
          title: bi?.asset_b ? `${bi.asset_a} vs ${bi.asset_b}` : `${bi?.asset_a ?? r.battle_id} Up/Down`,
          outcome,
        };
      });
      const won = mapped.filter((b) => b.outcome === "won").length;
      const lost = mapped.filter((b) => b.outcome === "lost").length;
      const voided = mapped.filter((b) => b.outcome === "void").length;
      const open = mapped.filter((b) => b.outcome === "open").length;
      const settled = mapped.filter((b) => b.outcome !== "open");
      const staked = settled.reduce((s, b) => s + b.stake, 0);
      const returned = settled.reduce((s, b) => s + (b.payout ?? 0), 0);
      // Longest consecutive-win run, walked oldest→newest (mapped is newest-first).
      // A void neither extends nor breaks the streak; a loss resets it.
      let bestStreak = 0, cur = 0;
      for (let i = mapped.length - 1; i >= 0; i--) {
        const o = mapped[i].outcome;
        if (o === "won") { cur++; if (cur > bestStreak) bestStreak = cur; }
        else if (o === "lost") cur = 0;
      }
      setStats({
        played: settled.length, won, lost, voided, open,
        winRatePct: won + lost > 0 ? Math.round((won / (won + lost)) * 100) : 0,
        staked, returned, net: returned - staked,
        bestStreak,
        firstAt: mapped.length ? mapped[mapped.length - 1].createdAt : null,
      });
      setBets(mapped);
      setLoading(false);
    })().catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [wallet]);

  return { bets, stats, loading };
}
