import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { BattleCard } from "../components/BattleCard";
import { getBattlesByAsset, ASSET_META } from "../data/mockBattles";
import type { BattleType } from "../data/mockBattles";
import { useLivePrices, fmtPrice, fmtChange } from "../hooks/useLivePrices";

const S: React.CSSProperties = { fontFamily: "'Nunito', system-ui, sans-serif" };

const TYPE_FILTERS: { label: string; value: BattleType | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Above / Below", value: "abovebelow" },
  { label: "Up / Down", value: "updown" },
  { label: "Outperform", value: "outperform" },
  { label: "Volatility", value: "volatility" },
  { label: "Clan War", value: "clanwar" },
];

const TIME_FILTERS = ["All", "5 Min", "15 Min", "1 Hour", "4 Hours", "Daily", "Weekly"];

export function AssetPage() {
  const { asset = "btc" } = useParams<{ asset: string }>();
  const sym = asset.toUpperCase();
  const meta = ASSET_META[sym];
  const [type, setType] = useState<BattleType | "all">("all");
  const [time, setTime] = useState("All");
  const { prices, loading, error, lastUpdated } = useLivePrices();

  if (!meta) {
    return (
      <div style={{ ...S, padding: "80px 48px", textAlign: "center" }}>
        <h2>Unknown asset: {sym}</h2>
        <Link to="/crypto">← Back to arena</Link>
      </div>
    );
  }

  const price = prices[sym];
  const battles = getBattlesByAsset(sym).filter(b => type === "all" || b.type === type);
  const liveBattles = battles.filter(b => b.status === "live");
  const totalVol = battles.reduce((sum, b) => sum + b.volumeK, 0);

  return (
    <div style={{ ...S, background: "#f8f9fa", minHeight: "100vh" }}>
      {/* Asset header */}
      <div style={{
        background: `linear-gradient(135deg, ${meta.color}18 0%, ${meta.color}06 100%)`,
        borderBottom: "1px solid #f0f0f0", padding: "32px 48px 0",
      }}>
        <div style={{ maxWidth: 1300, margin: "0 auto" }}>
          <Link to="/crypto" style={{ fontSize: 13, color: "#888", textDecoration: "none", fontWeight: 600, display: "inline-block", marginBottom: 16 }}>
            ← Crypto Arena
          </Link>

          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: meta.color + "25", border: `3px solid ${meta.color}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>
                {meta.emoji}
              </div>
              <div>
                <h1 style={{ fontSize: 30, fontWeight: 900, color: "#111", margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
                  {meta.name}
                  <span style={{ fontSize: 15, fontWeight: 700, padding: "3px 10px", borderRadius: 100, background: meta.color + "20", color: meta.color }}>{meta.symbol}</span>
                </h1>
                <div style={{ fontSize: 14, color: "#666", marginTop: 4, fontWeight: 600 }}>{meta.family} · {meta.tagline}</div>
              </div>
            </div>

            {/* Live stats */}
            <div style={{ display: "flex", gap: 28, alignItems: "flex-start" }}>
              {loading && <div style={{ fontSize: 13, color: "#aaa" }}>Fetching live price…</div>}
              {error && <div style={{ fontSize: 12, color: "#ef4444", fontWeight: 600 }}>Price feed error — retrying</div>}
              {price && (
                <StatBox label="Live Price" value={fmtPrice(price.usd)} sub={
                  <span style={{ color: price.usd_24h_change >= 0 ? "#16a34a" : "#dc2626", fontWeight: 700 }}>
                    {fmtChange(price.usd_24h_change)} 24h
                  </span>
                } />
              )}
              <StatBox label="24hr Vol" value={`${totalVol}K`} sub="Fini Coin" />
              <StatBox label="Live Battles" value={String(liveBattles.length)} sub={`of ${battles.length} total`} />
            </div>
          </div>

          {/* Type tabs */}
          <div style={{ display: "flex", gap: 0 }}>
            {TYPE_FILTERS.map(f => (
              <button key={f.label} onClick={() => setType(f.value)} style={{
                padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer",
                background: "none", border: "none",
                color: type === f.value ? "#111" : "#888",
                borderBottom: type === f.value ? `2.5px solid ${meta.color}` : "2.5px solid transparent",
                transition: "all 0.12s",
              }}>{f.label}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1300, margin: "0 auto", padding: "24px 48px" }}>
        {/* Time chips */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 24 }}>
          {TIME_FILTERS.map(t => (
            <button key={t} onClick={() => setTime(t)} style={{
              padding: "6px 14px", borderRadius: 100, border: "none", cursor: "pointer",
              fontSize: 12, fontWeight: 700,
              background: time === t ? meta.color : "#fff",
              color: time === t ? "#fff" : "#666",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)", transition: "all 0.12s",
            }}>{t}</button>
          ))}
          {lastUpdated && (
            <span style={{ marginLeft: "auto", fontSize: 11, color: "#bbb", alignSelf: "center" }}>
              Prices updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>

        {/* Battle grid */}
        {battles.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#aaa" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚔️</div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>No battles match this filter</div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
            {battles.map(b => <BattleCard key={b.id} battle={b} />)}
          </div>
        )}

        {/* Other assets */}
        <div style={{ marginTop: 48 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#999", marginBottom: 12 }}>Other arenas</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {Object.entries(ASSET_META).filter(([s]) => s !== sym).map(([s, m]) => (
              <Link key={s} to={`/crypto/${s.toLowerCase()}`} style={{
                display: "flex", alignItems: "center", gap: 6, padding: "7px 14px",
                borderRadius: 100, background: m.color + "15", color: m.color,
                textDecoration: "none", fontSize: 13, fontWeight: 700,
                border: `1.5px solid ${m.color}30`,
              }}>
                {m.emoji} {m.symbol}
                {prices[s] && (
                  <span style={{ fontSize: 11, opacity: 0.8 }}>{fmtPrice(prices[s].usd)}</span>
                )}
              </Link>
            ))}
          </div>
        </div>

        <Disclaimer />
      </div>
    </div>
  );
}

function StatBox({ label, value, sub }: { label: string; value: string; sub: React.ReactNode }) {
  return (
    <div style={{ textAlign: "right" }}>
      <div style={{ fontSize: 10, color: "#aaa", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: "#111", lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 12, color: "#666", fontWeight: 600 }}>{sub}</div>
    </div>
  );
}

function Disclaimer() {
  return (
    <div style={{ marginTop: 40, padding: "16px 20px", borderRadius: 12, background: "#f3f4f6", fontSize: 11, color: "#9ca3af", lineHeight: 1.6 }}>
      🪙 Fini Coin is a non-transferable game currency with no real-world value. This is a game, not financial advice. Live crypto prices are fetched from CoinGecko and may be delayed. Do not use this site as a trading tool.
    </div>
  );
}
