/**
 * /strategies — the Strategy Lab.
 *
 * Players configure and deploy autonomous Forecasters that watch live Crypto
 * Arena battles and place predictions when their trigger conditions fire.
 *
 * UI:
 *   - List of deployed strategies with per-strategy stats (win rate, net P&L)
 *   - "+ Deploy new strategy" button → modal with template picker + params
 *   - Each card has Pause / Configure / Retire actions
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { useStrategies, STRATEGY_META, type Strategy, type StrategyType } from "../state/strategiesStore";

const S: React.CSSProperties = { fontFamily: "'Nunito', system-ui, sans-serif" };

const SUPPORTED_ASSETS = ["BTC", "ETH", "SOL", "DOGE", "BNB", "LINK", "AVAX", "UNI", "MATIC", "XTZ"];

export function StrategiesPage() {
  const strategies = useStrategies(s => s.strategies);
  const [showNew, setShowNew] = useState(false);

  // Sort: enabled first, then by total forecasts desc
  const sorted = strategies.slice().sort((a, b) => {
    if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
    return b.stats.totalForecasts - a.stats.totalForecasts;
  });

  return (
    <div style={{ ...S, background: "#f8f9fa", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #f0f0f0", padding: "36px 48px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
          <div>
            <h1 style={{ fontSize: 30, fontWeight: 900, color: "#111", margin: 0 }}>🧪 Strategy Lab</h1>
            <p style={{ fontSize: 14, color: "#888", marginTop: 6, marginBottom: 0, fontWeight: 500, maxWidth: 640 }}>
              Deploy autonomous Forecasters that watch the Crypto Arena and place predictions automatically.
              Configure their trigger, set a daily cap, and let them run while you're away.
            </p>
          </div>
          <button onClick={() => setShowNew(true)} style={{
            background: "linear-gradient(135deg, #f472b6, #ec4899)", color: "#fff",
            border: "none", borderRadius: 100, padding: "12px 22px",
            fontSize: 14, fontWeight: 800, cursor: "pointer", flexShrink: 0,
            boxShadow: "0 4px 14px rgba(244,114,182,0.30)",
          }}>+ Deploy Forecaster</button>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 48px" }}>
        {sorted.length === 0 ? <EmptyState onCreate={() => setShowNew(true)} /> :
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 16 }}>
            {sorted.map(s => <StrategyCard key={s.id} strategy={s} />)}
          </div>
        }
      </div>

      {showNew && <DeployModal onClose={() => setShowNew(false)} />}
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div style={{ background: "#fff", borderRadius: 24, border: "1.5px solid #f0f0f0", padding: "60px 32px", textAlign: "center" }}>
      <div style={{ fontSize: 64, marginBottom: 8 }}>🧪</div>
      <div style={{ fontSize: 18, fontWeight: 900, color: "#111", marginBottom: 6 }}>No Forecasters deployed yet</div>
      <div style={{ fontSize: 13, color: "#666", marginBottom: 24, fontWeight: 500, maxWidth: 520, marginInline: "auto", lineHeight: 1.6 }}>
        Deploy a strategy and it'll run in the background, placing predictions on live battles when its
        trigger condition fires. Win rate + net P&L are tracked per strategy.
      </div>
      <button onClick={onCreate} style={{
        background: "linear-gradient(135deg, #f472b6, #ec4899)", color: "#fff",
        border: "none", borderRadius: 100, padding: "12px 24px",
        fontSize: 14, fontWeight: 800, cursor: "pointer",
        boxShadow: "0 4px 14px rgba(244,114,182,0.30)",
      }}>+ Deploy your first Forecaster</button>
    </div>
  );
}

function StrategyCard({ strategy }: { strategy: Strategy }) {
  const meta = STRATEGY_META[strategy.type];
  const toggle = useStrategies(s => s.toggle);
  const remove = useStrategies(s => s.remove);
  const { wins, losses, voided, totalForecasts, netProfit, forecastsToday } = strategy.stats;
  const settled = wins + losses + voided;
  const winRate = settled > 0 ? Math.round((wins / settled) * 100) : null;
  const profitColor = netProfit > 0 ? "#16a34a" : netProfit < 0 ? "#dc2626" : "#888";

  return (
    <div style={{
      background: "#fff", borderRadius: 16,
      border: `1.5px solid ${strategy.enabled ? meta.color + "40" : "#f0f0f0"}`,
      padding: "18px 20px",
      opacity: strategy.enabled ? 1 : 0.72,
      position: "relative",
    }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: meta.color + "20", color: meta.color,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18, flexShrink: 0,
        }}>{meta.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: "#111" }}>{strategy.name}</div>
          <div style={{ fontSize: 11, color: "#888", fontWeight: 600 }}>{meta.name}</div>
        </div>
        <span style={{
          fontSize: 9, fontWeight: 800, padding: "3px 8px", borderRadius: 100,
          background: strategy.enabled ? "#dcfce7" : "#f3f4f6",
          color: strategy.enabled ? "#15803d" : "#888",
          textTransform: "uppercase", letterSpacing: 0.5,
        }}>{strategy.enabled ? "● Active" : "Paused"}</span>
      </div>

      {/* Stats grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
        <StatTile label="Today" value={`${forecastsToday}/${strategy.maxPerDay}`} />
        <StatTile label="Win rate" value={winRate !== null ? `${winRate}%` : "—"} color={winRate !== null && winRate >= 55 ? "#16a34a" : winRate !== null && winRate <= 45 ? "#dc2626" : "#666"} />
        <StatTile label="Net P&L" value={netProfit >= 0 ? `+${netProfit.toLocaleString()}` : netProfit.toLocaleString()} color={profitColor} />
      </div>

      {/* Config strip */}
      <div style={{ fontSize: 11, color: "#666", lineHeight: 1.5, marginBottom: 12, fontWeight: 500 }}>
        <span style={{ color: "#888" }}>Capital </span><b style={{ color: "#854d0e" }}>{strategy.stake} FINI$</b>
        <span style={{ color: "#aaa" }}> · </span>
        <span style={{ color: "#888" }}>Assets </span>
        <b style={{ color: "#111" }}>{strategy.params.assetFilter.length === 0 ? "all" : strategy.params.assetFilter.join(", ")}</b>
        {strategy.params.sideFilter && <>
          <span style={{ color: "#aaa" }}> · </span>
          <span style={{ color: "#888" }}>Side </span><b style={{ color: "#111" }}>{strategy.params.sideFilter}</b>
        </>}
        <span style={{ color: "#aaa" }}> · </span>
        <span style={{ color: "#888" }}>{totalForecasts} total forecasts</span>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={() => toggle(strategy.id)} style={{
          flex: 1, padding: "8px 0", borderRadius: 100,
          background: strategy.enabled ? "#f3f4f6" : meta.color,
          color: strategy.enabled ? "#666" : "#fff",
          border: "none", fontSize: 12, fontWeight: 800, cursor: "pointer",
        }}>{strategy.enabled ? "⏸ Pause" : "▶ Activate"}</button>
        <button onClick={() => { if (confirm(`Retire "${strategy.name}"?`)) remove(strategy.id); }} style={{
          padding: "8px 14px", borderRadius: 100,
          background: "transparent", color: "#888",
          border: "1.5px solid #e5e7eb",
          fontSize: 12, fontWeight: 700, cursor: "pointer",
        }}>🗑</button>
      </div>
    </div>
  );
}

function StatTile({ label, value, color = "#111" }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: "#fafafa", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
      <div style={{ fontSize: 9, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 900, color, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function DeployModal({ onClose }: { onClose: () => void }) {
  const create = useStrategies(s => s.create);
  const [type, setType] = useState<StrategyType>("momentum");
  const [name, setName] = useState("");
  const [stake, setStake] = useState(50);
  const [maxPerDay, setMaxPerDay] = useState(20);
  const [assetFilter, setAssetFilter] = useState<string[]>([]);
  const [sideFilter, setSideFilter] = useState<"A" | "B">("A");
  const [pctThreshold, setPctThreshold] = useState(40);

  const meta = STRATEGY_META[type];
  const needsSide = type === "loyalist" || type === "flat_bias";
  const needsThreshold = type === "contrarian";

  function deploy() {
    const finalName = name.trim() || `${meta.name} ${new Date().getMinutes()}m`;
    create({
      name: finalName,
      type,
      enabled: true,
      stake,
      maxPerDay,
      params: {
        assetFilter,
        ...(needsSide ? { sideFilter } : {}),
        ...(needsThreshold ? { pctThreshold } : {}),
      },
    });
    onClose();
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9000,
      background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      fontFamily: "'Nunito', system-ui, sans-serif",
    }}>
      <div style={{
        background: "#fff", borderRadius: 20, padding: 28,
        maxWidth: 540, width: "100%",
        maxHeight: "calc(100vh - 40px)", overflowY: "auto",
        boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: "#111", margin: 0 }}>Deploy a Forecaster</h2>
          <button onClick={onClose} style={{ background: "transparent", border: "none", fontSize: 22, color: "#888", cursor: "pointer" }}>×</button>
        </div>

        {/* Template picker */}
        <div style={{ marginBottom: 16 }}>
          <Label>Strategy template</Label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {(Object.keys(STRATEGY_META) as StrategyType[]).map(t => {
              const m = STRATEGY_META[t];
              const active = type === t;
              return (
                <button key={t} onClick={() => setType(t)} style={{
                  background: active ? m.color + "12" : "#fff",
                  border: `1.5px solid ${active ? m.color : "#e5e7eb"}`,
                  borderRadius: 12, padding: "10px 12px",
                  textAlign: "left", cursor: "pointer",
                }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#111" }}>{m.icon} {m.name}</div>
                  <div style={{ fontSize: 10, color: "#888", marginTop: 3, lineHeight: 1.4 }}>{m.description}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Name */}
        <Field label="Name (optional)">
          <input value={name} onChange={e => setName(e.target.value)} placeholder={meta.name}
            style={inputStyle} />
        </Field>

        {/* Capital + daily cap */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Capital per forecast (FINI$)">
            <input type="number" min={10} value={stake} onChange={e => setStake(Math.max(10, Number(e.target.value)))}
              style={inputStyle} />
          </Field>
          <Field label="Max forecasts per day">
            <input type="number" min={1} value={maxPerDay} onChange={e => setMaxPerDay(Math.max(1, Number(e.target.value)))}
              style={inputStyle} />
          </Field>
        </div>

        {/* Type-specific params */}
        {needsSide && (
          <Field label="Always pick side">
            <div style={{ display: "flex", gap: 6 }}>
              {(["A", "B"] as const).map(s => (
                <button key={s} onClick={() => setSideFilter(s)} style={{
                  flex: 1, padding: "10px", borderRadius: 8,
                  background: sideFilter === s ? "#111" : "#fff",
                  color: sideFilter === s ? "#fff" : "#666",
                  border: "1.5px solid #e5e7eb",
                  fontSize: 13, fontWeight: 700, cursor: "pointer",
                }}>{s === "A" ? "Side A (Up / first)" : "Side B (Down / second)"}</button>
              ))}
            </div>
          </Field>
        )}
        {needsThreshold && (
          <Field label="Underdog threshold (pick side below this %)">
            <input type="range" min={20} max={49} value={pctThreshold} onChange={e => setPctThreshold(Number(e.target.value))}
              style={{ width: "100%" }} />
            <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>Trigger when one side falls below <b style={{ color: "#111" }}>{pctThreshold}%</b></div>
          </Field>
        )}

        {/* Asset filter */}
        <Field label="Assets to watch (leave empty = all)">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {SUPPORTED_ASSETS.map(a => {
              const active = assetFilter.includes(a);
              return (
                <button key={a} onClick={() => setAssetFilter(active ? assetFilter.filter(x => x !== a) : [...assetFilter, a])} style={{
                  padding: "6px 12px", borderRadius: 100,
                  background: active ? "#111" : "#fff",
                  color: active ? "#fff" : "#666",
                  border: "1.5px solid #e5e7eb",
                  fontSize: 11, fontWeight: 700, cursor: "pointer",
                }}>{a}</button>
              );
            })}
          </div>
        </Field>

        <button onClick={deploy} style={{
          marginTop: 12, width: "100%",
          background: "linear-gradient(135deg, #f472b6, #ec4899)", color: "#fff",
          border: "none", borderRadius: 100, padding: "12px 0",
          fontSize: 14, fontWeight: 900, cursor: "pointer",
          boxShadow: "0 4px 14px rgba(244,114,182,0.30)",
        }}>🚀 Deploy</button>
        <div style={{ fontSize: 11, color: "#aaa", textAlign: "center", marginTop: 10, lineHeight: 1.5 }}>
          You can pause or retire the strategy any time. Pause stops new forecasts; existing open ones still settle.
        </div>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 10, fontWeight: 800, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{children}</div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 14 }}><Label>{label}</Label>{children}</div>;
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", borderRadius: 8,
  border: "1.5px solid #e5e7eb", fontSize: 13, fontWeight: 600, color: "#111",
  fontFamily: "'Nunito', system-ui, sans-serif", boxSizing: "border-box",
};

// Re-export for the placeholder link (lets us reference Link in this file via React-Router)
export { Link };
