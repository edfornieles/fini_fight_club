/** Operator console → Audit tab: the trail of every operator mutation. Reads
 * through admin-ops (admin-gated), so only real admins can see it. */
import { useEffect, useState } from "react";
import { api, type AdminAction } from "../../lib/api";
import { Card, Btn } from "./shared";

export function AuditPanel({ canWrite }: { canWrite: boolean }) {
  const [rows, setRows] = useState<AdminAction[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    if (!canWrite) return;
    setLoading(true); setErr(null);
    try { const r = await api.admin.actionsRecent(100); setRows(r.actions); }
    catch (e) { setErr(e instanceof Error ? e.message : "load_failed"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [canWrite]);

  return (
    <Card title="Operator audit log" right={<Btn small onClick={load} disabled={loading || !canWrite}>{loading ? "Loading…" : "↻ Refresh"}</Btn>}>
      {!canWrite && <div style={{ color: "#999", fontSize: 13 }}>Connect an admin wallet to view the audit trail.</div>}
      {err && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", padding: 10, borderRadius: 8, fontSize: 13 }}>{err}</div>}
      {canWrite && rows.length === 0 && !loading && <div style={{ color: "#999", fontSize: 13 }}>No operator actions recorded yet.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {rows.map((a) => (
          <div key={a.id} style={{ display: "flex", gap: 12, alignItems: "baseline", padding: "8px 10px", borderBottom: "1px solid #f5f5f5", fontSize: 12 }}>
            <span style={{ color: "#999", fontFamily: "monospace", fontSize: 11, whiteSpace: "nowrap" }}>{new Date(a.created_at).toLocaleString()}</span>
            <span style={{ fontWeight: 800, color: "#111", whiteSpace: "nowrap" }}>{a.action}</span>
            <span style={{ color: "#7c3aed", fontFamily: "monospace", fontSize: 11 }}>{a.admin_wallet.slice(0, 8)}…</span>
            <span style={{ color: "#666", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{JSON.stringify(a.payload)}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
