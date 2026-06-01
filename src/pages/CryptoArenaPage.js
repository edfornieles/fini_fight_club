import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { BattleCard } from "../components/BattleCard";
import { ASSET_META } from "../data/mockBattles";
import { useCryptoSim, useSimBattles, useSimFeed } from "../data/cryptoSim";
import { useLivePrices, fmtPrice, fmtChange } from "../hooks/useLivePrices";
import { useMyEntries } from "../state/myEntriesStore";
const TOPIC_TABS = ["Trending", "Live", "Ending Soon", "High Volume"];
const ASSET_FILTERS = ["All", "BTC", "ETH", "SOL", "DOGE", "BNB", "LINK", "AVAX"];
const TYPE_FILTERS = [
    { label: "All", value: "all" },
    { label: "Up / Down", value: "updown" },
    { label: "Outperform", value: "outperform" },
    { label: "Clan War", value: "clanwar" },
];
export function CryptoArenaPage() {
    const [topic, setTopic] = useState("Trending");
    const [asset, setAsset] = useState("All");
    const [type, setType] = useState("all");
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
        if (asset !== "All" && !b.assets.includes(asset))
            return false;
        if (type !== "all" && b.type !== type)
            return false;
        if (topic === "Live" && b.status !== "live")
            return false;
        if (topic === "Ending Soon" && b.endsInMs > 20 * 60 * 1000)
            return false;
        if (topic === "High Volume" && b.volumeK < 80)
            return false;
        return true;
    });
    const liveCount = battles.filter(b => b.status === "live").length;
    return (_jsxs("div", { style: { fontFamily: "'Nunito', system-ui, sans-serif", background: "#f8f9fa", minHeight: "100vh" }, children: [_jsx("div", { style: { background: "#fff", borderBottom: "1px solid #f0f0f0", padding: "28px 48px 0" }, children: _jsxs("div", { style: { maxWidth: 1300, margin: "0 auto" }, children: [_jsxs("div", { style: { display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }, children: [_jsx("h1", { style: { fontSize: 26, fontWeight: 900, color: "#111", margin: 0 }, children: "Crypto Arena" }), _jsxs("span", { style: { fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 100, background: "#dcfce7", color: "#15803d" }, children: [liveCount, " Live"] })] }), _jsx("div", { style: { display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }, children: Object.entries(ASSET_META).map(([sym, meta]) => (_jsxs(Link, { to: "/crypto/" + sym.toLowerCase(), style: {
                                    display: "flex", alignItems: "center", gap: 6, padding: "6px 14px",
                                    borderRadius: 100, background: meta.color + "12", color: meta.color,
                                    textDecoration: "none", fontSize: 13, fontWeight: 700,
                                    border: "1.5px solid " + meta.color + "28",
                                }, children: [_jsx("span", { children: meta.emoji }), _jsx("span", { children: meta.symbol }), prices[sym] && _jsxs(_Fragment, { children: [_jsx("span", { style: { fontSize: 11, fontWeight: 600, opacity: 0.85 }, children: fmtPrice(prices[sym].usd) }), _jsx("span", { style: { fontSize: 10, fontWeight: 700, color: prices[sym].usd_24h_change >= 0 ? "#16a34a" : "#dc2626" }, children: fmtChange(prices[sym].usd_24h_change) })] })] }, sym))) }), _jsx("div", { style: { display: "flex", gap: 0 }, children: TOPIC_TABS.map(t => (_jsx("button", { onClick: () => setTopic(t), style: {
                                    padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer",
                                    background: "none", border: "none", color: topic === t ? "#111" : "#888",
                                    borderBottom: topic === t ? "2.5px solid #f472b6" : "2.5px solid transparent",
                                }, children: t }, t))) })] }) }), _jsxs("div", { style: { maxWidth: 1300, margin: "0 auto", padding: "24px 48px" }, children: [_jsxs("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }, children: [ASSET_FILTERS.map(a => (_jsx("button", { onClick: () => setAsset(a), style: {
                                    padding: "6px 12px", borderRadius: 100, border: "none", cursor: "pointer",
                                    fontSize: 12, fontWeight: 700,
                                    background: asset === a ? "#111" : "#fff", color: asset === a ? "#fff" : "#666",
                                    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                                }, children: a }, a))), _jsx("div", { style: { width: 1, height: 24, background: "#e5e7eb" } }), TYPE_FILTERS.map(f => (_jsx("button", { onClick: () => setType(f.value), style: {
                                    padding: "6px 12px", borderRadius: 100, border: "none", cursor: "pointer",
                                    fontSize: 12, fontWeight: 700,
                                    background: type === f.value ? "#111" : "#fff", color: type === f.value ? "#fff" : "#666",
                                    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                                }, children: f.label }, f.label)))] }), _jsxs("div", { style: { display: "grid", gridTemplateColumns: "1fr 280px", gap: 24, alignItems: "start" }, children: [_jsx("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }, children: filtered.map(b => _jsx(BattleCard, { battle: b }, b.id)) }), _jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 14, position: "sticky", top: 20 }, children: [myEntries.length > 0 && (_jsxs("aside", { style: {
                                            background: "#fff", borderRadius: 16,
                                            border: "1.5px solid #f0f0f0",
                                            padding: "16px 16px 12px",
                                            maxHeight: "40vh", overflow: "hidden",
                                            display: "flex", flexDirection: "column",
                                        }, children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }, children: [_jsx("span", { style: { fontSize: 12, fontWeight: 800, color: "#111" }, children: "My Active Battles" }), _jsx("span", { style: { fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 100, background: "#fce8f3", color: "#be185d" }, children: myEntries.length })] }), _jsx("div", { style: { flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }, children: myEntries.map(entry => {
                                                    const remaining = Math.max(0, entry.endsAt - Date.now());
                                                    const elapsedPct = entry.durationMs > 0
                                                        ? Math.min(100, ((entry.durationMs - remaining) / entry.durationMs) * 100)
                                                        : 100;
                                                    const settled = remaining <= 0;
                                                    const fmtTime = (ms) => {
                                                        if (ms <= 0)
                                                            return "Resolving…";
                                                        const s = Math.floor(ms / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60);
                                                        if (h > 0)
                                                            return `${h}h ${m % 60}m`;
                                                        if (m > 0)
                                                            return `${m}m ${s % 60}s`;
                                                        return `${s}s`;
                                                    };
                                                    const sideColor = entry.side === "A" ? "#16a34a" : "#dc2626";
                                                    return (_jsxs(Link, { to: `/battle/${entry.battleId}`, style: {
                                                            textDecoration: "none", color: "inherit",
                                                            background: "#fafafa", borderRadius: 10,
                                                            padding: "10px 12px", borderLeft: `3px solid ${sideColor}`,
                                                            display: "block",
                                                        }, children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 4 }, children: [_jsx("div", { style: { fontSize: 12, fontWeight: 800, color: "#111", lineHeight: 1.3, flex: 1 }, children: entry.battleTitle }), settled ? (_jsx("span", { style: { fontSize: 9, fontWeight: 800, color: "#a855f7", padding: "1px 6px", borderRadius: 100, background: "#faf5ff", whiteSpace: "nowrap" }, children: "SETTLING" })) : (_jsx("span", { style: { fontSize: 9, fontWeight: 800, color: "#16a34a", padding: "1px 6px", borderRadius: 100, background: "#dcfce7", whiteSpace: "nowrap" }, children: "\u25CF LIVE" }))] }), _jsxs("div", { style: { fontSize: 11, color: "#666", fontWeight: 600, marginBottom: 6 }, children: [_jsx("span", { style: { color: sideColor, fontWeight: 800 }, children: entry.sideLabel }), _jsx("span", { style: { color: "#aaa" }, children: " \u00B7 " }), _jsxs("span", { style: { color: "#854d0e", fontWeight: 800 }, children: [entry.stake, " FINI$"] })] }), _jsx("div", { style: { height: 5, borderRadius: 100, background: "#f3f4f6", overflow: "hidden", marginBottom: 4 }, children: _jsx("div", { style: {
                                                                        height: "100%", width: `${elapsedPct}%`,
                                                                        background: settled
                                                                            ? "linear-gradient(90deg, #a855f7, #7c3aed)"
                                                                            : `linear-gradient(90deg, ${sideColor}, ${sideColor}aa)`,
                                                                        borderRadius: 100, transition: "width 0.5s ease",
                                                                    } }) }), _jsxs("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 10, fontWeight: 700, color: "#888" }, children: [_jsxs("span", { children: [Math.round(elapsedPct), "% elapsed"] }), _jsx("span", { style: { fontFamily: "monospace", fontVariantNumeric: "tabular-nums" }, children: fmtTime(remaining) })] })] }, entry.battleId));
                                                }) })] })), _jsxs("aside", { style: {
                                            background: "#fff", borderRadius: 16,
                                            border: "1.5px solid #f0f0f0",
                                            padding: "16px 16px 8px", maxHeight: myEntries.length > 0 ? "calc(60vh - 40px)" : "calc(100vh - 40px)",
                                            overflow: "hidden", display: "flex", flexDirection: "column",
                                        }, children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }, children: [_jsx("span", { style: { fontSize: 12, fontWeight: 800, color: "#111" }, children: "Live Predictions" }), _jsx("span", { style: { fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 100, background: "#dcfce7", color: "#15803d", textTransform: "uppercase", letterSpacing: 0.5 }, children: "\u25CF Live" })] }), _jsxs("div", { style: { flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }, children: [feed.length === 0 && (_jsx("div", { style: { fontSize: 11, color: "#aaa", fontStyle: "italic", padding: "20px 0", textAlign: "center" }, children: "Waiting for activity\u2026" })), feed.slice(0, 30).map(entry => {
                                                        const sideColor = entry.side === "A" ? "#22c55e" : "#ef4444";
                                                        return (_jsxs(Link, { to: `/battle/${entry.battleId}`, style: {
                                                                textDecoration: "none", display: "block",
                                                                background: "#fafafa", borderRadius: 8, padding: "8px 10px",
                                                                borderLeft: `2.5px solid ${sideColor}`,
                                                            }, children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [_jsx("span", { style: { fontFamily: "monospace", fontSize: 11, fontWeight: 700, color: "#666" }, children: entry.shortWallet }), _jsx("span", { style: { fontSize: 10, color: sideColor, fontWeight: 800 }, children: entry.sideLabel })] }), _jsxs("div", { style: { fontSize: 11, color: "#111", fontWeight: 700, marginTop: 2 }, children: [entry.amount, " FINI$ on ", _jsx("span", { style: { color: "#666", fontWeight: 600 }, children: entry.asset })] })] }, entry.id));
                                                    })] })] })] })] }), _jsx("div", { style: { marginTop: 40, padding: "16px 20px", borderRadius: 12, background: "#f3f4f6", fontSize: 11, color: "#9ca3af", lineHeight: 1.6 }, children: "Fini Coin is a non-transferable in-game currency with no real-world value. This is a game." })] })] }));
}
