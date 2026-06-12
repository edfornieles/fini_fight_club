/**
 * Server-backed Crypto Arena state.
 *
 * When online, the arena is driven by the REAL backend the house bots play in:
 *   - battles  ← open `battle_instances` (the same rolling windows bots bet on)
 *   - odds     ← live prediction pools per side
 *   - volume   ← `battle_instances.total_volume`
 *   - feed     ← most-recent `predictions` (bots + humans)
 *
 * Mapped into the existing `Battle` / `SimEntry` shapes so the arena UI renders
 * unchanged. The client-side simulation in cryptoSim.ts is now only the
 * OFFLINE/dev fallback. See [[project-backend-live]].
 */
import { supabase } from "../lib/supabase";
import { ASSET_META, type Battle } from "./mockBattles";
import type { SimEntry } from "./cryptoSim";
import type { BattleInstance, AuditLogEntry, PriceSource } from "../game/priceIntegrity";

const SIDE_A_COLOR = "#22c55e";
const SIDE_B_COLOR = "#ef4444";
const shortWallet = (a: string) => (a.length >= 10 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

type InstanceRow = {
  id: string; asset_a: string; asset_b: string | null;
  start_time: string; end_time: string; status: string; total_volume: number | null;
  official_start_price_a: number | null; official_end_price_a: number | null;
};
type PredRow = { battle_id: string; wallet_address: string; side: string; stake: number; created_at: string };

function durationLabel(startIso: string, endIso: string): string {
  const min = Math.max(1, Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60_000));
  return min >= 60 ? `${Math.round(min / 60)}h` : `${min}m`;
}

function mapInstance(row: InstanceRow, pools: { a: number; b: number }): Battle {
  const isOutperform = !!row.asset_b;
  const total = pools.a + pools.b;
  // total_volume is only bumped by human predict-place calls; house-bot stakes
  // land directly. Use whichever is larger so cards reflect real activity.
  const volRaw = Math.max(Number(row.total_volume) || 0, total);
  const pctA = total > 0 ? Math.round((pools.a / total) * 100) : 50;
  const pctA_clamped = Math.min(95, Math.max(5, pctA));
  const endsInMs = Math.max(0, new Date(row.end_time).getTime() - Date.now());
  const sideAColor = isOutperform ? ASSET_META[row.asset_a]?.color ?? SIDE_A_COLOR : SIDE_A_COLOR;
  const sideBColor = isOutperform ? ASSET_META[row.asset_b!]?.color ?? SIDE_B_COLOR : SIDE_B_COLOR;
  return {
    id: row.id,
    title: isOutperform ? `${row.asset_a} vs ${row.asset_b}` : `${row.asset_a} Up or Down ${durationLabel(row.start_time, row.end_time)}`,
    question: isOutperform
      ? `Will ${row.asset_a} outperform ${row.asset_b} this window?`
      : `Will ${row.asset_a} close higher than its opening price in this window?`,
    type: isOutperform ? "outperform" : "updown",
    status: endsInMs > 0 ? "live" : "resolved",
    assets: isOutperform ? [row.asset_a, row.asset_b!] : [row.asset_a],
    sideA: { label: isOutperform ? row.asset_a : "Up", pct: pctA_clamped, color: sideAColor },
    sideB: { label: isOutperform ? row.asset_b! : "Down", pct: 100 - pctA_clamped, color: sideBColor },
    volumeK: Math.round(volRaw / 1000),
    endsInMs,
    familyA: row.asset_a,
    familyB: row.asset_b ?? undefined,
    durationLabel: durationLabel(row.start_time, row.end_time),
    officialStartPrice: row.official_start_price_a,
    officialEndPrice: row.official_end_price_a,
  };
}

/**
 * One round-trip pair: open battles + their recent predictions. Returns the
 * mapped battles (with pool-derived odds) and a newest-first activity feed.
 */
export async function fetchArenaState(): Promise<{ battles: Battle[]; feed: SimEntry[] }> {
  const { data: instances } = await supabase
    .from("battle_instances")
    .select("id,asset_a,asset_b,start_time,end_time,status,total_volume,official_start_price_a,official_end_price_a")
    .eq("status", "open")
    .order("end_time", { ascending: true })
    .limit(80);
  const rows = (instances ?? []) as InstanceRow[];
  if (rows.length === 0) return { battles: [], feed: [] };

  const ids = rows.map((r) => r.id);
  const { data: preds } = await supabase
    .from("predictions")
    .select("battle_id,wallet_address,side,stake,created_at")
    .in("battle_id", ids)
    .order("created_at", { ascending: false })
    .limit(1500);
  const predRows = (preds ?? []) as PredRow[];

  // Aggregate side pools per battle from the sample (drives display odds).
  const pools = new Map<string, { a: number; b: number }>();
  for (const p of predRows) {
    const e = pools.get(p.battle_id) ?? { a: 0, b: 0 };
    if (p.side === "A") e.a += Number(p.stake) || 0; else e.b += Number(p.stake) || 0;
    pools.set(p.battle_id, e);
  }

  const battles = rows.map((r) => mapInstance(r, pools.get(r.id) ?? { a: 0, b: 0 }));
  const byId = new Map(battles.map((b) => [b.id, b]));

  // Feed: newest predictions, mapped through the battle for labels.
  const feed: SimEntry[] = predRows.slice(0, 50).map((p) => {
    const b = byId.get(p.battle_id);
    const sideLabel = p.side === "A" ? b?.sideA.label ?? "A" : b?.sideB.label ?? "B";
    return {
      id: `${p.battle_id}:${p.wallet_address}:${p.created_at}`,
      battleId: p.battle_id,
      battleTitle: b?.title ?? p.battle_id,
      wallet: p.wallet_address,
      shortWallet: shortWallet(p.wallet_address),
      side: p.side === "A" ? "A" : "B",
      sideLabel,
      asset: b?.assets[0] ?? "",
      amount: Number(p.stake) || 0,
      at: new Date(p.created_at).getTime(),
    };
  });

  return { battles, feed };
}

/**
 * Settlement read: the player's own predictions, so the resolver can mark local
 * entries won/lost/voided from SERVER truth (status + payout), never recomputed.
 */
export async function fetchMyPredictions(wallet: string, battleIds: string[]): Promise<Map<string, { status: string; payout: number | null }>> {
  const out = new Map<string, { status: string; payout: number | null }>();
  if (battleIds.length === 0) return out;
  const { data } = await supabase
    .from("predictions")
    .select("battle_id,status,payout")
    .eq("wallet_address", wallet.toLowerCase())
    .in("battle_id", battleIds);
  for (const p of (data ?? []) as { battle_id: string; status: string; payout: number | null }[]) {
    out.set(p.battle_id, { status: p.status, payout: p.payout });
  }
  return out;
}

/**
 * Full audit view of one battle instance, mapped to the client BattleInstance
 * shape the ResolutionAuditPanel renders. This is what makes the "all prices,
 * winners and payouts are determined server-side" promise visible: real
 * official prices, sources, status, void reason, and audit log from the row
 * the server actually settled. Returns null when the id isn't a server battle.
 */
export async function fetchInstanceAudit(battleId: string): Promise<BattleInstance | null> {
  const { data } = await supabase
    .from("battle_instances")
    .select("id,template_id,asset_a,asset_b,official_start_price_a,official_end_price_a,start_price_source,end_price_source,start_price_recorded_at,end_price_recorded_at,resolution_formula,resolution_calculation,winning_side,resolution_status,audit_log,void_reason")
    .eq("id", battleId)
    .maybeSingle();
  if (!data) return null;
  const isOutperform = !!data.asset_b;
  const auditLog: AuditLogEntry[] = Array.isArray(data.audit_log)
    ? (data.audit_log as Record<string, unknown>[]).map((e) => ({
        timestamp: String(e.timestamp ?? e.at ?? ""),
        event: String(e.event ?? e.message ?? ""),
        detail: e.detail != null ? String(e.detail) : undefined,
        actor: e.actor === "admin" ? "admin" : "system",
      }))
    : [];
  return {
    battleId: data.id,
    templateId: data.template_id,
    asset: data.asset_a,
    question: isOutperform
      ? `Did ${data.asset_a} outperform ${data.asset_b}?`
      : `Did ${data.asset_a} close higher than open?`,
    sideALabel: isOutperform ? data.asset_a : "Up",
    sideBLabel: isOutperform ? data.asset_b! : "Down",
    officialStartPrice: data.official_start_price_a,
    officialStartPriceSource: (data.start_price_source ?? null) as PriceSource | null,
    officialStartTimestamp: data.start_price_recorded_at,
    startBackupPriceChecks: [],
    startDeviationReport: null,
    officialEndPrice: data.official_end_price_a,
    officialEndPriceSource: (data.end_price_source ?? null) as PriceSource | null,
    officialEndTimestamp: data.end_price_recorded_at,
    endBackupPriceChecks: [],
    endDeviationReport: null,
    resolutionFormula: data.resolution_formula ?? "",
    resolutionCalculation: data.resolution_calculation ?? "",
    winningSide: data.winning_side === "A" ? "A" : data.winning_side === "B" ? "B" : null,
    resolutionStatus: (data.resolution_status ?? "pending") as BattleInstance["resolutionStatus"],
    resolutionAuditLog: auditLog,
    voidReason: data.void_reason ?? undefined,
  };
}

/**
 * Battle-level results for a set of ids — used to settle client-side STRATEGY
 * entries (Automated Attack) against the real outcome. Strategies keep their
 * segregated local budget, but resolve on the true server winning side rather
 * than a cached-price guess.
 */
export async function fetchBattleResults(battleIds: string[]): Promise<Map<string, { settled: boolean; winningSide: "A" | "B" | null }>> {
  const out = new Map<string, { settled: boolean; winningSide: "A" | "B" | null }>();
  if (battleIds.length === 0) return out;
  const { data } = await supabase
    .from("battle_instances")
    .select("id,resolution_status,winning_side")
    .in("id", battleIds);
  for (const r of (data ?? []) as { id: string; resolution_status: string; winning_side: string | null }[]) {
    const settled = r.resolution_status === "resolved" || r.resolution_status === "voided";
    const winningSide = r.resolution_status === "voided" ? null : (r.winning_side === "A" ? "A" : r.winning_side === "B" ? "B" : null);
    out.set(r.id, { settled, winningSide });
  }
  return out;
}
