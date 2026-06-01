import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { BattleCard } from "../components/BattleCard";
import { ASSET_META } from "../data/mockBattles";
import type { BattleType } from "../data/mockBattles";
import { useCryptoSim, useSimBattles, useSimFeed } from "../data/cryptoSim";
import { useLivePrices, fmtPrice, fmtChange } from "../hooks/useLivePrices";
import { useMyEntries } from "../state/myEntriesStore";

const TOPIC_TABS = ["Trending", "Live", "Ending Soon", "High Volume"];
const ASSET_FILTERS = ["All", "BTC", "ETH", "SOL", "DOGE", "BNB", "LINK", "AVAX"];
const TYPE_FILTERS: { label: string; value: BattleType | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Up / Down", value: "updown" },
  { label: "Outperform", value: "outperform" },
  { label: "Clan War", value: "clanwar" },
];

export function CryptoArenaPage() {
  const [topic, setTopic] = useState("Trending");
  const [asset, setAsset] = useState("All");
  const [type, setType] = useState<BattleType | "all">("all");
  const { prices } = useLivePrices();
  const battles = useSimBattles();
  const feed = useSimFeed();
  const start = useCryptoSim(s => s.start);
  const myEntries = useMyEntries(s => s.entries);
  // Re-render every second so the My Active Battles progress bars tick smoothly
  const [, setNowTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setNowTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Boot the simulator once when the page mounts (idempotent).
  useEffect(() => { start(); }, [start]);

  const filtered = battles.filter(b => {
    if (asset !== "All" && !b.assets.includes(asset)) return false;
    if (type !== "all" && b.type !== type) return false;
    if (topic === "Live" && b.status !== "live") return false;
    if (topic === "Ending Soon" && b.endsInMs > 20 * 60 * 1000) return false;
    if (topic === "High Volume" && b.volumeK < 80) return false;
    return true;
  });

  const liveCount = battles.filter(b => b.status === "live").length;

  return (
    <div style={{ fontFamily: "'Nunito', system-ui, sans-serif", background: "#f8f9fa", minHeight: "100vh" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #f0f0f0", padding: "28px 48px 0" }}>
        <div style={{ maxWidth: 1300, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
            <h1 style={{ fontSize: 26, fontWeight: 900, color: "#111", margin: 0 }}>Crypto Arena</h1>
            <span style={{ fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 100, background: "#dcfce7", color: "#15803d" }}>
              {liveCount} Live
            </span>
            <Link to="/strategies" style={{
              marginLeft: "auto",
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "8px 16px", borderRadius: 100,
              background: "linear-gradient(135deg, #06b6d4, #0891b2)",
              color: "#fff", fontSize: 13, fontWeight: 800,
              textDecoration: "none",
              boxShadow: "0 4px 14px rgba(6,182,212,0.25)",
            }}
              title="Deploy autonomous Forecasters that act on your behalf"
            >
              ⚙️ Automated Attack →
            </Link>
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            {Object.entries(ASSET_META).map(([sym, meta]) => (
              <Link key={sym} to={"/crypto/" + sym.toLowerCase()} style={{
                display: "flex", alignItems: "center", gap: 6, padding: "6px 14px",
                borderRadius: 100, background: meta.color + "12", color: meta.color,
                textDecoration: "none", fontSize: 13, fontWeight: 700,
                border: "1.5px solid " + meta.color + "28",
              }}>
                <span>{meta.emoji}</span>
                <span>{meta.symbol}</span>
                {prices[sym] && <>
                  <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.85 }}>{fmtPrice(prices[sym].usd)}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: prices[sym].usd_24h_change >= 0 ? "#16a34a" : "#dc2626" }}>{fmtChange(prices[sym].usd_24h_change)}</span>
                </>}
              </Link>
            ))}
          </div>

          <div style={{ display: "flex", gap: 0 }}>
            {TOPIC_TABS.map(t => (
              <button key={t} onClick={() => setTopic(t)} style={{
                padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer",
                background: "none", border: "none", color: topic === t ? "#111" : "#888",
                borderBottom: topic === t ? "2.5px solid #f472b6" : "2.5px solid transparent",
              }}>{t}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1300, margin: "0 auto", padding: "24px 48px" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
          {ASSET_FILTERS.map(a => (
            <button key={a} onClick={() => setAsset(a)} style={{
              padding: "6px 12px", borderRadius: 100, border: "none", cursor: "pointer",
              fontSize: 12, fontWeight: 700,
              background: asset === a ? "#111" : "#fff", color: asset === a ? "#fff" : "#666",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            }}>{a}</button>
          ))}
          <div style={{ width: 1, height: 24, background: "#e5e7eb" }} />
          {TYPE_FILTERS.map(f => (
            <button key={f.label} onClick={() => setType(f.value)} style={{
              padding: "6px 12px", borderRadius: 100, border: "none", cursor: "pointer",
              fontSize: 12, fontWeight: 700,
              background: type === f.value ? "#111" : "#fff", color: type === f.value ? "#fff" : "#666",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            }}>{f.label}</button>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 24, alignItems: "start" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
            {filtered.map(b => <BattleCard key={b.id} battle={b} />)}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14, position: "sticky", top: 20 }}>

          {/* My Active Battles — entries the user has placed, with progress to resolution */}
          {myEntries.length > 0 && (
            <aside style={{
              background: "#fff", borderRadius: 16,
              border: "1.5px solid #f0f0f0",
              padding: "16px 16px 12px",
              maxHeight: "40vh", overflow: "hidden",
              display: "flex", flexDirection: "column",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#111" }}>My Active Battles</span>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 100, background: "#fce8f3", color: "#be185d" }}>
                  {myEntries.length}
                </span>
              </div>
              <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
                {myEntries.map(entry => {
                  const remaining = Math.max(0, entry.endsAt - Date.now());
                  const elapsedPct = entry.durationMs > 0
                    ? Math.min(100, ((entry.durationMs - remaining) / entry.durationMs) * 100)
                    : 100;
                  const settled = remaining <= 0;
                  const fmtTime = (ms: number) => {
                    if (ms <= 0) return "Resolving…";
                    const s = Math.floor(ms / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60);
                    if (h > 0) return `${h}h ${m % 60}m`;
                    if (m > 0) return `${m}m ${s % 60}s`;
                    return `${s}s`;
                  };
                  const sideColor = entry.side === "A" ? "#16a34a" : "#dc2626";
                  // Champion-Fini HP: the current market % for the side the user backed.
                  // As predictions flow in and odds shift, this bar visibly drops/rises —
                  // so users instantly see whether their pick is winning or losing.
                  const liveBattle = battles.find(b => b.id === entry.battleId);
                  const yourHpPct = liveBattle
                    ? (entry.side === "A" ? liveBattle.sideA.pct : liveBattle.sideB.pct)
                    : 50;
                  // Colour the HP bar by health tier: green winning, yellow tied, red losing
                  const hpColor = yourHpPct >= 60 ? "#16a34a"
                                 : yourHpPct >= 40 ? "#f59e0b"
                                 : "#dc2626";
                  return (
                    <Link
                      key={entry.battleId}
                      to={`/battle/${entry.battleId}`}
                      style={{
                        textDecoration: "none", color: "inherit",
                        background: "#fafafa", borderRadius: 10,
                        padding: "10px 12px", borderLeft: `3px solid ${sideColor}`,
                        display: "block",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: "#111", lineHeight: 1.3, flex: 1 }}>
                          {entry.battleTitle}
                        </div>
                        {/* Status chip: WON / LOST / VOIDED / SETTLING / LIVE */}
                        {entry.status === "won" ? (
                          <span style={{ fontSize: 9, fontWeight: 800, color: "#15803d", padding: "1px 6px", borderRadius: 100, background: "#dcfce7", whiteSpace: "nowrap" }}>🎉 WON +{entry.result?.netProfit ?? 0}</span>
                        ) : entry.status === "lost" ? (
                          <span style={{ fontSize: 9, fontWeight: 800, color: "#b91c1c", padding: "1px 6px", borderRadius: 100, background: "#fee2e2", whiteSpace: "nowrap" }}>💀 LOST {entry.result?.netProfit ?? -entry.stake}</span>
                        ) : entry.status === "voided" ? (
                          <span style={{ fontSize: 9, fontWeight: 800, color: "#6d28d9", padding: "1px 6px", borderRadius: 100, background: "#f3e8ff", whiteSpace: "nowrap" }}>↩️ VOID · refunded</span>
                        ) : settled ? (
                          <span style={{ fontSize: 9, fontWeight: 800, color: "#a855f7", padding: "1px 6px", borderRadius: 100, background: "#faf5ff", whiteSpace: "nowrap" }}>SETTLING</span>
                        ) : (
                          <span style={{ fontSize: 9, fontWeight: 800, color: "#16a34a", padding: "1px 6px", borderRadius: 100, background: "#dcfce7", whiteSpace: "nowrap" }}>● LIVE</span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: "#666", fontWeight: 600, marginBottom: 6 }}>
                        <span style={{ color: sideColor, fontWeight: 800 }}>{entry.sideLabel}</span>
                        <span style={{ color: "#aaa" }}> · </span>
                        <span style={{ color: "#854d0e", fontWeight: 800 }}>{entry.stake} FINI$</span>
                      </div>

                      {/* Champion Fini HP bar — live market % of the backed side */}
                      {!settled && (
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, fontWeight: 800, color: "#666", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>
                            <span>💚 Champion HP</span>
                            <span style={{ color: hpColor, fontFamily: "monospace" }}>{Math.round(yourHpPct)}/100</span>
                          </div>
                          <div style={{ height: 7, borderRadius: 100, background: "#fee2e2", overflow: "hidden", position: "relative" }}>
                            <div style={{
                              height: "100%", width: `${yourHpPct}%`,
                              background: `linear-gradient(90deg, ${hpColor}, ${hpColor}cc)`,
                              borderRadius: 100, transition: "width 0.6s ease",
                            }} />
                          </div>
                        </div>
                      )}

                      {/* Time-to-resolution bar */}
                      <div style={{ height: 5, borderRadius: 100, background: "#f3f4f6", overflow: "hidden", marginBottom: 4 }}>
                        <div style={{
                          height: "100%", width: `${elapsedPct}%`,
                          background: settled
                            ? "linear-gradient(90deg, #a855f7, #7c3aed)"
                            : `linear-gradient(90deg, ${sideColor}, ${sideColor}aa)`,
                          borderRadius: 100, transition: "width 0.5s ease",
                        }} />
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontWeight: 700, color: "#888" }}>
                        <span>{Math.round(elapsedPct)}% elapsed</span>
                        <span style={{ fontFamily: "monospace", fontVariantNumeric: "tabular-nums" }}>{fmtTime(remaining)}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </aside>
          )}

          {/* Live activity feed — real Fini holder wallets simulating bets */}
          <aside style={{
            background: "#fff", borderRadius: 16,
            border: "1.5px solid #f0f0f0",
            padding: "16px 16px 8px", maxHeight: myEntries.length > 0 ? "calc(60vh - 40px)" : "calc(100vh - 40px)",
            overflow: "hidden", display: "flex", flexDirection: "column",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#111" }}>Live Predictions</span>
              <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 100, background: "#dcfce7", color: "#15803d", textTransform: "uppercase", letterSpacing: 0.5 }}>● Live</span>
            </div>
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
              {feed.length === 0 && (
                <div style={{ fontSize: 11, color: "#aaa", fontStyle: "italic", padding: "20px 0", textAlign: "center" }}>Waiting for activity…</div>
              )}
              {feed.slice(0, 30).map(entry => {
                const sideColor = entry.side === "A" ? "#22c55e" : "#ef4444";
                return (
                  <Link
                    key={entry.id}
                    to={`/battle/${entry.battleId}`}
                    style={{
                      textDecoration: "none", display: "block",
                      background: "#fafafa", borderRadius: 8, padding: "8px 10px",
                      borderLeft: `2.5px solid ${sideColor}`,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, color: "#666" }}>{entry.shortWallet}</span>
                      <span style={{ fontSize: 10, color: sideColor, fontWeight: 800 }}>{entry.sideLabel}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#111", fontWeight: 700, marginTop: 2 }}>
                      {entry.amount} FINI$ on <span style={{ color: "#666", fontWeight: 600 }}>{entry.asset}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </aside>
          </div>
        </div>

        <div style={{ marginTop: 40, padding: "16px 20px", borderRadius: 12, background: "#f3f4f6", fontSize: 11, color: "#9ca3af", lineHeight: 1.6 }}>
          Fini Coin is a non-transferable in-game currency with no real-world value. This is a game.
        </div>
      </div>
    </div>
  );
}
