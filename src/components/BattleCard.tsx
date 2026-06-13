import { lazy, Suspense, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Battle } from "../data/mockBattles";
import { battleEndsAtMs } from "../data/cryptoSim";
import { getCachedPrices } from "../lib/priceProviders";
import { priceSeries } from "../lib/velocity";
import { seedHistoryFor } from "../lib/historicalPrices";
import { ArenaErrorBoundary } from "./three/ArenaErrorBoundary";

// Loaded only when a card is hovered, so the arena 3D never weighs on the grid.
const CryptoArenaBattle3D = lazy(() => import("./three/CryptoArenaBattle3D"));

export type { BattleStatus, BattleType, Battle } from "../data/mockBattles";

/** Compact price sparkline — last ~6h of movement, coloured by direction. */
function MiniSparkline({ asset }: { asset: string }) {
  const series = priceSeries(asset, 6 * 60 * 60 * 1000);
  if (series.length < 2) {
    return <div style={{ width: 64, height: 24 }} />;
  }
  const prices = series.map(s => s.price);
  const min = Math.min(...prices), max = Math.max(...prices);
  const span = max - min || 1;
  const W = 64, H = 24, pad = 2;
  const pts = series.map((s, i) => {
    const x = pad + (i / (series.length - 1)) * (W - 2 * pad);
    const y = pad + (1 - (s.price - min) / span) * (H - 2 * pad);
    return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
  const up = prices[prices.length - 1] >= prices[0];
  const stroke = up ? "#16a34a" : "#dc2626";
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
      <path d={pts} fill="none" stroke={stroke} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function fmtPrice(n: number): string {
  if (n >= 1000) return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (n >= 1) return "$" + n.toFixed(2);
  return "$" + n.toFixed(4);
}

const ASSET_COLORS: Record<string, string> = {
  BTC: "#f7931a", ETH: "#627eea", SOL: "#9945ff", DOGE: "#c3a634",
  LINK: "#2a5ada", UNI: "#ff007a", AVAX: "#e84142", BNB: "#f3ba2f",
  MATIC: "#8247e5", XTZ: "#a6e000",
};

function fmtTime(ms: number): string {
  if (ms <= 0) return "Ended";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  // Under an hour: live mm:ss countdown so it visibly ticks every second.
  if (h < 1) return `${m}:${String(s % 60).padStart(2, "0")}`;
  if (h < 24) return `${h}h ${String(m % 60).padStart(2, "0")}m`;
  return `${Math.floor(h / 24)}d`;
}

/** 1-second clock tick — shared so all cards re-render together each second. */
function useSecondTick() {
  const [, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
}

function StatusChip({ status, endsInMs }: { status: string; endsInMs: number }) {
  const endingSoon = endsInMs > 0 && endsInMs < 1000 * 60 * 20;   // < 20 min → red "Ending soon"
  const aboutToEnd = endsInMs > 0 && endsInMs < 1000 * 30;        // < 30 s → blink
  if (status === "live") return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 800,
      padding: "3px 9px", borderRadius: 100,
      background: endingSoon ? "#fee2e2" : "#dcfce7",
      color: endingSoon ? "#dc2626" : "#15803d",
      animation: aboutToEnd ? "fini-blink 0.9s steps(2, start) infinite" : undefined,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: endingSoon ? "#ef4444" : "#22c55e" }} />
      {endingSoon ? "Ending soon" : "Live"}
      <style>{`@keyframes fini-blink { 50% { opacity: 0.35; } }`}</style>
    </span>
  );
  if (status === "upcoming")  return <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 100, background: "#dbeafe", color: "#1d4ed8" }}>Upcoming</span>;
  if (status === "resolving") return <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 100, background: "#fef9c3", color: "#854d0e" }}>Resolving</span>;
  return <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 100, background: "#f3f4f6", color: "#6b7280" }}>Resolved</span>;
}

export function BattleCard({ battle }: { battle: Battle }) {
  const navigate = useNavigate();
  const { sideA, sideB } = battle;
  useSecondTick(); // re-render every second so the countdown ticks + sparkline updates
  // Seed real recent price history once so the sparklines have a curve to draw.
  useEffect(() => {
    battle.assets.forEach(a => { void seedHistoryFor(a); });
  }, [battle.assets]);
  const prices = getCachedPrices();
  // Live timing from the battle's real anchored end time.
  // In a chained recurring market, battles only have two states: live or
  // ended. The moment one resolves the next round starts — there's no
  // "upcoming" pre-window. Anything still on the clock IS live.
  const endsAt = battleEndsAtMs(battle.id, battle.endsInMs);
  const now = Date.now();
  const msToEnd = Math.max(0, endsAt - now);
  const phase: "live" | "ended" = msToEnd > 0 ? "live" : "ended";
  const remaining = msToEnd;

  const [hover, setHover] = useState(false);
  const famA = battle.familyA ?? battle.assets[0];
  const famB = battle.familyB ?? battle.assets[1]; // undefined for up/down (same family fields two)

  return (
    <div onClick={() => navigate(`/battle/${battle.id}`)} style={{
      fontFamily: "'Nunito', system-ui, sans-serif",
      background: "#fff", borderRadius: 20, border: "1.5px solid #f0f0f0",
      boxShadow: hover ? "0 8px 24px rgba(0,0,0,0.10)" : "0 2px 12px rgba(0,0,0,0.06)",
      cursor: "pointer", overflow: "hidden",
      display: "flex", flexDirection: "column",
      transform: hover ? "translateY(-2px)" : "",
      transition: "transform 0.15s, box-shadow 0.15s",
    }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Thumbnail strip — two Finis squaring off; springs to a live 3D duel on hover. */}
      <div style={{ height: hover ? 170 : 68, background: "#fce8e8", overflow: "hidden", position: "relative", transition: "height 0.22s ease" }}>
        {hover ? (
          <Suspense fallback={<FaceOff famA={famA} famB={famB ?? famA} />}>
            <ArenaErrorBoundary>
              <CryptoArenaBattle3D
                battleId={battle.id}
                familyA={famA}
                familyB={famB}
                sideAPct={sideA.pct}
                sideBPct={sideB.pct}
                resolved={phase === "ended"}
                compact
              />
            </ArenaErrorBoundary>
          </Suspense>
        ) : (
          <FaceOff famA={famA} famB={famB ?? famA} />
        )}
        <div style={{ position: "absolute", top: 8, left: 8, zIndex: 3 }}>
          <StatusChip status={phase === "live" ? "live" : battle.status} endsInMs={remaining} />
        </div>
        <div style={{ position: "absolute", top: 8, right: 8, zIndex: 3, fontSize: 10, fontWeight: 700, color: "#aaa", background: "rgba(255,255,255,0.85)", padding: "2px 7px", borderRadius: 6 }}>
          {battle.durationLabel}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "14px 16px 12px", flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#111", lineHeight: 1.3 }}>{battle.title}</div>
          <div style={{ fontSize: 11, color: "#888", marginTop: 3, lineHeight: 1.4 }}>{battle.question}</div>
        </div>

        {/* Live price strip — real price + 24h % + sparkline per asset */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {battle.assets.map(a => {
            const p = prices?.[a];
            const chg = p?.usd_24h_change ?? null;
            const up = (chg ?? 0) >= 0;
            return (
              <div key={a} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: ASSET_COLORS[a] ?? "#888", display: "inline-block", flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#111" }}>{a}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#555", fontVariantNumeric: "tabular-nums" }}>
                    {p?.usd ? fmtPrice(p.usd) : "—"}
                  </span>
                  {chg != null && (
                    <span style={{ fontSize: 10, fontWeight: 800, color: up ? "#16a34a" : "#dc2626" }}>
                      {up ? "▲" : "▼"}{Math.abs(chg).toFixed(2)}%
                    </span>
                  )}
                </div>
                <MiniSparkline asset={a} />
              </div>
            );
          })}
        </div>

        {/* Probability bar */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 800, marginBottom: 4 }}>
            <span style={{ color: "#16a34a" }}>{sideA.label} {sideA.pct}%</span>
            <span style={{ color: "#dc2626" }}>{sideB.label} {sideB.pct}%</span>
          </div>
          <div style={{ height: 5, borderRadius: 100, background: "#f3f4f6", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${sideA.pct}%`, background: "linear-gradient(90deg, #22c55e, #16a34a)", borderRadius: 100 }} />
          </div>
        </div>

        {/* Side buttons — show the projected payout for a 100 CUTE$ stake so
            the player sees the value of each side without doing the math. */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
          {[
            { label: sideA.label, pct: sideA.pct, bg: "#dcfce7", fg: "#15803d", sub: "#16a34a" },
            { label: sideB.label, pct: sideB.pct, bg: "#fee2e2", fg: "#dc2626", sub: "#dc2626" },
          ].map(side => {
            const winFor100 = side.pct > 0 ? Math.round(10000 / side.pct) : 0;
            return (
              <button key={side.label} onClick={e => e.stopPropagation()} style={{
                padding: "6px 0", borderRadius: 10, border: "none", cursor: "pointer",
                fontSize: 12, fontWeight: 800, background: side.bg, color: side.fg,
                display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
              }}>
                <span>{side.label} <span style={{ opacity: 0.7 }}>{side.pct}%</span></span>
                <span style={{ fontSize: 9, fontWeight: 700, color: side.sub, opacity: 0.9 }}>
                  100 → {winFor100.toLocaleString()}
                </span>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 4, borderTop: "1px solid #f3f4f6" }}>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            {battle.assets.map(a => (
              <span key={a} style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 100, background: ASSET_COLORS[a] + "20", color: ASSET_COLORS[a] }}>{a}</span>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, fontSize: 11, color: "#aaa", fontWeight: 600 }}>
            <span>🪙 {battle.volumeK}K</span>
            {phase === "live" && <span style={{ fontVariantNumeric: "tabular-nums" }}>⏱ ends {fmtTime(remaining)}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Static two-Fini face-off shown on every tile — they lunge in and clash. */
function FaceOff({ famA, famB }: { famA: string; famB: string }) {
  return (
    <>
      <div style={{ position: "absolute", inset: 0, display: "flex" }}>
        <div style={{ flex: 1, background: ASSET_COLORS[famA] + "22", display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 12 }}>
          <div style={{ animation: "tileSparL 1.5s ease-in-out infinite" }}><FiniGlyph family={famA} size={42} /></div>
        </div>
        <div style={{ flex: 1, background: ASSET_COLORS[famB] + "22", display: "flex", alignItems: "center", justifyContent: "flex-start", paddingLeft: 12 }}>
          <div style={{ animation: "tileSparR 1.5s ease-in-out infinite" }}><FiniGlyph family={famB} size={42} /></div>
        </div>
      </div>
      <div style={{ position: "absolute", left: "50%", top: "50%", zIndex: 2, fontSize: 15, animation: "tileClash 1.5s ease-in-out infinite", pointerEvents: "none" }}>⚔️</div>
    </>
  );
}

function FiniGlyph({ family, size }: { family: string; size: number }) {
  const color = ASSET_COLORS[family] ?? "#aaa";
  const emoji: Record<string, string> = { BTC: "👑", ETH: "🔮", SOL: "⚡", DOGE: "🐕", LINK: "🔗", UNI: "🦄", AVAX: "🏔", BNB: "⭕", MATIC: "🔷", XTZ: "🧊" };
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: color + "30", border: `2px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.44 }}>
      {emoji[family] ?? "⚔️"}
    </div>
  );
}
