import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { Link } from "react-router-dom";
const S = { fontFamily: "'Nunito', system-ui, sans-serif" };
// ── Mock data ──────────────────────────────────────────────────────────────────
const TOP_FINIS = [
    { rank: 1, tokenId: 4104, family: "BTC", clan: "Arms of the State", wins: 546, losses: 87, owner: "_samspike_", avatar: null },
    { rank: 2, tokenId: 2847, family: "ETH", clan: "Artists", wins: 347, losses: 102, owner: "_jorgelopez_", avatar: null },
    { rank: 3, tokenId: 7291, family: "SOL", clan: "Soldiers", wins: 321, losses: 96, owner: "_llovd057_", avatar: null },
    { rank: 4, tokenId: 1062, family: "DOGE", clan: "Townspeople", wins: 220, losses: 71, owner: "_edfornieles_", avatar: null },
    { rank: 5, tokenId: 4103, family: "BTC", clan: "Miners", wins: 198, losses: 88, owner: "_dollarmonopoly_", avatar: null },
    { rank: 6, tokenId: 8801, family: "LINK", clan: "Hourly", wins: 176, losses: 65, owner: "_jakeyewan_", avatar: null },
    { rank: 7, tokenId: 3344, family: "ETH", clan: "Twice Daily", wins: 176, losses: 71, owner: "_SJ_Spain_", avatar: null },
    { rank: 8, tokenId: 5566, family: "MATIC", clan: "Farmers", wins: 164, losses: 78, owner: "_market_mage_", avatar: null },
    { rank: 9, tokenId: 6212, family: "UNI", clan: "Artists", wins: 148, losses: 91, owner: "_uniswap_labs_", avatar: null },
    { rank: 10, tokenId: 9100, family: "XTZ", clan: "Hourly", wins: 132, losses: 64, owner: "_baker_council_", avatar: null },
];
const TOP_TEAMS = [
    { rank: 1, teamName: "Volatility Cult", owner: "_samspike_", wins: 142, members: 3, family: "ETH" },
    { rank: 2, teamName: "BTC Mountain", owner: "_dani_eth", wins: 118, members: 3, family: "BTC" },
    { rank: 3, teamName: "Solar Flare Squad", owner: "_0xpresley", wins: 94, members: 3, family: "SOL" },
    { rank: 4, teamName: "Diamond Pawed Dogs", owner: "_DollarMonopoly_", wins: 81, members: 3, family: "DOGE" },
    { rank: 5, teamName: "Oracle Whisperers", owner: "_llovd057_", wins: 72, members: 3, family: "LINK" },
    { rank: 6, teamName: "Pastel Panic", owner: "_market_mage_", wins: 68, members: 3, family: "MATIC" },
    { rank: 7, teamName: "Liquidity Rangers", owner: "_uniswap_labs_", wins: 61, members: 3, family: "UNI" },
    { rank: 8, teamName: "Council Stew", owner: "_baker_council_", wins: 54, members: 3, family: "XTZ" },
];
const TOP_FAMILIES = [
    { rank: 1, family: "BTC", name: "BTC", emoji: "👑", color: "#f7931a", weekWins: 1842, weekVol: 2_104_000, change24h: +3.4 },
    { rank: 2, family: "ETH", name: "ETH", emoji: "🔮", color: "#627eea", weekWins: 1620, weekVol: 1_882_000, change24h: -1.2 },
    { rank: 3, family: "SOL", name: "SOL", emoji: "⚡", color: "#9945ff", weekWins: 1305, weekVol: 1_440_000, change24h: +5.1 },
    { rank: 4, family: "DOGE", name: "DOGE", emoji: "🐕", color: "#c3a634", weekWins: 1098, weekVol: 930_000, change24h: +8.6 },
    { rank: 5, family: "BNB", name: "BNB", emoji: "⭕", color: "#f3ba2f", weekWins: 890, weekVol: 712_000, change24h: -0.4 },
    { rank: 6, family: "LINK", name: "LINK", emoji: "🔗", color: "#2a5ada", weekWins: 712, weekVol: 544_000, change24h: -2.1 },
    { rank: 7, family: "AVAX", name: "AVAX", emoji: "🏔", color: "#e84142", weekWins: 584, weekVol: 421_000, change24h: +1.8 },
    { rank: 8, family: "MATIC", name: "MATIC", emoji: "🔷", color: "#8247e5", weekWins: 466, weekVol: 338_000, change24h: -3.0 },
    { rank: 9, family: "UNI", name: "UNI", emoji: "🦄", color: "#ff007a", weekWins: 398, weekVol: 284_000, change24h: +2.4 },
    { rank: 10, family: "XTZ", name: "XTZ", emoji: "🧊", color: "#a6e000", weekWins: 302, weekVol: 196_000, change24h: -1.5 },
];
const CLAN_TINTS = {
    "Arms of the State": "#b8c8d8", "Hourly": "#c8b4a0", "Townspeople": "#d4cfa0",
    "Artists": "#d4a4a0", "Soldiers": "#b0b0c8", "Twice Daily": "#a8c8d8",
    "Miners": "#b8a890", "Farmers": "#a8b8a0",
};
export function LeaderboardPage() {
    const [tab, setTab] = useState("finis");
    const [period, setPeriod] = useState("week");
    return (_jsxs("div", { style: { ...S, background: "#f8f9fa", minHeight: "100vh" }, children: [_jsx("div", { style: { background: "#fff", borderBottom: "1px solid #f0f0f0", padding: "36px 48px 24px" }, children: _jsxs("div", { style: { maxWidth: 1200, margin: "0 auto" }, children: [_jsx("h1", { style: { fontSize: 30, fontWeight: 900, color: "#111", margin: 0 }, children: "\uD83C\uDFC5 Leaderboard" }), _jsx("p", { style: { fontSize: 14, color: "#888", marginTop: 6, marginBottom: 24, fontWeight: 500 }, children: "Top performers across the Fini universe \u2014 battle-tested." }), _jsxs("div", { style: { display: "flex", gap: 4, background: "#f3f4f6", borderRadius: 100, padding: 4, width: "fit-content", marginBottom: 16 }, children: [_jsx(TabBtn, { active: tab === "finis", onClick: () => setTab("finis"), children: "\uD83D\uDC3E Top Finis" }), _jsx(TabBtn, { active: tab === "teams", onClick: () => setTab("teams"), children: "\u2694\uFE0F Top Teams" }), _jsx(TabBtn, { active: tab === "families", onClick: () => setTab("families"), children: "\uD83D\uDC51 Top Families" })] }), _jsx("div", { style: { display: "flex", gap: 6 }, children: ["week", "month", "alltime"].map(p => (_jsx("button", { onClick: () => setPeriod(p), style: {
                                    padding: "5px 14px", borderRadius: 100, border: "none", cursor: "pointer",
                                    fontSize: 12, fontWeight: 700,
                                    background: period === p ? "#111" : "#fff",
                                    color: period === p ? "#fff" : "#666",
                                    boxShadow: period === p ? "none" : "0 1px 3px rgba(0,0,0,0.06)",
                                }, children: p === "week" ? "This week" : p === "month" ? "This month" : "All-time" }, p))) })] }) }), _jsxs("div", { style: { maxWidth: 1200, margin: "0 auto", padding: "32px 48px" }, children: [tab === "finis" && _jsx(FinisLeaderboard, {}), tab === "teams" && _jsx(TeamsLeaderboard, {}), tab === "families" && _jsx(FamiliesLeaderboard, { period: period })] })] }));
}
// ── Top Finis ──────────────────────────────────────────────────────────────────
function FinisLeaderboard() {
    return (_jsxs("div", { style: { display: "grid", gridTemplateColumns: "1fr 380px", gap: 24, alignItems: "start" }, children: [_jsx(Card, { title: "Most-winning Finis", subtitle: "Finis with the strongest battle records", children: _jsx("div", { style: { display: "flex", flexDirection: "column", gap: 8 }, children: TOP_FINIS.map(f => (_jsx(FiniRow, { fini: f }, f.tokenId))) }) }), _jsxs("div", { style: { position: "sticky", top: 80, display: "flex", flexDirection: "column", gap: 16 }, children: [_jsx(Card, { title: "Player of the Day", subtitle: "", children: _jsxs("div", { style: { position: "relative" }, children: [_jsxs("div", { style: {
                                        background: CLAN_TINTS[TOP_FINIS[0].clan] ?? "#fce8f3",
                                        borderRadius: 14, height: 240,
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        position: "relative", overflow: "hidden",
                                    }, children: [_jsx("img", { src: `/clan-art/${slugify(TOP_FINIS[0].clan)}.gif`, alt: TOP_FINIS[0].clan, style: { height: 200, width: "auto", objectFit: "contain" }, onError: e => { e.target.style.display = "none"; } }), _jsx("div", { style: {
                                                position: "absolute", top: 14, right: -28,
                                                transform: "rotate(28deg)",
                                                background: "#fde047", color: "#854d0e",
                                                padding: "5px 36px", fontSize: 11, fontWeight: 800,
                                                boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
                                            }, children: "Player of the day!" })] }), _jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }, children: [_jsxs("div", { style: { display: "flex", alignItems: "center", gap: 10 }, children: [_jsx(RankBadge, { rank: 1, size: 28 }), _jsxs("div", { children: [_jsx("div", { style: { fontSize: 14, fontWeight: 800, color: "#111" }, children: "Sam Spike" }), _jsx("div", { style: { fontSize: 11, color: "#888" }, children: TOP_FINIS[0].owner })] })] }), _jsxs("div", { style: { display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: "#854d0e", fontWeight: 800 }, children: [_jsx("span", { children: "\uD83C\uDFC6" }), " ", TOP_FINIS[0].wins, " wins"] })] })] }) }), _jsx(Card, { title: "How rankings work", subtitle: "", children: _jsxs("ul", { style: { fontSize: 12, color: "#666", lineHeight: 1.8, paddingLeft: 18, margin: 0 }, children: [_jsx("li", { children: "Each Fini's wins/losses are tracked across all battles" }), _jsx("li", { children: "Win streaks unlock cosmetic badges" }), _jsx("li", { children: "Resets monthly to keep things competitive" })] }) })] })] }));
}
function FiniRow({ fini }) {
    return (_jsxs("div", { style: {
            display: "flex", alignItems: "center", gap: 14,
            padding: "10px 14px", borderRadius: 12,
            background: "#fff", border: "1.5px solid #f0f0f0",
            transition: "background 0.12s",
        }, onMouseEnter: e => (e.currentTarget.style.background = "#fafafa"), onMouseLeave: e => (e.currentTarget.style.background = "#fff"), children: [_jsx(RankBadge, { rank: fini.rank }), _jsx("div", { style: {
                    width: 38, height: 38, borderRadius: "50%",
                    background: CLAN_TINTS[fini.clan] ?? "#ddd",
                    overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                }, children: _jsx("img", { src: `/clan-art/${slugify(fini.clan)}.gif`, alt: "", style: { height: 32, width: "auto" }, onError: e => { e.target.style.display = "none"; } }) }), _jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsxs("div", { style: { fontSize: 14, fontWeight: 800, color: "#111", display: "flex", alignItems: "center", gap: 8 }, children: ["Fini #", fini.tokenId, _jsx("span", { style: { fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 100, background: "#f3f4f6", color: "#666" }, children: fini.family })] }), _jsxs("div", { style: { fontSize: 11, color: "#888" }, children: [fini.clan, " \u00B7 owned by ", fini.owner] })] }), _jsxs("div", { style: { textAlign: "right", flexShrink: 0 }, children: [_jsxs("div", { style: { fontSize: 16, fontWeight: 900, color: "#111" }, children: [fini.wins, " ", _jsx("span", { style: { fontSize: 11, color: "#888", fontWeight: 600 }, children: "wins" })] }), _jsxs("div", { style: { fontSize: 10, color: "#aaa" }, children: [Math.round((fini.wins / (fini.wins + fini.losses)) * 100), "% win rate"] })] })] }));
}
// ── Top Teams ──────────────────────────────────────────────────────────────────
function TeamsLeaderboard() {
    const FAMILY_COLOR = {
        BTC: "#f7931a", ETH: "#627eea", SOL: "#9945ff", DOGE: "#c3a634",
        LINK: "#2a5ada", MATIC: "#8247e5", BNB: "#f3ba2f", AVAX: "#e84142",
        UNI: "#ff007a", XTZ: "#a6e000",
    };
    return (_jsx(Card, { title: "Top Auto-Battler Teams", subtitle: "Teams with the most wins in the Fight Club", children: _jsx("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }, children: TOP_TEAMS.map(t => {
                const color = FAMILY_COLOR[t.family] ?? "#888";
                return (_jsxs("div", { style: {
                        borderRadius: 16, border: "1.5px solid #f0f0f0", background: "#fff",
                        padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10,
                    }, children: [_jsxs("div", { style: { display: "flex", alignItems: "center", gap: 10 }, children: [_jsx(RankBadge, { rank: t.rank }), _jsxs("div", { style: { flex: 1 }, children: [_jsx("div", { style: { fontSize: 14, fontWeight: 900, color: "#111" }, children: t.teamName }), _jsxs("div", { style: { fontSize: 11, color: "#888" }, children: ["by ", t.owner] })] }), _jsx("span", { style: { fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 100, background: color + "20", color }, children: t.family })] }), _jsxs("div", { style: { background: "#f9fafb", borderRadius: 10, padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontSize: 9, color: "#aaa", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }, children: "Auto-battler wins" }), _jsx("div", { style: { fontSize: 20, fontWeight: 900, color: "#111" }, children: t.wins })] }), _jsx("div", { style: { fontSize: 22 }, children: "\uD83C\uDFC6" })] })] }, t.rank));
            }) }) }));
}
// ── Top Families ────────────────────────────────────────────────────────────────
function FamiliesLeaderboard({ period }) {
    const periodLabel = period === "week" ? "this week" : period === "month" ? "this month" : "all-time";
    const champion = TOP_FAMILIES[0];
    return (_jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 24 }, children: [_jsxs("div", { style: {
                    background: `linear-gradient(135deg, ${champion.color}22, ${champion.color}08)`,
                    borderRadius: 20, padding: "28px 32px",
                    border: `1.5px solid ${champion.color}30`,
                    display: "flex", alignItems: "center", gap: 24, position: "relative", overflow: "hidden",
                }, children: [_jsx("div", { style: {
                            width: 86, height: 86, borderRadius: "50%",
                            background: champion.color + "35", border: `3px solid ${champion.color}`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 42, flexShrink: 0,
                        }, children: champion.emoji }), _jsxs("div", { style: { flex: 1 }, children: [_jsxs("div", { style: { fontSize: 11, fontWeight: 800, color: champion.color, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }, children: ["\uD83D\uDC51 Reigning champion \u00B7 ", periodLabel] }), _jsxs("div", { style: { fontSize: 26, fontWeight: 900, color: "#111", display: "flex", alignItems: "center", gap: 12 }, children: [champion.name, _jsx("span", { style: { fontSize: 13, color: champion.color, fontWeight: 700, padding: "3px 10px", borderRadius: 100, background: "#fff" }, children: champion.family })] }), _jsxs("div", { style: { fontSize: 13, color: "#666", marginTop: 4 }, children: [_jsx("strong", { children: champion.weekWins.toLocaleString() }), " arena wins \u00B7 ", (champion.weekVol / 1000).toFixed(0), "K FINI$ volume \u00B7 ", champion.change24h >= 0 ? "+" : "", champion.change24h, "% today"] })] }), _jsx(Link, { to: `/crypto/${champion.family.toLowerCase()}`, style: {
                            padding: "10px 20px", borderRadius: 100,
                            background: champion.color, color: "#fff",
                            fontSize: 13, fontWeight: 800, textDecoration: "none",
                            flexShrink: 0,
                        }, children: "Visit arena \u2192" })] }), _jsx(Card, { title: `All families ranked · ${periodLabel}`, subtitle: "Crypto Arena battle performance by Fini family", children: _jsx("div", { style: { display: "flex", flexDirection: "column", gap: 8 }, children: TOP_FAMILIES.map((f, i) => {
                        const top = TOP_FAMILIES[0].weekWins;
                        const barPct = (f.weekWins / top) * 100;
                        return (_jsxs(Link, { to: `/crypto/${f.family.toLowerCase()}`, style: {
                                display: "flex", alignItems: "center", gap: 14,
                                padding: "12px 14px", borderRadius: 12,
                                background: i === 0 ? f.color + "10" : "#fff",
                                border: `1.5px solid ${i === 0 ? f.color + "30" : "#f0f0f0"}`,
                                textDecoration: "none",
                                transition: "transform 0.12s",
                            }, onMouseEnter: e => (e.currentTarget.style.transform = "translateX(2px)"), onMouseLeave: e => (e.currentTarget.style.transform = ""), children: [_jsx(RankBadge, { rank: f.rank }), _jsx("div", { style: {
                                        width: 38, height: 38, borderRadius: "50%",
                                        background: f.color + "25", border: `2px solid ${f.color}`,
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        fontSize: 18, flexShrink: 0,
                                    }, children: f.emoji }), _jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsxs("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [_jsx("span", { style: { fontSize: 14, fontWeight: 800, color: "#111" }, children: f.name }), _jsx("span", { style: { fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 100, background: f.color + "20", color: f.color }, children: f.family })] }), _jsx("div", { style: { height: 4, borderRadius: 100, background: "#f3f4f6", overflow: "hidden", marginTop: 6 }, children: _jsx("div", { style: { height: "100%", width: `${barPct}%`, background: f.color, borderRadius: 100 } }) })] }), _jsxs("div", { style: { textAlign: "right", flexShrink: 0 }, children: [_jsx("div", { style: { fontSize: 15, fontWeight: 900, color: "#111" }, children: f.weekWins.toLocaleString() }), _jsxs("div", { style: { fontSize: 10, color: f.change24h >= 0 ? "#16a34a" : "#dc2626", fontWeight: 700 }, children: [f.change24h >= 0 ? "▲" : "▼", " ", Math.abs(f.change24h), "%"] })] })] }, f.family));
                    }) }) })] }));
}
// ── Helpers ────────────────────────────────────────────────────────────────────
function TabBtn({ active, onClick, children }) {
    return (_jsx("button", { onClick: onClick, style: {
            padding: "8px 18px", borderRadius: 100, border: "none",
            fontSize: 13, fontWeight: 700, cursor: "pointer",
            background: active ? "#fff" : "transparent",
            color: active ? "#111" : "#888",
            boxShadow: active ? "0 1px 4px rgba(0,0,0,0.10)" : "none",
            transition: "all 0.15s",
        }, children: children }));
}
function Card({ title, subtitle, children }) {
    return (_jsxs("div", { style: { background: "#fff", borderRadius: 20, border: "1.5px solid #f0f0f0", padding: "22px 24px" }, children: [_jsxs("div", { style: { marginBottom: 16 }, children: [_jsx("div", { style: { fontSize: 15, fontWeight: 800, color: "#111" }, children: title }), subtitle && _jsx("div", { style: { fontSize: 12, color: "#aaa", marginTop: 2 }, children: subtitle })] }), children] }));
}
function RankBadge({ rank, size = 22 }) {
    const top3 = rank <= 3;
    const bg = rank === 1 ? "#fde047" : rank === 2 ? "#d1d5db" : rank === 3 ? "#fdba74" : "#f3f4f6";
    const color = rank === 1 ? "#854d0e" : rank === 2 ? "#374151" : rank === 3 ? "#7c2d12" : "#888";
    return (_jsx("div", { style: {
            width: size, height: size, borderRadius: "50%",
            background: bg, color, fontSize: size * 0.5, fontWeight: 800,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
            boxShadow: top3 ? `0 0 0 1.5px ${color}30` : "none",
        }, children: rank }));
}
function slugify(s) {
    return s.toLowerCase().replace(/'/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}
