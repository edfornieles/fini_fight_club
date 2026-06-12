/**
 * /strategies — Automated Attack.
 *
 * Players deploy autonomous Forecasters with:
 *   - Allocated budget (held by the strategy, segregated from wallet)
 *   - Stop conditions (auto-pause at +X gain or -Y loss)
 *   - Reinvest mode (compound back to budget vs. save profits separately)
 *   - Market-condition filter (run only in bullish / bearish / volatile / calm markets)
 *
 * Retiring a strategy refunds budget.remaining + savedProfits to the wallet.
 */
import { useState } from "react";
import {
  useStrategies, STRATEGY_META, MARKET_CONDITION_META,
  type Strategy, type StrategyType, type ReinvestMode, type MarketCondition,
} from "../state/strategiesStore";
import { useCoinStore } from "../state/coinStore";
import { useNotifications } from "../state/notificationsStore";

const S: React.CSSProperties = { fontFamily: "'Nunito', system-ui, sans-serif" };

const SUPPORTED_ASSETS = ["BTC", "ETH", "SOL", "DOGE", "BNB", "LINK", "AVAX", "UNI", "MATIC", "XTZ"];

const PAUSE_REASON_LABEL: Record<string, string> = {
  manual: "Paused by you",
  budget_exhausted: "Budget exhausted",
  hit_gain_target: "🎯 Gain target hit",
  hit_loss_limit: "🛑 Loss limit hit",
  market_condition_mismatch: "Waiting for market conditions",
};

export function StrategiesPage() {
  const strategies = useStrategies(s => s.strategies);
  const walletBalance = useCoinStore(s => s.balance);
  const [showNew, setShowNew] = useState(false);

  const sorted = strategies.slice().sort((a, b) => {
    if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
    return b.stats.totalForecasts - a.stats.totalForecasts;
  });

  // Total currently locked inside deployed strategies (budget + saved profits)
  const totalAllocated = strategies.reduce((sum, s) => sum + s.budget.remaining + s.budget.savedProfits, 0);

  return (
    <div style={{ ...S, background: "#f8f9fa", minHeight: "100vh" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #f0f0f0", padding: "36px 48px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
          <div>
            <h1 style={{ fontSize: 30, fontWeight: 900, color: "#111", margin: 0 }}>⚙️ Automated Attack</h1>
            <p style={{ fontSize: 14, color: "#888", marginTop: 6, marginBottom: 0, fontWeight: 500, maxWidth: 640 }}>
              Deploy autonomous attacks that watch the Crypto Arena and place predictions automatically.
              Allocate budget, set stop conditions, choose compound or save mode, and let them run.
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10, flexShrink: 0 }}>
            {/* Wallet + locked summary */}
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{
                background: "linear-gradient(135deg, #fef3c7, #fde68a)",
                border: "1.5px solid #fbbf24",
                borderRadius: 12, padding: "10px 16px",
                color: "#854d0e", fontWeight: 800,
                textAlign: "right", minWidth: 140,
              }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: "#92400e", textTransform: "uppercase", letterSpacing: 0.5, opacity: 0.8 }}>Wallet</div>
                <div style={{ fontSize: 20, fontWeight: 900 }}>
                  🪙 {walletBalance.toLocaleString()}
                  <span style={{ fontSize: 11, opacity: 0.7, marginLeft: 4 }}>CUTE$</span>
                </div>
              </div>
              {totalAllocated > 0 && (
                <div style={{
                  background: "#f3f4f6",
                  border: "1.5px solid #e5e7eb",
                  borderRadius: 12, padding: "10px 16px",
                  color: "#555", fontWeight: 700,
                  textAlign: "right", minWidth: 140,
                }}>
                  <div style={{ fontSize: 9, fontWeight: 800, color: "#888", textTransform: "uppercase", letterSpacing: 0.5 }}>Locked in attacks</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: "#111" }}>
                    {totalAllocated.toLocaleString()}
                    <span style={{ fontSize: 11, color: "#888", marginLeft: 4 }}>CUTE$</span>
                  </div>
                </div>
              )}
            </div>
            <button onClick={() => setShowNew(true)} style={{
              background: "linear-gradient(135deg, #f472b6, #ec4899)", color: "#fff",
              border: "none", borderRadius: 100, padding: "12px 22px",
              fontSize: 14, fontWeight: 800, cursor: "pointer",
              boxShadow: "0 4px 14px rgba(244,114,182,0.30)",
            }}>+ Deploy an Attack</button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 48px" }}>
        {sorted.length === 0 ? <EmptyState onCreate={() => setShowNew(true)} /> :
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))", gap: 16 }}>
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
      <div style={{ fontSize: 18, fontWeight: 900, color: "#111", marginBottom: 6 }}>No attacks deployed yet</div>
      <div style={{ fontSize: 13, color: "#666", marginBottom: 24, fontWeight: 500, maxWidth: 520, marginInline: "auto", lineHeight: 1.6 }}>
        Allocate a budget, pick a strategy template, configure your stop conditions and let it run while
        you're away. The strategy uses its OWN budget — your main wallet stays protected.
      </div>
      <button onClick={onCreate} style={{
        background: "linear-gradient(135deg, #f472b6, #ec4899)", color: "#fff",
        border: "none", borderRadius: 100, padding: "12px 24px",
        fontSize: 14, fontWeight: 800, cursor: "pointer",
        boxShadow: "0 4px 14px rgba(244,114,182,0.30)",
      }}>+ Deploy your first Attack</button>
    </div>
  );
}

function StrategyCard({ strategy }: { strategy: Strategy }) {
  const meta = STRATEGY_META[strategy.type];
  const moodMeta = MARKET_CONDITION_META[strategy.marketCondition];
  const toggle = useStrategies(s => s.toggle);
  const retire = useStrategies(s => s.retire);
  const earn = useCoinStore(s => s.earn);
  const pushNotif = useNotifications(s => s.push);
  const [editing, setEditing] = useState(false);

  const { wins, losses, voided, totalForecasts, netProfit, forecastsToday } = strategy.stats;
  const settled = wins + losses + voided;
  const winRate = settled > 0 ? Math.round((wins / settled) * 100) : null;
  const profitColor = netProfit > 0 ? "#16a34a" : netProfit < 0 ? "#dc2626" : "#888";
  const budgetPct = strategy.budget.allocated > 0
    ? Math.max(0, Math.min(100, (strategy.budget.remaining / strategy.budget.allocated) * 100))
    : 0;

  function handleRetire() {
    const r = retire(strategy.id);
    if (!r) return;
    if (r.refund > 0) {
      earn(r.refund);
      pushNotif({
        tone: "info", icon: "💰",
        title: `Attack retired — ${r.refund.toLocaleString()} CUTE$ refunded`,
        body: `${strategy.name} returned remaining budget + saved profits to your wallet.`,
      });
    }
  }

  return (
    <div style={{
      background: "#fff", borderRadius: 16,
      border: `1.5px solid ${strategy.enabled ? meta.color + "40" : "#f0f0f0"}`,
      padding: "18px 20px",
      opacity: strategy.enabled ? 1 : 0.85,
      position: "relative",
    }}>
      {/* Header */}
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

      {/* Auto-pause reason (if any) */}
      {!strategy.enabled && strategy.pausedReason && (
        <div style={{
          background: "#fef3c7", border: "1px solid #fcd34d",
          borderRadius: 8, padding: "6px 10px",
          fontSize: 11, color: "#854d0e", fontWeight: 700,
          marginBottom: 10,
        }}>
          {PAUSE_REASON_LABEL[strategy.pausedReason] ?? strategy.pausedReason}
        </div>
      )}

      {/* Budget bar */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 4 }}>
          <span style={{ fontWeight: 800, color: "#888", textTransform: "uppercase", letterSpacing: 0.5 }}>Budget</span>
          <span style={{ fontWeight: 800, color: "#111" }}>
            {strategy.budget.remaining.toLocaleString()} / {strategy.budget.allocated.toLocaleString()}
            <span style={{ color: "#888", fontWeight: 600 }}> CUTE$</span>
          </span>
        </div>
        <div style={{ height: 6, borderRadius: 100, background: "#f3f4f6", overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${budgetPct}%`,
            background: budgetPct < 20 ? "#dc2626" : meta.color,
            borderRadius: 100, transition: "width 0.4s",
          }} />
        </div>
        {strategy.budget.savedProfits > 0 && (
          <div style={{ fontSize: 11, color: "#16a34a", fontWeight: 700, marginTop: 4 }}>
            💰 +{strategy.budget.savedProfits.toLocaleString()} CUTE$ saved (withdrawable on retire)
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
        <StatTile label="Today" value={`${forecastsToday}/${strategy.maxPerDay}`} />
        <StatTile label="Win rate" value={winRate !== null ? `${winRate}%` : "—"} color={winRate !== null && winRate >= 55 ? "#16a34a" : winRate !== null && winRate <= 45 ? "#dc2626" : "#666"} />
        <StatTile label="Net P&L" value={netProfit >= 0 ? `+${netProfit.toLocaleString()}` : netProfit.toLocaleString()} color={profitColor} />
      </div>

      {/* Config strip */}
      <div style={{ fontSize: 11, color: "#666", lineHeight: 1.6, marginBottom: 12, fontWeight: 500 }}>
        <span style={{ color: "#888" }}>Capital </span><b style={{ color: "#854d0e" }}>{strategy.stake} CUTE$</b>
        <span style={{ color: "#aaa" }}> · </span>
        <span style={{ color: "#888" }}>{strategy.reinvest === "compound" ? "♻️ Compound" : "💰 Save profits"}</span>
        <span style={{ color: "#aaa" }}> · </span>
        <span style={{ color: "#888" }}>{moodMeta.icon} {moodMeta.label}</span>
        {strategy.params.assetFilter.length > 0 && <>
          <span style={{ color: "#aaa" }}> · </span>
          <span style={{ color: "#888" }}>{strategy.params.assetFilter.join("/")}</span>
        </>}
        {(strategy.stopConditions.stopAtNetGain != null || strategy.stopConditions.stopAtNetLoss != null) && <>
          <br />
          {strategy.stopConditions.stopAtNetGain != null && (
            <span style={{ color: "#16a34a" }}>🎯 Stop at +{strategy.stopConditions.stopAtNetGain.toLocaleString()} </span>
          )}
          {strategy.stopConditions.stopAtNetLoss != null && (
            <span style={{ color: "#dc2626" }}>🛑 Stop at -{strategy.stopConditions.stopAtNetLoss.toLocaleString()} </span>
          )}
        </>}
        <br />
        <span style={{ color: "#aaa", fontSize: 10 }}>{totalForecasts} total forecasts placed</span>
      </div>

      {/* Performance review — plain-English "did it work, and why" */}
      {settled >= 3 && (
        <div style={{
          background: netProfit > 0 ? "#f0fdf4" : netProfit < 0 ? "#fef2f2" : "#f8fafc",
          border: `1px solid ${netProfit > 0 ? "#bbf7d0" : netProfit < 0 ? "#fecaca" : "#e8edf2"}`,
          borderRadius: 10, padding: "10px 12px", marginBottom: 12,
          fontSize: 11, color: "#475569", fontWeight: 600, lineHeight: 1.5,
        }}>
          <span style={{ fontWeight: 800, color: "#334155" }}>
            {netProfit > 0 ? "📈 Working" : netProfit < 0 ? "📉 Underwater" : "➖ Break-even"}:
          </span>{" "}
          {strategyInsight(strategy, { wins, losses, voided, winRate, netProfit })}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={() => toggle(strategy.id)} style={{
          flex: 1, padding: "8px 0", borderRadius: 100,
          background: strategy.enabled ? "#f3f4f6" : meta.color,
          color: strategy.enabled ? "#666" : "#fff",
          border: "none", fontSize: 12, fontWeight: 800, cursor: "pointer",
        }}>{strategy.enabled ? "⏸ Pause" : "▶ Resume"}</button>
        <button onClick={() => setEditing(true)} title="Edit parameters" style={{
          padding: "8px 14px", borderRadius: 100,
          background: "transparent", color: "#666",
          border: "1.5px solid #e5e7eb",
          fontSize: 12, fontWeight: 700, cursor: "pointer",
        }}>✏️ Edit</button>
        <button onClick={() => { if (confirm(`Retire "${strategy.name}"? Remaining budget + saved profits (${(strategy.budget.remaining + strategy.budget.savedProfits).toLocaleString()} CUTE$) will be refunded to your wallet.`)) handleRetire(); }} title="Retire and refund" style={{
          padding: "8px 14px", borderRadius: 100,
          background: "transparent", color: "#888",
          border: "1.5px solid #e5e7eb",
          fontSize: 12, fontWeight: 700, cursor: "pointer",
        }}>🗑</button>
      </div>

      {editing && <EditStrategyModal strategy={strategy} onClose={() => setEditing(false)} />}
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
  const balance = useCoinStore(s => s.balance);
  const spend = useCoinStore(s => s.spend);
  const pushNotif = useNotifications(s => s.push);

  const [type, setType] = useState<StrategyType>("momentum");
  const [budgetAllocated, setBudgetAllocated] = useState(500);
  const [stake, setStake] = useState(50);
  const [maxPerDay, setMaxPerDay] = useState(20);
  const [reinvest, setReinvest] = useState<ReinvestMode>("compound");
  const [marketCondition, setMarketCondition] = useState<MarketCondition>("any");
  const [assetFilter, setAssetFilter] = useState<string[]>([]);
  const [sideFilter, setSideFilter] = useState<"A" | "B">("A");
  const [pctThreshold, setPctThreshold] = useState(40);
  const [velocityThresholdPct, setVelocityThresholdPct] = useState(0.5);  // % (0.5 = +/-0.5%)
  const [minEdgePp, setMinEdgePp] = useState(0);                          // pp (0 = no edge gate)
  const [stopAtNetGain, setStopAtNetGain] = useState<number | "">("");
  const [stopAtNetLoss, setStopAtNetLoss] = useState<number | "">("");

  const meta = STRATEGY_META[type];
  const needsSide = type === "loyalist" || type === "flat_bias";
  const needsThreshold = type === "contrarian";
  const needsVelocity = type === "momentum_underlying" || type === "mean_reversion";

  const canAfford = balance >= budgetAllocated;
  const validBudget = budgetAllocated >= stake;

  function deploy() {
    if (!canAfford) {
      alert(`Not enough CUTE$ in your wallet. You have ${balance.toLocaleString()}, need ${budgetAllocated.toLocaleString()}.`);
      return;
    }
    if (!validBudget) {
      alert(`Budget must be at least the per-forecast stake (${stake} CUTE$).`);
      return;
    }
    // Strategy name auto-derived from the template — no manual input needed
    const finalName = meta.name;
    const result = create({
      name: finalName,
      type,
      enabled: true,
      params: {
        assetFilter,
        ...(needsSide ? { sideFilter } : {}),
        ...(needsThreshold ? { pctThreshold } : {}),
        ...(needsVelocity ? { velocityThreshold: velocityThresholdPct / 100 } : {}),
        ...(minEdgePp > 0 ? { minEdgePp } : {}),
      },
      stake,
      maxPerDay,
      budgetAllocated,
      reinvest,
      marketCondition,
      stopConditions: {
        ...(stopAtNetGain !== "" && stopAtNetGain > 0 ? { stopAtNetGain: Number(stopAtNetGain) } : {}),
        ...(stopAtNetLoss !== "" && stopAtNetLoss > 0 ? { stopAtNetLoss: Number(stopAtNetLoss) } : {}),
      },
    });

    if ("error" in result) {
      alert(result.error);
      return;
    }
    // Debit the allocated budget from the wallet (it now lives inside the strategy)
    spend(result.deductFromWallet);
    pushNotif({
      tone: "info", icon: "🚀",
      title: `Attack deployed`,
      body: `${finalName} is now live with ${budgetAllocated.toLocaleString()} CUTE$ allocated.`,
      durationMs: 5000,
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
        maxWidth: 560, width: "100%",
        maxHeight: "calc(100vh - 40px)", overflowY: "auto",
        boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: "#111", margin: 0 }}>Deploy an Attack</h2>
          <button onClick={onClose} style={{ background: "transparent", border: "none", fontSize: 22, color: "#888", cursor: "pointer" }}>×</button>
        </div>

        {/* Template picker */}
        <Field label="Strategy template">
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
        </Field>

        {/* Budget allocation */}
        <Field label={`💰 Total budget to allocate (deducted from wallet · you have ${balance.toLocaleString()} CUTE$)`}>
          <input type="number" min={stake} value={budgetAllocated} onChange={e => setBudgetAllocated(Math.max(stake, Number(e.target.value)))} style={{ ...inputStyle, color: canAfford ? "#111" : "#dc2626" }} />
          {!canAfford && <div style={{ fontSize: 11, color: "#dc2626", fontWeight: 700, marginTop: 4 }}>⚠️ Not enough in wallet</div>}
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Capital per forecast">
            <input type="number" min={10} value={stake} onChange={e => setStake(Math.max(10, Number(e.target.value)))} style={inputStyle} />
          </Field>
          <Field label="Max forecasts/day">
            <input type="number" min={1} value={maxPerDay} onChange={e => setMaxPerDay(Math.max(1, Number(e.target.value)))} style={inputStyle} />
          </Field>
        </div>

        {/* Stop conditions */}
        <Field label="🛑 Stop conditions (optional — leave blank for no auto-stop)">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontSize: 10, color: "#16a34a", fontWeight: 700, marginBottom: 3 }}>🎯 Stop at gain of</div>
              <input type="number" min={0} placeholder="e.g. 500" value={stopAtNetGain} onChange={e => setStopAtNetGain(e.target.value === "" ? "" : Number(e.target.value))} style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: "#dc2626", fontWeight: 700, marginBottom: 3 }}>🛑 Stop at loss of</div>
              <input type="number" min={0} placeholder="e.g. 200" value={stopAtNetLoss} onChange={e => setStopAtNetLoss(e.target.value === "" ? "" : Number(e.target.value))} style={inputStyle} />
            </div>
          </div>
        </Field>

        {/* Reinvest mode */}
        <Field label="What happens to winnings?">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <button onClick={() => setReinvest("compound")} style={modeBtnStyle(reinvest === "compound", "#06b6d4")}>
              <div style={{ fontSize: 13, fontWeight: 800 }}>♻️ Compound</div>
              <div style={{ fontSize: 10, color: "#888", marginTop: 3 }}>Wins feed back into the budget so the strategy can grow. High-risk, high-reward.</div>
            </button>
            <button onClick={() => setReinvest("save")} style={modeBtnStyle(reinvest === "save", "#16a34a")}>
              <div style={{ fontSize: 13, fontWeight: 800 }}>💰 Save profits</div>
              <div style={{ fontSize: 10, color: "#888", marginTop: 3 }}>Stake recycles, profit goes to a separate pocket. Withdrawable on retire.</div>
            </button>
          </div>
        </Field>

        {/* Market condition */}
        <Field label="🌐 Market condition required">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {(Object.keys(MARKET_CONDITION_META) as MarketCondition[]).map(mc => {
              const m = MARKET_CONDITION_META[mc];
              const active = marketCondition === mc;
              return (
                <button key={mc} onClick={() => setMarketCondition(mc)}
                  title={m.description}
                  style={{
                    padding: "8px 12px", borderRadius: 100,
                    background: active ? "#111" : "#fff",
                    color: active ? "#fff" : "#666",
                    border: "1.5px solid #e5e7eb",
                    fontSize: 12, fontWeight: 700, cursor: "pointer",
                  }}>{m.icon} {m.label}</button>
              );
            })}
          </div>
          <div style={{ fontSize: 10, color: "#aaa", marginTop: 4, lineHeight: 1.5 }}>
            {MARKET_CONDITION_META[marketCondition].description}
          </div>
        </Field>

        {/* Strategy-specific */}
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
            <input type="range" min={20} max={49} value={pctThreshold} onChange={e => setPctThreshold(Number(e.target.value))} style={{ width: "100%" }} />
            <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>Trigger when one side falls below <b style={{ color: "#111" }}>{pctThreshold}%</b></div>
          </Field>
        )}

        {needsVelocity && (
          <Field label={type === "mean_reversion" ? "Overshoot threshold (act when |1m move| exceeds)" : "Velocity threshold (5m price change to trigger)"}>
            <input type="range" min={0.1} max={5} step={0.1} value={velocityThresholdPct} onChange={e => setVelocityThresholdPct(Number(e.target.value))} style={{ width: "100%" }} />
            <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
              {type === "mean_reversion"
                ? <>Fire when 1-minute price move exceeds <b style={{ color: "#111" }}>±{velocityThresholdPct}%</b> — then bet against it</>
                : <>Fire when 5-minute velocity is above <b style={{ color: "#111" }}>+{velocityThresholdPct}%</b> (predict Up) or below <b style={{ color: "#111" }}>-{velocityThresholdPct}%</b> (predict Down)</>}
            </div>
          </Field>
        )}

        <Field label="🎯 Edge gate (optional — only fire when our model beats the market by this many pp)">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="range" min={0} max={25} step={1} value={minEdgePp} onChange={e => setMinEdgePp(Number(e.target.value))} style={{ flex: 1 }} />
            <span style={{ fontSize: 13, fontWeight: 800, color: "#111", minWidth: 60, textAlign: "right" }}>
              {minEdgePp === 0 ? "OFF" : `${minEdgePp}pp`}
            </span>
          </div>
          <div style={{ fontSize: 11, color: "#888", marginTop: 4, lineHeight: 1.5 }}>
            With the gate ON, the strategy only fires when the live price feed
            implies a fair value that beats the market price by ≥{minEdgePp || "?"}pp.
            Lower trade volume, much higher win rate when it does trade.
            {minEdgePp === 0 ? <> <b style={{color: "#dc2626"}}>OFF</b> — strategy fires on its pattern alone.</> : null}
          </div>
        </Field>

        <Field label="Assets to watch (leave empty = all 10)">
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

        <button onClick={deploy} disabled={!canAfford || !validBudget} style={{
          marginTop: 12, width: "100%",
          background: canAfford && validBudget ? "linear-gradient(135deg, #f472b6, #ec4899)" : "#e5e7eb",
          color: canAfford && validBudget ? "#fff" : "#aaa",
          border: "none", borderRadius: 100, padding: "12px 0",
          fontSize: 14, fontWeight: 900, cursor: canAfford && validBudget ? "pointer" : "not-allowed",
          boxShadow: canAfford && validBudget ? "0 4px 14px rgba(244,114,182,0.30)" : "none",
        }}>🚀 Deploy with {budgetAllocated.toLocaleString()} CUTE$</button>
        <div style={{ fontSize: 11, color: "#aaa", textAlign: "center", marginTop: 10, lineHeight: 1.5 }}>
          Budget is held by the strategy. Retire at any time to refund remaining budget + saved profits to your wallet.
        </div>
      </div>
    </div>
  );
}

/**
 * Edit modal — change a deployed strategy's runtime parameters in-place.
 * Type and allocated budget are NOT editable (changing the type would break
 * the strategy's identity; changing the budget needs a separate top-up/withdraw
 * flow). Everything else is fair game: stake, daily cap, reinvest mode,
 * stop conditions, market condition, asset filter, edge gate, type-specific params.
 */
function EditStrategyModal({ strategy, onClose }: { strategy: Strategy; onClose: () => void }) {
  const update = useStrategies(s => s.update);
  const meta = STRATEGY_META[strategy.type];
  const moodMeta = MARKET_CONDITION_META[strategy.marketCondition];

  const [stake, setStake] = useState(strategy.stake);
  const [maxPerDay, setMaxPerDay] = useState(strategy.maxPerDay);
  const [reinvest, setReinvest] = useState<ReinvestMode>(strategy.reinvest);
  const [marketCondition, setMarketCondition] = useState<MarketCondition>(strategy.marketCondition);
  const [assetFilter, setAssetFilter] = useState<string[]>(strategy.params.assetFilter);
  const [sideFilter, setSideFilter] = useState<"A" | "B">(strategy.params.sideFilter ?? "A");
  const [pctThreshold, setPctThreshold] = useState(strategy.params.pctThreshold ?? 40);
  const [velocityThresholdPct, setVelocityThresholdPct] = useState(
    strategy.params.velocityThreshold ? strategy.params.velocityThreshold * 100 : 0.5
  );
  const [minEdgePp, setMinEdgePp] = useState(strategy.params.minEdgePp ?? 0);
  const [stopAtNetGain, setStopAtNetGain] = useState<number | "">(strategy.stopConditions.stopAtNetGain ?? "");
  const [stopAtNetLoss, setStopAtNetLoss] = useState<number | "">(strategy.stopConditions.stopAtNetLoss ?? "");

  const needsSide = strategy.type === "loyalist" || strategy.type === "flat_bias";
  const needsThreshold = strategy.type === "contrarian";
  const needsVelocity = strategy.type === "momentum_underlying" || strategy.type === "mean_reversion";

  function save() {
    update(strategy.id, {
      stake,
      maxPerDay,
      reinvest,
      marketCondition,
      params: {
        assetFilter,
        ...(needsSide ? { sideFilter } : {}),
        ...(needsThreshold ? { pctThreshold } : {}),
        ...(needsVelocity ? { velocityThreshold: velocityThresholdPct / 100 } : {}),
        ...(minEdgePp > 0 ? { minEdgePp } : {}),
      },
      stopConditions: {
        ...(stopAtNetGain !== "" && stopAtNetGain > 0 ? { stopAtNetGain: Number(stopAtNetGain) } : {}),
        ...(stopAtNetLoss !== "" && stopAtNetLoss > 0 ? { stopAtNetLoss: Number(stopAtNetLoss) } : {}),
      },
    });
    onClose();
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9100,
      background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      fontFamily: "'Nunito', system-ui, sans-serif",
    }}>
      <div style={{
        background: "#fff", borderRadius: 20, padding: 28,
        maxWidth: 560, width: "100%",
        maxHeight: "calc(100vh - 40px)", overflowY: "auto",
        boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 900, color: "#111", margin: 0 }}>Edit {meta.icon} {strategy.name}</h2>
            <div style={{ fontSize: 12, color: "#888", marginTop: 4, fontWeight: 500 }}>
              Adjust runtime parameters. Changes apply on the next tick.
            </div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", fontSize: 22, color: "#888", cursor: "pointer" }}>×</button>
        </div>

        {/* Read-only summary (these can't be edited) */}
        <div style={{ background: "#fafafa", borderRadius: 10, padding: "12px 14px", marginBottom: 14, border: "1px solid #f0f0f0" }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Locked</div>
          <div style={{ fontSize: 11, color: "#666", lineHeight: 1.6 }}>
            Strategy: <b style={{ color: "#111" }}>{meta.name}</b> · Budget: <b style={{ color: "#854d0e" }}>{strategy.budget.allocated.toLocaleString()} CUTE$</b>{" "}
            <span style={{ color: "#aaa" }}>({strategy.budget.remaining.toLocaleString()} remaining)</span>
            <br />
            <span style={{ fontSize: 10, color: "#aaa" }}>To change these, retire the strategy and deploy a new one.</span>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Capital per forecast">
            <input type="number" min={10} value={stake} onChange={e => setStake(Math.max(10, Number(e.target.value)))} style={inputStyle} />
          </Field>
          <Field label="Max forecasts/day">
            <input type="number" min={1} value={maxPerDay} onChange={e => setMaxPerDay(Math.max(1, Number(e.target.value)))} style={inputStyle} />
          </Field>
        </div>

        <Field label="🛑 Stop conditions (leave blank for no auto-stop)">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontSize: 10, color: "#16a34a", fontWeight: 700, marginBottom: 3 }}>🎯 Stop at gain of</div>
              <input type="number" min={0} placeholder="e.g. 500" value={stopAtNetGain} onChange={e => setStopAtNetGain(e.target.value === "" ? "" : Number(e.target.value))} style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: "#dc2626", fontWeight: 700, marginBottom: 3 }}>🛑 Stop at loss of</div>
              <input type="number" min={0} placeholder="e.g. 200" value={stopAtNetLoss} onChange={e => setStopAtNetLoss(e.target.value === "" ? "" : Number(e.target.value))} style={inputStyle} />
            </div>
          </div>
        </Field>

        <Field label="What happens to winnings?">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <button onClick={() => setReinvest("compound")} style={modeBtnStyle(reinvest === "compound", "#06b6d4")}>
              <div style={{ fontSize: 13, fontWeight: 800 }}>♻️ Compound</div>
              <div style={{ fontSize: 10, color: "#888", marginTop: 3 }}>Wins feed back into the budget. High-risk, high-reward.</div>
            </button>
            <button onClick={() => setReinvest("save")} style={modeBtnStyle(reinvest === "save", "#16a34a")}>
              <div style={{ fontSize: 13, fontWeight: 800 }}>💰 Save profits</div>
              <div style={{ fontSize: 10, color: "#888", marginTop: 3 }}>Stake recycles, profit goes to savings pocket.</div>
            </button>
          </div>
        </Field>

        <Field label="🌐 Market condition required">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {(Object.keys(MARKET_CONDITION_META) as MarketCondition[]).map(mc => {
              const m = MARKET_CONDITION_META[mc];
              const active = marketCondition === mc;
              return (
                <button key={mc} onClick={() => setMarketCondition(mc)} title={m.description}
                  style={{
                    padding: "8px 12px", borderRadius: 100,
                    background: active ? "#111" : "#fff",
                    color: active ? "#fff" : "#666",
                    border: "1.5px solid #e5e7eb",
                    fontSize: 12, fontWeight: 700, cursor: "pointer",
                  }}>{m.icon} {m.label}</button>
              );
            })}
          </div>
          <div style={{ fontSize: 10, color: "#aaa", marginTop: 4, lineHeight: 1.5 }}>
            {moodMeta.description}
          </div>
        </Field>

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
          <Field label="Underdog threshold">
            <input type="range" min={20} max={49} value={pctThreshold} onChange={e => setPctThreshold(Number(e.target.value))} style={{ width: "100%" }} />
            <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>Trigger when one side falls below <b style={{ color: "#111" }}>{pctThreshold}%</b></div>
          </Field>
        )}
        {needsVelocity && (
          <Field label={strategy.type === "mean_reversion" ? "Overshoot threshold" : "Velocity threshold"}>
            <input type="range" min={0.1} max={5} step={0.1} value={velocityThresholdPct} onChange={e => setVelocityThresholdPct(Number(e.target.value))} style={{ width: "100%" }} />
            <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
              {strategy.type === "mean_reversion"
                ? <>Fire when 1m move exceeds <b style={{ color: "#111" }}>±{velocityThresholdPct}%</b></>
                : <>Fire when 5m velocity is above <b style={{ color: "#111" }}>+{velocityThresholdPct}%</b> (Up) or below <b style={{ color: "#111" }}>-{velocityThresholdPct}%</b> (Down)</>}
            </div>
          </Field>
        )}

        <Field label="🎯 Edge gate (only fire when our model beats market by this many pp)">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="range" min={0} max={25} step={1} value={minEdgePp} onChange={e => setMinEdgePp(Number(e.target.value))} style={{ flex: 1 }} />
            <span style={{ fontSize: 13, fontWeight: 800, color: "#111", minWidth: 60, textAlign: "right" }}>
              {minEdgePp === 0 ? "OFF" : `${minEdgePp}pp`}
            </span>
          </div>
        </Field>

        <Field label="Assets to watch (empty = all)">
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

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={onClose} style={{
            flex: 1,
            background: "#fff", color: "#666",
            border: "1.5px solid #e5e7eb", borderRadius: 100,
            padding: "12px 0", fontSize: 13, fontWeight: 700, cursor: "pointer",
          }}>Cancel</button>
          <button onClick={save} style={{
            flex: 2,
            background: "linear-gradient(135deg, #f472b6, #ec4899)", color: "#fff",
            border: "none", borderRadius: 100, padding: "12px 0",
            fontSize: 14, fontWeight: 900, cursor: "pointer",
            boxShadow: "0 4px 14px rgba(244,114,182,0.30)",
          }}>💾 Save changes</button>
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
function modeBtnStyle(active: boolean, accentColor: string): React.CSSProperties {
  return {
    background: active ? accentColor + "12" : "#fff",
    border: `1.5px solid ${active ? accentColor : "#e5e7eb"}`,
    borderRadius: 12, padding: "12px",
    textAlign: "left", cursor: "pointer",
  };
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", borderRadius: 8,
  border: "1.5px solid #e5e7eb", fontSize: 13, fontWeight: 600, color: "#111",
  fontFamily: "'Nunito', system-ui, sans-serif", boxSizing: "border-box",
};

/**
 * Plain-English performance review for a strategy: why it's working or not,
 * grounded in its actual win rate + the nature of the strategy type.
 */
function strategyInsight(
  strategy: Strategy,
  s: { wins: number; losses: number; voided: number; winRate: number | null; netProfit: number },
): string {
  const wr = s.winRate ?? 50;
  const edge = strategy.params.minEdgePp;
  const type = strategy.type;
  const bits: string[] = [];

  // Win-rate read
  if (wr >= 58) bits.push(`a strong ${wr}% hit rate is carrying it`);
  else if (wr >= 52) bits.push(`a slight ${wr}% edge is enough to stay green`);
  else if (wr >= 48) bits.push(`a near-coin-flip ${wr}% hit rate`);
  else bits.push(`only ${wr}% of calls are landing`);

  // Strategy-type colour
  const typeNote: Record<string, string> = {
    momentum: "chasing the leading side works best in trending markets and bleeds in chop",
    contrarian: "fading the crowd pays when favourites are overpriced, but a strong trend punishes it",
    loyalist: "a fixed-side bet lives or dies on whether that side is genuinely favoured",
    flat_bias: "a pure one-side bias is a benchmark — beating 50% means the side had a real edge",
    late_joiner: "joining late backs near-certain winners for small, steady gains",
    momentum_underlying: "reading real 5-minute velocity catches genuine moves the crowd hasn't priced",
    mean_reversion: "betting against spikes wins when moves overshoot and snaps back, loses in breakouts",
    late_sniper: "acting in the final seconds on the real price is close to riskless when the feed is clean",
  };
  if (typeNote[type]) bits.push(typeNote[type]);

  // Edge-gate note
  if (edge && edge > 0) bits.push(`the ${edge}pp edge gate keeps it selective — fewer trades, higher quality`);
  else bits.push("consider adding an edge gate to skip low-conviction trades");

  return bits.join("; ") + ".";
}
