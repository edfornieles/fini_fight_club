/** Operator console → Resolution queue: hand-settle battles the auto-resolver
 * couldn't (manual_review) or that are stuck pending past their end time. */
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { api } from "../../lib/api";
import { Card, Btn } from "./shared";

type Instance = {
  id: string; asset_a: string; asset_b: string | null; start_time: string; end_time: string;
  resolution_status: string; status: string; winning_side: string | null; void_reason: string | null;
  official_start_price_a: number | null; official_end_price_a: number | null;
  official_start_price_b: number | null; official_end_price_b: number | null;
  resolution_calculation: string | null; audit_log: unknown[]; total_volume: number;
};

export function ResolutionQueuePanel({ canWrite }: { canWrite: boolean }) {
  const [rows, setRows] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true); setErr(null);
    try {
      // manual_review always; plus anything still pending >10 min past its end
      // (genuinely stuck — the cron resolves within ~1 min, so anything older is
      // a real problem rather than transient).
      const stuckBefore = new Date(Date.now() - 10 * 60_000).toISOString();
      const [{ data: review }, { data: stuck }] = await Promise.all([
        supabase.from("battle_instances").select("*").eq("resolution_status", "manual_review").order("end_time", { ascending: true }).limit(100),
        supabase.from("battle_instances").select("*").eq("resolution_status", "pending").lt("end_time", stuckBefore).order("end_time", { ascending: true }).limit(100),
      ]);
      const merged = [...(review ?? []), ...(stuck ?? [])] as Instance[];
      setRows(merged);
    } catch (e) { setErr(e instanceof Error ? e.message : "load_failed"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); const t = setInterval(load, 20_000); return () => clearInterval(t); }, []);

  async function act(label: string, fn: () => Promise<unknown>) {
    setBusy(label); setErr(null);
    try { await fn(); await load(); }
    catch (e) { setErr(e instanceof Error ? e.message : "action_failed"); }
    finally { setBusy(null); }
  }

  return (
    <Card title={`Resolution queue${rows.length ? ` · ${rows.length}` : ""}`} right={<Btn small onClick={load} disabled={loading}>{loading ? "Loading…" : "↻ Refresh"}</Btn>}>
      {err && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", padding: 10, borderRadius: 8, marginBottom: 12, fontSize: 13 }}>{err}</div>}
      {rows.length === 0 && !loading && (
        <div style={{ padding: 32, textAlign: "center", color: "#16a34a", fontWeight: 700 }}>✓ Nothing awaiting manual resolution.</div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {rows.map((b) => {
          const title = b.asset_b ? `${b.asset_a} vs ${b.asset_b}` : `${b.asset_a} Up/Down`;
          const reason = b.void_reason ?? b.resolution_calculation ?? "Auto-resolver flagged this for review (price divergence or stale feed).";
          const ended = new Date(b.end_time).toLocaleString();
          return (
            <div key={b.id} style={{ border: "1px solid #fde68a", background: "#fffbeb", borderRadius: 12, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 900, color: "#111" }}>{title}</div>
                  <div style={{ fontSize: 11, color: "#888", fontFamily: "monospace" }}>{b.id}</div>
                </div>
                <div style={{ textAlign: "right", fontSize: 11, color: "#92400e" }}>
                  <div style={{ fontWeight: 800, textTransform: "uppercase" }}>{b.resolution_status}</div>
                  <div>ended {ended}</div>
                  <div>pool {b.total_volume?.toLocaleString() ?? 0} CUTE$</div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: "#78350f", margin: "8px 0", lineHeight: 1.4 }}>{reason}</div>
              <div style={{ display: "flex", gap: 16, fontSize: 11, color: "#666", marginBottom: 10, flexWrap: "wrap" }}>
                <span>{b.asset_a}: {fmtP(b.official_start_price_a)} → {fmtP(b.official_end_price_a)}</span>
                {b.asset_b && <span>{b.asset_b}: {fmtP(b.official_start_price_b)} → {fmtP(b.official_end_price_b)}</span>}
              </div>
              {canWrite ? (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Btn small tone="primary" disabled={!!busy}
                    onClick={() => decide(b, "A", act, setBusy)}>Winner: {b.asset_b ? b.asset_a : "Up"} (A)</Btn>
                  <Btn small tone="primary" disabled={!!busy}
                    onClick={() => decide(b, "B", act, setBusy)}>Winner: {b.asset_b ? b.asset_b : "Down"} (B)</Btn>
                  <Btn small tone="danger" disabled={!!busy}
                    onClick={() => { const r = prompt("Void reason (all stakes refunded):", "Price feed unreliable at close"); if (r != null) act(`void:${b.id}`, () => api.admin.battleVoid(b.id, r)); }}>
                    Void & refund
                  </Btn>
                  {busy?.endsWith(b.id) && <span style={{ fontSize: 12, color: "#92400e", alignSelf: "center" }}>working…</span>}
                </div>
              ) : (
                <div style={{ fontSize: 11, color: "#999", fontStyle: "italic" }}>Connect an admin wallet to resolve.</div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function decide(b: Instance, side: "A" | "B", act: (l: string, f: () => Promise<unknown>) => void, _setBusy: (s: string | null) => void) {
  const label = b.asset_b ? (side === "A" ? b.asset_a : b.asset_b!) : (side === "A" ? "Up" : "Down");
  const reason = prompt(`Resolve "${b.id}" with winner = ${label}?\nOptional note (recorded in the audit log):`, "Operator confirmed from exchange data");
  if (reason == null) return;
  act(`resolve:${b.id}`, () => api.admin.battleResolve(b.id, side, reason || "operator decision"));
}

function fmtP(n: number | null): string {
  if (n == null) return "—";
  return n >= 1 ? `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : `$${n.toFixed(4)}`;
}
