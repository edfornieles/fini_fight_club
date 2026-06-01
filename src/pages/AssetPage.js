import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { BattleCard } from "../components/BattleCard";
import { getBattlesByAsset, ASSET_META } from "../data/mockBattles";
import { useLivePrices, fmtPrice, fmtChange } from "../hooks/useLivePrices";
const S = { fontFamily: "'Nunito', system-ui, sans-serif" };
const TYPE_FILTERS = [
    { label: "All", value: "all" },
    { label: "Above / Below", value: "abovebelow" },
    { label: "Up / Down", value: "updown" },
    { label: "Outperform", value: "outperform" },
    { label: "Volatility", value: "volatility" },
    { label: "Clan War", value: "clanwar" },
];
const TIME_FILTERS = ["All", "5 Min", "15 Min", "1 Hour", "4 Hours", "Daily", "Weekly"];
export function AssetPage() {
    const { asset = "btc" } = useParams();
    const sym = asset.toUpperCase();
    const meta = ASSET_META[sym];
    const [type, setType] = useState("all");
    const [time, setTime] = useState("All");
    const { prices, loading, error, lastUpdated } = useLivePrices();
    if (!meta) {
        return (_jsxs("div", { style: { ...S, padding: "80px 48px", textAlign: "center" }, children: [_jsxs("h2", { children: ["Unknown asset: ", sym] }), _jsx(Link, { to: "/crypto", children: "\u2190 Back to arena" })] }));
    }
    const price = prices[sym];
    const battles = getBattlesByAsset(sym).filter(b => type === "all" || b.type === type);
    const liveBattles = battles.filter(b => b.status === "live");
    const totalVol = battles.reduce((sum, b) => sum + b.volumeK, 0);
    return (_jsxs("div", { style: { ...S, background: "#f8f9fa", minHeight: "100vh" }, children: [_jsx("div", { style: {
                    background: `linear-gradient(135deg, ${meta.color}18 0%, ${meta.color}06 100%)`,
                    borderBottom: "1px solid #f0f0f0", padding: "32px 48px 0",
                }, children: _jsxs("div", { style: { maxWidth: 1300, margin: "0 auto" }, children: [_jsx(Link, { to: "/crypto", style: { fontSize: 13, color: "#888", textDecoration: "none", fontWeight: 600, display: "inline-block", marginBottom: 16 }, children: "\u2190 Crypto Arena" }), _jsxs("div", { style: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }, children: [_jsxs("div", { style: { display: "flex", alignItems: "center", gap: 20 }, children: [_jsx("div", { style: { width: 64, height: 64, borderRadius: "50%", background: meta.color + "25", border: `3px solid ${meta.color}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }, children: meta.emoji }), _jsxs("div", { children: [_jsxs("h1", { style: { fontSize: 30, fontWeight: 900, color: "#111", margin: 0, display: "flex", alignItems: "center", gap: 10 }, children: [meta.name, _jsx("span", { style: { fontSize: 15, fontWeight: 700, padding: "3px 10px", borderRadius: 100, background: meta.color + "20", color: meta.color }, children: meta.symbol })] }), _jsxs("div", { style: { fontSize: 14, color: "#666", marginTop: 4, fontWeight: 600 }, children: [meta.family, " \u00B7 ", meta.tagline] })] })] }), _jsxs("div", { style: { display: "flex", gap: 28, alignItems: "flex-start" }, children: [loading && _jsx("div", { style: { fontSize: 13, color: "#aaa" }, children: "Fetching live price\u2026" }), error && _jsx("div", { style: { fontSize: 12, color: "#ef4444", fontWeight: 600 }, children: "Price feed error \u2014 retrying" }), price && (_jsx(StatBox, { label: "Live Price", value: fmtPrice(price.usd), sub: _jsxs("span", { style: { color: price.usd_24h_change >= 0 ? "#16a34a" : "#dc2626", fontWeight: 700 }, children: [fmtChange(price.usd_24h_change), " 24h"] }) })), _jsx(StatBox, { label: "24hr Vol", value: `${totalVol}K`, sub: "Fini Coin" }), _jsx(StatBox, { label: "Live Battles", value: String(liveBattles.length), sub: `of ${battles.length} total` })] })] }), _jsx("div", { style: { display: "flex", gap: 0 }, children: TYPE_FILTERS.map(f => (_jsx("button", { onClick: () => setType(f.value), style: {
                                    padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer",
                                    background: "none", border: "none",
                                    color: type === f.value ? "#111" : "#888",
                                    borderBottom: type === f.value ? `2.5px solid ${meta.color}` : "2.5px solid transparent",
                                    transition: "all 0.12s",
                                }, children: f.label }, f.label))) })] }) }), _jsxs("div", { style: { maxWidth: 1300, margin: "0 auto", padding: "24px 48px" }, children: [_jsxs("div", { style: { display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 24 }, children: [TIME_FILTERS.map(t => (_jsx("button", { onClick: () => setTime(t), style: {
                                    padding: "6px 14px", borderRadius: 100, border: "none", cursor: "pointer",
                                    fontSize: 12, fontWeight: 700,
                                    background: time === t ? meta.color : "#fff",
                                    color: time === t ? "#fff" : "#666",
                                    boxShadow: "0 1px 3px rgba(0,0,0,0.06)", transition: "all 0.12s",
                                }, children: t }, t))), lastUpdated && (_jsxs("span", { style: { marginLeft: "auto", fontSize: 11, color: "#bbb", alignSelf: "center" }, children: ["Prices updated ", lastUpdated.toLocaleTimeString()] }))] }), battles.length === 0 ? (_jsxs("div", { style: { textAlign: "center", padding: "60px 0", color: "#aaa" }, children: [_jsx("div", { style: { fontSize: 40, marginBottom: 12 }, children: "\u2694\uFE0F" }), _jsx("div", { style: { fontWeight: 700, fontSize: 16 }, children: "No battles match this filter" })] })) : (_jsx("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }, children: battles.map(b => _jsx(BattleCard, { battle: b }, b.id)) })), _jsxs("div", { style: { marginTop: 48 }, children: [_jsx("div", { style: { fontSize: 13, fontWeight: 700, color: "#999", marginBottom: 12 }, children: "Other arenas" }), _jsx("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" }, children: Object.entries(ASSET_META).filter(([s]) => s !== sym).map(([s, m]) => (_jsxs(Link, { to: `/crypto/${s.toLowerCase()}`, style: {
                                        display: "flex", alignItems: "center", gap: 6, padding: "7px 14px",
                                        borderRadius: 100, background: m.color + "15", color: m.color,
                                        textDecoration: "none", fontSize: 13, fontWeight: 700,
                                        border: `1.5px solid ${m.color}30`,
                                    }, children: [m.emoji, " ", m.symbol, prices[s] && (_jsx("span", { style: { fontSize: 11, opacity: 0.8 }, children: fmtPrice(prices[s].usd) }))] }, s))) })] }), _jsx(Disclaimer, {})] })] }));
}
function StatBox({ label, value, sub }) {
    return (_jsxs("div", { style: { textAlign: "right" }, children: [_jsx("div", { style: { fontSize: 10, color: "#aaa", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }, children: label }), _jsx("div", { style: { fontSize: 22, fontWeight: 900, color: "#111", lineHeight: 1.1 }, children: value }), _jsx("div", { style: { fontSize: 12, color: "#666", fontWeight: 600 }, children: sub })] }));
}
function Disclaimer() {
    return (_jsx("div", { style: { marginTop: 40, padding: "16px 20px", borderRadius: 12, background: "#f3f4f6", fontSize: 11, color: "#9ca3af", lineHeight: 1.6 }, children: "\uD83E\uDE99 Fini Coin is a non-transferable game currency with no real-world value. This is a game, not financial advice. Live crypto prices are fetched from CoinGecko and may be delayed. Do not use this site as a trading tool." }));
}
