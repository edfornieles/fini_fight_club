import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useNavigate } from "react-router-dom";
const ASSET_COLORS = {
    BTC: "#f7931a", ETH: "#627eea", SOL: "#9945ff", DOGE: "#c3a634",
    LINK: "#2a5ada", UNI: "#ff007a", AVAX: "#e84142", BNB: "#f3ba2f",
    MATIC: "#8247e5", XTZ: "#a6e000",
};
function fmtTime(ms) {
    if (ms <= 0)
        return "Ended";
    const s = Math.floor(ms / 1000);
    if (s < 60)
        return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60)
        return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24)
        return `${h}h ${m % 60}m`;
    return `${Math.floor(h / 24)}d`;
}
function StatusChip({ status, endsInMs }) {
    const endingSoon = endsInMs > 0 && endsInMs < 1000 * 60 * 20;
    if (status === "live")
        return (_jsxs("span", { style: { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 100, background: endingSoon ? "#fff3cd" : "#dcfce7", color: endingSoon ? "#92400e" : "#15803d" }, children: [_jsx("span", { style: { width: 6, height: 6, borderRadius: "50%", background: endingSoon ? "#f59e0b" : "#22c55e" } }), endingSoon ? "Ending soon" : "Live"] }));
    if (status === "upcoming")
        return _jsx("span", { style: { fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 100, background: "#dbeafe", color: "#1d4ed8" }, children: "Upcoming" });
    if (status === "resolving")
        return _jsx("span", { style: { fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 100, background: "#fef9c3", color: "#854d0e" }, children: "Resolving" });
    return _jsx("span", { style: { fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 100, background: "#f3f4f6", color: "#6b7280" }, children: "Resolved" });
}
export function BattleCard({ battle }) {
    const navigate = useNavigate();
    const { sideA, sideB } = battle;
    return (_jsxs("div", { onClick: () => navigate(`/battle/${battle.id}`), style: {
            fontFamily: "'Nunito', system-ui, sans-serif",
            background: "#fff", borderRadius: 20, border: "1.5px solid #f0f0f0",
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)", cursor: "pointer", overflow: "hidden",
            display: "flex", flexDirection: "column",
            transition: "transform 0.15s, box-shadow 0.15s",
        }, onMouseEnter: e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.10)"; }, onMouseLeave: e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.06)"; }, children: [_jsxs("div", { style: { height: 68, background: "#fce8e8", display: "flex", overflow: "hidden", position: "relative" }, children: [_jsx("div", { style: { flex: 1, background: ASSET_COLORS[battle.assets[0]] + "22", display: "flex", alignItems: "center", justifyContent: "center" }, children: _jsx(FiniGlyph, { family: battle.assets[0], size: 42 }) }), battle.assets[1] && (_jsxs(_Fragment, { children: [_jsx("div", { style: { width: 2, background: "#fff", zIndex: 1 } }), _jsx("div", { style: { flex: 1, background: ASSET_COLORS[battle.assets[1]] + "22", display: "flex", alignItems: "center", justifyContent: "center" }, children: _jsx(FiniGlyph, { family: battle.assets[1], size: 42 }) })] })), _jsx("div", { style: { position: "absolute", top: 8, left: 8 }, children: _jsx(StatusChip, { status: battle.status, endsInMs: battle.endsInMs }) }), _jsx("div", { style: { position: "absolute", top: 8, right: 8, fontSize: 10, fontWeight: 700, color: "#aaa", background: "rgba(255,255,255,0.85)", padding: "2px 7px", borderRadius: 6 }, children: battle.durationLabel })] }), _jsxs("div", { style: { padding: "14px 16px 12px", flex: 1, display: "flex", flexDirection: "column", gap: 10 }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontSize: 13, fontWeight: 800, color: "#111", lineHeight: 1.3 }, children: battle.title }), _jsx("div", { style: { fontSize: 11, color: "#888", marginTop: 3, lineHeight: 1.4 }, children: battle.question })] }), _jsxs("div", { children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 800, marginBottom: 4 }, children: [_jsxs("span", { style: { color: "#16a34a" }, children: [sideA.label, " ", sideA.pct, "%"] }), _jsxs("span", { style: { color: "#dc2626" }, children: [sideB.label, " ", sideB.pct, "%"] })] }), _jsx("div", { style: { height: 5, borderRadius: 100, background: "#f3f4f6", overflow: "hidden" }, children: _jsx("div", { style: { height: "100%", width: `${sideA.pct}%`, background: "linear-gradient(90deg, #22c55e, #16a34a)", borderRadius: 100 } }) })] }), _jsxs("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }, children: [_jsxs("button", { onClick: e => e.stopPropagation(), style: { padding: "7px 0", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 800, background: "#dcfce7", color: "#15803d" }, children: [sideA.label, " ", _jsxs("span", { style: { opacity: 0.7 }, children: [sideA.pct, "%"] })] }), _jsxs("button", { onClick: e => e.stopPropagation(), style: { padding: "7px 0", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 800, background: "#fee2e2", color: "#dc2626" }, children: [sideB.label, " ", _jsxs("span", { style: { opacity: 0.7 }, children: [sideB.pct, "%"] })] })] }), _jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 4, borderTop: "1px solid #f3f4f6" }, children: [_jsx("div", { style: { display: "flex", gap: 4, alignItems: "center" }, children: battle.assets.map(a => (_jsx("span", { style: { fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 100, background: ASSET_COLORS[a] + "20", color: ASSET_COLORS[a] }, children: a }, a))) }), _jsxs("div", { style: { display: "flex", gap: 8, fontSize: 11, color: "#aaa", fontWeight: 600 }, children: [_jsxs("span", { children: ["\uD83E\uDE99 ", battle.volumeK, "K"] }), battle.endsInMs > 0 && _jsxs("span", { children: ["\u23F1 ", fmtTime(battle.endsInMs)] })] })] })] })] }));
}
function FiniGlyph({ family, size }) {
    const color = ASSET_COLORS[family] ?? "#aaa";
    const emoji = { BTC: "👑", ETH: "🔮", SOL: "⚡", DOGE: "🐕", LINK: "🔗", UNI: "🦄", AVAX: "🏔", BNB: "⭕", MATIC: "🔷", XTZ: "🧊" };
    return (_jsx("div", { style: { width: size, height: size, borderRadius: "50%", background: color + "30", border: `2px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.44 }, children: emoji[family] ?? "⚔️" }));
}
