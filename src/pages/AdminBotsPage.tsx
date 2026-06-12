/**
 * /admin/bots — Operator console.
 *
 * Monitor + control the house bots, manually resolve battles the auto-resolver
 * flagged, and tune the economics of both games (Crypto Arena + Fight Club).
 *
 * Auth: the console is shown to an admin SIWE session (wallet ∈
 * VITE_ADMIN_WALLETS) or, for local dev, a ?dev=1 latch (read-only-ish — every
 * write still goes through the admin-ops edge function, which re-checks admin
 * server-side via ADMIN_WALLETS / users.is_admin and 403s otherwise).
 */
import { useState } from "react";
import { useAdminGate } from "../hooks/useAdminGate";
import { S } from "../components/admin/shared";
import { BotsPanel } from "../components/admin/BotsPanel";
import { EconomyPanel } from "../components/admin/EconomyPanel";
import { ResolutionQueuePanel } from "../components/admin/ResolutionQueuePanel";
import { AuditPanel } from "../components/admin/AuditPanel";

type Tab = "bots" | "economy" | "resolution" | "audit";
const TABS: { id: Tab; label: string }[] = [
  { id: "bots", label: "🤖 Bots" },
  { id: "economy", label: "💰 Economy" },
  { id: "resolution", label: "⚖️ Resolution queue" },
  { id: "audit", label: "📜 Audit" },
];

export function AdminBotsPage() {
  const { ready, canView, canWrite, wallet, devReadOnly, allowlistEmpty } = useAdminGate();
  const [tab, setTab] = useState<Tab>("bots");

  if (!ready) return <div style={{ ...S, padding: "80px 48px", textAlign: "center", color: "#999" }}>Checking access…</div>;

  if (!canView) {
    return (
      <div style={{ ...S, padding: "80px 48px", textAlign: "center", color: "#666" }}>
        <h1>Operator access only</h1>
        <p style={{ maxWidth: 460, margin: "8px auto" }}>
          Connect an admin wallet to open the console. {allowlistEmpty && <>No admin wallets are configured (<code>VITE_ADMIN_WALLETS</code>).</>}
        </p>
        <p style={{ color: "#aaa", fontSize: 13 }}>Local dev: append <code>?dev=1</code> for a read-only view.</p>
      </div>
    );
  }

  return (
    <div style={{ ...S, background: "#f8f9fa", minHeight: "100vh" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #f0f0f0", padding: "28px 48px 0" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 900, color: "#111", margin: 0 }}>🛰️ Operator Console</h1>
              <p style={{ fontSize: 13, color: "#666", margin: "4px 0 0" }}>Bots, manual resolution, and the economics of both games.</p>
            </div>
            <div style={{ textAlign: "right", fontSize: 12 }}>
              {canWrite ? (
                <span style={{ color: "#16a34a", fontWeight: 800 }}>● Admin · {wallet?.slice(0, 6)}…{wallet?.slice(-4)}</span>
              ) : (
                <span style={{ color: "#f59e0b", fontWeight: 800 }} title="Writes are blocked server-side without an admin session">● Read-only{devReadOnly ? " (dev)" : ""}</span>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: 4, marginTop: 18 }}>
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                border: "none", background: "transparent", cursor: "pointer",
                padding: "10px 16px", fontSize: 14, fontWeight: 800,
                color: tab === t.id ? "#111" : "#999",
                borderBottom: tab === t.id ? "3px solid #111" : "3px solid transparent",
              }}>{t.label}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 48px 64px" }}>
        {!canWrite && (
          <div style={{ background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", padding: 10, borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
            Read-only view. Connect an admin wallet to enable controls — every write is enforced server-side.
          </div>
        )}
        {tab === "bots" && <BotsPanel canWrite={canWrite} />}
        {tab === "economy" && <EconomyPanel canWrite={canWrite} />}
        {tab === "resolution" && <ResolutionQueuePanel canWrite={canWrite} />}
        {tab === "audit" && <AuditPanel canWrite={canWrite} />}
      </div>
    </div>
  );
}
