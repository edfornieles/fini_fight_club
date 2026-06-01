import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useUIStore } from "../state/uiStore";
import { Link } from "react-router-dom";
import { ConnectWalletButton } from "../components/ConnectWalletButton";
const S = { fontFamily: "'Nunito', system-ui, sans-serif" };
// Mock stats — in production from server
const MOCK_STATS = {
    finiCoinBalance: 30_000,
    finiCoinWon: 12_400,
    finiCoinSpent: 8_600,
    battlesPlayed: 47,
    battlesWon: 28,
    battlesLost: 19,
    winRate: 0.596,
    ranking: 142,
    totalPlayers: 4820,
    joinedDate: "2026-05-15",
    bestStreak: 7,
    finisOwned: 13,
    daysActive: 23,
};
export function ProfilePage() {
    const { walletAddress } = useUIStore();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [bio, setBio] = useState("");
    const [avatar, setAvatar] = useState(null);
    const [savedAt, setSavedAt] = useState(null);
    function saveProfile() {
        setSavedAt(new Date());
        setTimeout(() => setSavedAt(null), 2500);
    }
    function handleAvatarUpload(e) {
        const file = e.target.files?.[0];
        if (!file)
            return;
        if (file.size > 2 * 1024 * 1024) {
            alert("Image must be under 2MB");
            return;
        }
        const reader = new FileReader();
        reader.onload = ev => setAvatar(ev.target?.result);
        reader.readAsDataURL(file);
    }
    if (!walletAddress) {
        return (_jsxs("div", { style: { ...S, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, background: "#f8f9fa" }, children: [_jsx("div", { style: { fontSize: 48 }, children: "\uD83D\uDC64" }), _jsx("div", { style: { fontSize: 20, fontWeight: 800, color: "#111" }, children: "Connect wallet to view your Profile" }), _jsx(ConnectWalletButton, {})] }));
    }
    const winRatePct = Math.round(MOCK_STATS.winRate * 100);
    return (_jsxs("div", { style: { ...S, background: "#f8f9fa", minHeight: "100vh" }, children: [_jsx("div", { style: { background: "#fff", borderBottom: "1px solid #f0f0f0", padding: "32px 48px 28px" }, children: _jsxs("div", { style: { maxWidth: 1100, margin: "0 auto" }, children: [_jsx("h1", { style: { fontSize: 28, fontWeight: 900, color: "#111", margin: 0 }, children: "\uD83D\uDC64 Profile" }), _jsxs("div", { style: { fontSize: 13, color: "#888", marginTop: 4, fontFamily: "monospace" }, children: [walletAddress.slice(0, 10), "...", walletAddress.slice(-4), " \u00B7 joined ", new Date(MOCK_STATS.joinedDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })] })] }) }), _jsxs("div", { style: { maxWidth: 1100, margin: "0 auto", padding: "32px 48px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }, children: [_jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 20 }, children: [_jsxs(Card, { title: "Player Info", subtitle: "Your name and contact details", children: [_jsxs("div", { style: { display: "flex", alignItems: "center", gap: 16, marginBottom: 18 }, children: [_jsxs("label", { style: { position: "relative", cursor: "pointer" }, children: [_jsx("div", { style: {
                                                            width: 88, height: 88, borderRadius: "50%",
                                                            background: avatar ? `url(${avatar}) center/cover` : "linear-gradient(135deg, #fce7f3, #fbcfe8)",
                                                            border: "3px solid #f472b6",
                                                            display: "flex", alignItems: "center", justifyContent: "center",
                                                            fontSize: 36, color: "#f472b6", overflow: "hidden",
                                                        }, children: !avatar && "👤" }), _jsx("div", { style: {
                                                            position: "absolute", bottom: 0, right: 0,
                                                            width: 28, height: 28, borderRadius: "50%",
                                                            background: "#f472b6", color: "#fff",
                                                            border: "2px solid #fff",
                                                            display: "flex", alignItems: "center", justifyContent: "center",
                                                            fontSize: 14, fontWeight: 800,
                                                        }, children: "\uD83D\uDCF7" }), _jsx("input", { type: "file", accept: "image/*", onChange: handleAvatarUpload, style: { display: "none" } })] }), _jsxs("div", { children: [_jsx("div", { style: { fontSize: 14, fontWeight: 800, color: "#111" }, children: name || "Your profile picture" }), _jsx("div", { style: { fontSize: 12, color: "#888", marginTop: 4 }, children: "Click the avatar to upload an image (max 2MB)" }), avatar && (_jsx("button", { onClick: () => setAvatar(null), style: { marginTop: 8, fontSize: 11, color: "#dc2626", background: "none", border: "none", padding: 0, cursor: "pointer", fontWeight: 700 }, children: "Remove image" }))] })] }), _jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 14 }, children: [_jsx(Field, { label: "Display Name", children: _jsx("input", { value: name, onChange: e => setName(e.target.value), placeholder: "e.g. sam_spike", style: inputStyle }) }), _jsxs(Field, { label: "Email", children: [_jsx("input", { type: "email", value: email, onChange: e => setEmail(e.target.value), placeholder: "you@example.com", style: inputStyle }), _jsx("div", { style: { fontSize: 11, color: "#bbb", marginTop: 4 }, children: "Used for battle notifications and account recovery" })] }), _jsx(Field, { label: "Bio (optional)", children: _jsx("textarea", { value: bio, onChange: e => setBio(e.target.value), placeholder: "Tell other players about your battle style...", rows: 3, style: { ...inputStyle, resize: "vertical", fontFamily: "inherit" } }) })] }), _jsxs("div", { style: { display: "flex", gap: 10, marginTop: 18, alignItems: "center" }, children: [_jsx("button", { onClick: saveProfile, style: { background: "#f472b6", color: "#fff", border: "none", borderRadius: 100, padding: "11px 26px", fontSize: 14, fontWeight: 800, cursor: "pointer" }, children: "Save Profile" }), savedAt && _jsxs("span", { style: { fontSize: 12, color: "#16a34a", fontWeight: 700 }, children: ["\u2713 Saved at ", savedAt.toLocaleTimeString()] })] })] }), _jsx(Card, { title: "Connected Wallet", subtitle: "Wallet linked to this Fini account", children: _jsxs("div", { style: { display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "#f9fafb", borderRadius: 12 }, children: [_jsx("span", { style: { fontSize: 20 }, children: "\uD83D\uDC5B" }), _jsxs("div", { style: { flex: 1 }, children: [_jsx("div", { style: { fontSize: 13, fontFamily: "monospace", fontWeight: 700, color: "#111" }, children: walletAddress }), _jsxs("div", { style: { fontSize: 11, color: "#888", marginTop: 2 }, children: ["Ethereum mainnet \u00B7 ", MOCK_STATS.finisOwned, " Finis owned"] })] }), _jsx("span", { style: { fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 100, background: "#dcfce7", color: "#15803d" }, children: "\u2713 Connected" })] }) }), _jsx(Card, { title: "Notifications", subtitle: "Choose when we ping you", children: _jsx("div", { style: { display: "flex", flexDirection: "column", gap: 10 }, children: [
                                        { label: "Battle wins", default: true },
                                        { label: "Daily Fini Coin grant", default: true },
                                        { label: "Tournament invites", default: false },
                                        { label: "Newsletter", default: false },
                                    ].map(opt => (_jsxs("label", { style: { display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#333", fontWeight: 600, cursor: "pointer" }, children: [_jsx("input", { type: "checkbox", defaultChecked: opt.default, style: { accentColor: "#f472b6", width: 16, height: 16 } }), opt.label] }, opt.label))) }) })] }), _jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 20 }, children: [_jsxs(Card, { title: "\uD83E\uDE99 FINI$", subtitle: "Your in-game currency balance", children: [_jsxs("div", { style: { background: "linear-gradient(135deg, #fef3c7, #fde047)", borderRadius: 14, padding: "18px 20px", marginBottom: 14 }, children: [_jsx("div", { style: { fontSize: 11, fontWeight: 700, color: "#854d0e", textTransform: "uppercase", letterSpacing: "0.06em" }, children: "Current Balance" }), _jsxs("div", { style: { fontSize: 32, fontWeight: 900, color: "#111" }, children: [MOCK_STATS.finiCoinBalance.toLocaleString(), " ", _jsx("span", { style: { fontSize: 18, color: "#854d0e" }, children: "FINI$" })] })] }), _jsxs("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }, children: [_jsx(Stat, { label: "Won", value: `${MOCK_STATS.finiCoinWon.toLocaleString()}`, sub: "FINI$ from battles", color: "#16a34a" }), _jsx(Stat, { label: "Spent", value: `${MOCK_STATS.finiCoinSpent.toLocaleString()}`, sub: "FINI$ on predictions", color: "#dc2626" })] })] }), _jsxs(Card, { title: "\u2694\uFE0F Battle Record", subtitle: "Your win/loss tally", children: [_jsxs("div", { style: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 12 }, children: [_jsx(Stat, { label: "Played", value: String(MOCK_STATS.battlesPlayed), sub: "battles" }), _jsx(Stat, { label: "Won", value: String(MOCK_STATS.battlesWon), sub: "victories", color: "#16a34a" }), _jsx(Stat, { label: "Lost", value: String(MOCK_STATS.battlesLost), sub: "defeats", color: "#dc2626" })] }), _jsxs("div", { style: { background: "#f9fafb", borderRadius: 12, padding: "12px 14px" }, children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 13, color: "#666", marginBottom: 6 }, children: [_jsx("span", { children: "Win rate" }), _jsxs("span", { style: { fontWeight: 800, color: "#111" }, children: [winRatePct, "%"] })] }), _jsx("div", { style: { height: 8, borderRadius: 100, background: "#e5e7eb", overflow: "hidden" }, children: _jsx("div", { style: { height: "100%", width: `${winRatePct}%`, background: "linear-gradient(90deg, #22c55e, #16a34a)" } }) }), _jsxs("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 12, color: "#888", marginTop: 8 }, children: [_jsx("span", { children: "Best streak" }), _jsxs("span", { style: { fontWeight: 700, color: "#333" }, children: [MOCK_STATS.bestStreak, " wins"] })] })] })] }), _jsxs(Card, { title: "\uD83C\uDFC5 Ranking", subtitle: "Where you stand", children: [_jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }, children: [_jsxs("div", { children: [_jsxs("div", { style: { fontSize: 32, fontWeight: 900, color: "#111", lineHeight: 1 }, children: ["#", MOCK_STATS.ranking] }), _jsxs("div", { style: { fontSize: 12, color: "#888", marginTop: 2 }, children: ["of ", MOCK_STATS.totalPlayers.toLocaleString(), " players"] })] }), _jsx(Link, { to: "/leaderboard", style: { fontSize: 13, fontWeight: 700, color: "#f472b6", textDecoration: "none" }, children: "View leaderboard \u2192" })] }), _jsx("div", { style: { height: 6, borderRadius: 100, background: "#e5e7eb", overflow: "hidden" }, children: _jsx("div", { style: { height: "100%", width: `${(1 - MOCK_STATS.ranking / MOCK_STATS.totalPlayers) * 100}%`, background: "linear-gradient(90deg, #f472b6, #ec4899)" } }) }), _jsxs("div", { style: { fontSize: 11, color: "#bbb", marginTop: 6 }, children: ["Top ", Math.ceil((MOCK_STATS.ranking / MOCK_STATS.totalPlayers) * 100), "%"] })] }), _jsx(Card, { title: "Quick Links", subtitle: "", children: _jsxs("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }, children: [_jsx(QuickLink, { to: "/account", icon: "\uD83D\uDC3E", label: "My Stable" }), _jsx(QuickLink, { to: "/claim", icon: "\uD83E\uDE99", label: "Claim FINI$" }), _jsx(QuickLink, { to: "/crypto", icon: "\u2694\uFE0F", label: "Crypto Arena" }), _jsx(QuickLink, { to: "/", icon: "\uD83C\uDFE0", label: "Home" })] }) })] })] })] }));
}
const inputStyle = {
    width: "100%", padding: "10px 14px", borderRadius: 10,
    border: "1.5px solid #e5e7eb", fontSize: 14, color: "#111",
    outline: "none", background: "#fff", boxSizing: "border-box",
};
function Field({ label, children }) {
    return (_jsxs("div", { children: [_jsx("div", { style: { fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }, children: label }), children] }));
}
function Card({ title, subtitle, children }) {
    return (_jsxs("div", { style: { background: "#fff", borderRadius: 20, border: "1.5px solid #f0f0f0", padding: "22px 24px" }, children: [_jsxs("div", { style: { marginBottom: 16 }, children: [_jsx("div", { style: { fontSize: 15, fontWeight: 800, color: "#111" }, children: title }), subtitle && _jsx("div", { style: { fontSize: 12, color: "#aaa", marginTop: 2 }, children: subtitle })] }), children] }));
}
function Stat({ label, value, sub, color }) {
    return (_jsxs("div", { style: { background: "#f9fafb", borderRadius: 12, padding: "10px 12px", textAlign: "center" }, children: [_jsx("div", { style: { fontSize: 10, color: "#aaa", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }, children: label }), _jsx("div", { style: { fontSize: 18, fontWeight: 900, color: color ?? "#111", marginTop: 2 }, children: value }), _jsx("div", { style: { fontSize: 10, color: "#888" }, children: sub })] }));
}
function QuickLink({ to, icon, label }) {
    return (_jsxs(Link, { to: to, style: {
            display: "flex", alignItems: "center", gap: 8, padding: "10px 12px",
            borderRadius: 12, background: "#f9fafb", color: "#111",
            textDecoration: "none", fontSize: 13, fontWeight: 700,
            border: "1.5px solid transparent", transition: "all 0.12s",
        }, children: [_jsx("span", { style: { fontSize: 18 }, children: icon }), label] }));
}
