/** Presentational list of a wallet's past Crypto Arena bets + results. */
import { Link } from "react-router-dom";
import type { BetRow } from "../hooks/useBetHistory";

export function BetHistoryList({ bets, loading }: { bets: BetRow[]; loading: boolean }) {
  return (
    <div style={{ background: "#fff", borderRadius: 20, border: "1.5px solid #f0f0f0", padding: "22px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#111" }}>⚔️ Your battles</div>
        <div style={{ fontSize: 12, color: "#aaa" }}>{loading ? "loading…" : `${bets.length} predictions`}</div>
      </div>
      {!loading && bets.length === 0 && (
        <div style={{ padding: "28px 0", textAlign: "center", color: "#999", fontSize: 13 }}>
          No predictions yet. <Link to="/crypto" style={{ color: "#f472b6", fontWeight: 700 }}>Enter the arena →</Link>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 420, overflowY: "auto" }}>
        {bets.map((b) => {
          const sideLabel = b.assetB ? (b.side === "A" ? b.assetA : b.assetB) : (b.side === "A" ? "Up" : "Down");
          const tone = b.outcome === "won" ? { c: "#15803d", bg: "#dcfce7", t: `WON +${((b.payout ?? 0) - b.stake).toLocaleString()}` }
            : b.outcome === "lost" ? { c: "#b91c1c", bg: "#fee2e2", t: `LOST −${b.stake.toLocaleString()}` }
            : b.outcome === "void" ? { c: "#6d28d9", bg: "#f3e8ff", t: "VOID · refunded" }
            : { c: "#a16207", bg: "#fef9c3", t: "OPEN" };
          return (
            <Link key={b.id} to={`/battle/${b.battleId}`} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
              padding: "10px 12px", borderRadius: 10, background: "#fafafa",
              textDecoration: "none", color: "inherit", borderLeft: `3px solid ${b.side === "A" ? "#22c55e" : "#ef4444"}`,
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#111", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.title}</div>
                <div style={{ fontSize: 11, color: "#888", fontWeight: 600 }}>
                  <span style={{ color: b.side === "A" ? "#16a34a" : "#dc2626", fontWeight: 800 }}>{sideLabel}</span>
                  {" · "}{b.stake.toLocaleString()} CUTE$
                  {" · "}{new Date(b.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </div>
              </div>
              <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 800, color: tone.c, background: tone.bg, padding: "3px 9px", borderRadius: 100, whiteSpace: "nowrap" }}>{tone.t}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
