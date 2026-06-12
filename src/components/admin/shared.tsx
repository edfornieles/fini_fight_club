/** Shared building blocks + styles for the operator console panels. */
import React from "react";

export const S: React.CSSProperties = { fontFamily: "'Nunito', system-ui, sans-serif" };

export function Stat({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div style={{ background: "#fafafa", padding: "12px 16px", borderRadius: 10, border: "1px solid #f0f0f0" }}>
      <div style={{ fontSize: 10, color: "#888", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color, marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export function KV({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div style={{ color: "#888", fontWeight: 700, textTransform: "uppercase", fontSize: 10, letterSpacing: 0.5 }}>{k}</div>
      <div style={{ color: "#111", fontWeight: 700 }}>{v}</div>
    </div>
  );
}

export function Card({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #f0f0f0", padding: 24, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h2 style={{ fontSize: 16, fontWeight: 900, color: "#111", margin: 0 }}>{title}</h2>
        {right}
      </div>
      {children}
    </div>
  );
}

export function Btn({ children, onClick, disabled, tone = "default", small }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean;
  tone?: "default" | "danger" | "primary" | "ghost"; small?: boolean;
}) {
  const palette: Record<string, React.CSSProperties> = {
    default: { background: "#fff", color: "#333", border: "1px solid #ddd" },
    primary: { background: "#111", color: "#fff", border: "1px solid #111" },
    danger:  { background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" },
    ghost:   { background: "transparent", color: "#666", border: "1px solid transparent" },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{
      ...palette[tone], borderRadius: 8, cursor: disabled ? "not-allowed" : "pointer",
      padding: small ? "5px 10px" : "8px 14px", fontSize: small ? 12 : 13, fontWeight: 800,
      opacity: disabled ? 0.45 : 1,
    }}>{children}</button>
  );
}

export function fmtPl(n: number): string {
  if (n === 0) return "±0";
  return n > 0 ? `+${n.toLocaleString()}` : n.toLocaleString();
}
export function prettyStrategy(t: string): string {
  return t.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}
export function fmtCompact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export const STRATEGY_TYPES = [
  "momentum", "contrarian", "loyalist", "late_joiner", "flat_bias",
  "momentum_underlying", "mean_reversion", "late_sniper",
] as const;

export const STRATEGY_BLURB: Record<string, string> = {
  momentum: "Backs the leading side — chases winners. Good in trending markets, bleeds in chop.",
  contrarian: "Fades the crowd — bets the underdog when favourites look overpriced.",
  loyalist: "Always picks a fixed side. Pure benchmark — wins only when that side has a real edge.",
  flat_bias: "Pure one-side bias. Beating 50% means the side genuinely has the edge.",
  late_joiner: "Joins late on near-certain winners for small steady gains.",
  momentum_underlying: "Reads 5-min price velocity. Catches real moves the crowd hasn't priced.",
  mean_reversion: "Bets against spikes — wins when moves overshoot and snap back.",
  late_sniper: "Acts in the final seconds when the feed is clean — near-riskless.",
};
