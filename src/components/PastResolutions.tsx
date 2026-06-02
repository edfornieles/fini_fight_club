/**
 * PastResolutions — archive of previously-resolved instances of this
 * battle's template. The recurring nature of every market means there's
 * a deep history per template (btc-updown-1h has 11 resolved rounds,
 * btc-updown-15m has 43, etc.).
 *
 * Compact picker: click to open a dropdown of recent resolved rounds.
 * Each row shows the round window, the winning side, and the % move.
 * Selecting a row navigates to that instance's battle page, which loads
 * the resolved view (WinnerBanner + Resolution Audit already render).
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, isOnline } from "../lib/supabase";

interface ResolvedRow {
  id: string;
  start_time: string;
  end_time: string;
  asset_a: string;
  asset_b: string | null;
  official_start_price_a: number | null;
  official_end_price_a: number | null;
  official_start_price_b: number | null;
  official_end_price_b: number | null;
  winning_side: "A" | "B" | null;
}

function templateOf(id: string): string {
  const i = id.indexOf(":");
  return i === -1 ? id : id.slice(0, i);
}

function fmtPct(start: number | null, end: number | null): string | null {
  if (start == null || end == null || start <= 0) return null;
  const pct = ((end - start) / start) * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
}

function fmtRow(r: ResolvedRow): string {
  const start = new Date(r.start_time);
  // Same-day windows show date + window time; cross-day show just the date.
  const date = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const t = start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${date} · ${t}`;
}

export function PastResolutions({ currentBattleId }: { currentBattleId: string }) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<ResolvedRow[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const template = templateOf(currentBattleId);

  useEffect(() => {
    if (!isOnline) { setLoading(false); return; }
    let alive = true;
    setLoading(true);
    supabase
      .from("battle_instances")
      .select("id,start_time,end_time,asset_a,asset_b,official_start_price_a,official_end_price_a,official_start_price_b,official_end_price_b,winning_side")
      .eq("template_id", template)
      .eq("status", "resolved")
      .neq("id", currentBattleId)
      .order("end_time", { ascending: false })
      .limit(12)
      .then(({ data }) => {
        if (!alive) return;
        setRows((data ?? []) as ResolvedRow[]);
        setLoading(false);
      });
    return () => { alive = false; };
  }, [template, currentBattleId]);

  if (loading || rows.length === 0) return null;

  return (
    <div style={{ position: "relative", fontFamily: "'Nunito', system-ui, sans-serif" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "6px 12px", borderRadius: 100,
          background: "#fff", border: "1.5px solid #e5e7eb",
          fontSize: 12, fontWeight: 700, color: "#111",
          cursor: "pointer",
        }}
      >
        📜 Past rounds <span style={{ color: "#888", fontWeight: 600 }}>({rows.length})</span>
        <span style={{ fontSize: 9, color: "#aaa" }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "100%", left: 0, marginTop: 6,
          background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 12,
          boxShadow: "0 12px 32px rgba(0,0,0,0.10)",
          minWidth: 240, maxHeight: 360, overflowY: "auto", zIndex: 50,
        }}>
          <div style={{
            padding: "10px 14px", borderBottom: "1px solid #f0f0f0",
            fontSize: 10, fontWeight: 800, color: "#888",
            textTransform: "uppercase", letterSpacing: 0.5,
          }}>
            Resolved rounds · same template
          </div>
          {rows.map(r => {
            const isOutperform = !!r.asset_b;
            const pctA = fmtPct(r.official_start_price_a, r.official_end_price_a);
            const pctB = fmtPct(r.official_start_price_b, r.official_end_price_b);
            const winLabel = r.winning_side === "A"
              ? (isOutperform ? r.asset_a : "Up")
              : r.winning_side === "B"
                ? (isOutperform ? (r.asset_b ?? "B") : "Down")
                : "—";
            const winColor = r.winning_side === "A" ? "#16a34a" : r.winning_side === "B" ? "#dc2626" : "#888";
            const summaryPct = isOutperform
              ? (pctA && pctB ? `${r.asset_a} ${pctA} · ${r.asset_b} ${pctB}` : null)
              : pctA;
            return (
              <button
                key={r.id}
                onClick={() => { setOpen(false); navigate(`/battle/${r.id}`); }}
                style={{
                  display: "block", width: "100%", textAlign: "left",
                  padding: "10px 14px", border: "none", background: "transparent",
                  borderBottom: "1px solid #f5f5f5", cursor: "pointer",
                  fontFamily: "'Nunito', system-ui, sans-serif",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "#fafafa")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#111" }}>{fmtRow(r)}</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: winColor }}>
                    {winLabel === "Up" ? "▲" : winLabel === "Down" ? "▼" : ""} {winLabel}
                  </span>
                </div>
                {summaryPct && (
                  <div style={{ fontSize: 10, color: "#888", marginTop: 2, fontFamily: "monospace" }}>
                    {summaryPct}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
