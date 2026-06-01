import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { getBattleById, ASSET_META } from "../data/mockBattles";
import { useUIStore } from "../state/uiStore";
import { ResolutionAuditPanel } from "../components/ResolutionAuditPanel";
import { MOCK_INSTANCES } from "../data/mockBattleInstances";
import { useCoinStore, fmtCoin } from "../state/coinStore";
import { useMyEntries } from "../state/myEntriesStore";
import { api } from "../lib/api";
import { useConnectModal } from "@rainbow-me/rainbowkit";
const S = { fontFamily: "'Nunito', system-ui, sans-serif" };
const ASSET_COLORS = {
    BTC: "#f7931a", ETH: "#627eea", SOL: "#9945ff", DOGE: "#c3a634",
    LINK: "#2a5ada", UNI: "#ff007a", AVAX: "#e84142", BNB: "#f3ba2f",
    MATIC: "#8247e5", XTZ: "#a6e000",
};
const DUMMY_LOG = [
    { time: "14:32:01", msg: "BTC opens at $97,240. Battle begins." },
    { time: "14:33:14", msg: "Early momentum: Up side gains +2% probability." },
    { time: "14:34:55", msg: "Large position entered — 12,000 Fini Coin on Up." },
    { time: "14:36:02", msg: "BTC dips to $97,100. Down side recovers to 49%." },
    { time: "14:37:41", msg: "Volume crosses 80K Fini Coin. Arena intensity: High." },
];
export function BattlePage() {
    const { battleId = "" } = useParams();
    const battle = getBattleById(battleId);
    const { walletAddress } = useUIStore();
    const [stake, setStake] = useState("100");
    const [selectedSide, setSelectedSide] = useState(null);
    const [predicting, setPredicting] = useState(false);
    const [predictResult, setPredictResult] = useState(null);
    const { openConnectModal } = useConnectModal();
    async function placePrediction() {
        if (!selectedSide || !battle)
            return;
        setPredicting(true);
        setPredictResult(null);
        const amount = Math.round(Number(stake));
        const lockedPct = selectedSide === "A" ? battle.sideA.pct : battle.sideB.pct;
        const idemKey = `predict:${battle.id}:${selectedSide}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
        // Local-first: if the player can afford it, deduct FINI$ optimistically and
        // show the success state. If the backend is wired up, server settlement
        // will reconcile when the battle resolves. If offline (dev mode), this is
        // the authoritative path.
        const balance = useCoinStore.getState().balance;
        if (balance < amount) {
            setPredictResult({ ok: false, error: "Not enough FINI$ to place this prediction." });
            setPredicting(false);
            return;
        }
        useCoinStore.getState().spend(amount);
        // Helper: parse "15m"/"1h"/"2h" → ms (kept local to avoid a new util import)
        const parseDur = (label) => {
            if (!label)
                return battle.endsInMs;
            const m = /^(\d+)(m|h)$/.exec(label.trim());
            if (!m)
                return battle.endsInMs;
            const n = Number(m[1]);
            return m[2] === "h" ? n * 3_600_000 : n * 60_000;
        };
        // Persist the entry locally so My Active Battles shows up on /crypto + survives reload.
        const persistEntry = (side, stake) => {
            useMyEntries.getState().add({
                battleId: battle.id,
                battleTitle: battle.title,
                side,
                sideLabel: side === "A" ? battle.sideA.label : battle.sideB.label,
                stake,
                endsAt: Date.now() + battle.endsInMs,
                durationMs: parseDur(battle.durationLabel),
            });
        };
        try {
            const r = await api.predictPlace({
                battleId: battle.id, side: selectedSide, stake: amount, lockedPct, idempotencyKey: idemKey,
            });
            setPredictResult({ ok: true, side: r.side, stake: r.stake });
            persistEntry(r.side, r.stake);
            const wallet = useUIStore.getState().walletAddress;
            if (wallet)
                useCoinStore.getState().refresh(wallet);
        }
        catch (e) {
            // Backend not deployed — that's fine in dev mode. The local FINI$ debit
            // above already happened; treat this as a successful local prediction.
            const msg = e instanceof Error ? e.message : "predict_failed";
            if (msg.includes("offline") || msg.includes("Failed to fetch") || msg.includes("backend") || msg.includes("network")) {
                setPredictResult({ ok: true, side: selectedSide, stake: amount });
                persistEntry(selectedSide, amount);
            }
            else {
                // Real error (insufficient funds server-side, battle closed, etc.) —
                // refund the optimistic debit and show the message.
                useCoinStore.getState().earn(amount);
                const friendly = msg.includes("insufficient_funds") ? "Not enough FINI$ — claim more or earn from battles."
                    : msg.includes("battle_closed") ? "This battle is no longer accepting entries."
                        : msg.includes("past_entry_cutoff") ? "Entry window closed."
                            : msg;
                setPredictResult({ ok: false, error: friendly });
            }
        }
        finally {
            setPredicting(false);
        }
    }
    if (!battle) {
        return (_jsxs("div", { style: { ...S, padding: "80px 48px", textAlign: "center" }, children: [_jsx("h2", { children: "Battle not found" }), _jsx(Link, { to: "/crypto", children: "\u2190 Back to arena" })] }));
    }
    const { sideA, sideB } = battle;
    const primaryAsset = battle.assets[0];
    const color = ASSET_COLORS[primaryAsset] ?? "#f472b6";
    const meta = ASSET_META[primaryAsset];
    const endsInMin = Math.floor(battle.endsInMs / 60000);
    const fee = Math.round(Number(stake) * 0.07 * (sideA.pct / 100) * (sideB.pct / 100));
    function fmtTime(ms) {
        if (ms <= 0)
            return "Ended";
        const m = Math.floor(ms / 60000);
        if (m < 60)
            return `${m}m`;
        const h = Math.floor(m / 60);
        return `${h}h ${m % 60}m`;
    }
    return (_jsxs("div", { style: { ...S, background: "#f8f9fa", minHeight: "100vh" }, children: [_jsx("div", { style: { background: "#fff", borderBottom: "1px solid #f0f0f0", padding: "12px 48px" }, children: _jsxs("div", { style: { maxWidth: 1200, margin: "0 auto", display: "flex", gap: 8, fontSize: 13, color: "#888", fontWeight: 600 }, children: [_jsx(Link, { to: "/crypto", style: { color: "#888", textDecoration: "none" }, children: "Crypto Arena" }), _jsx("span", { children: "/" }), meta && _jsx(Link, { to: `/crypto/${primaryAsset.toLowerCase()}`, style: { color: "#888", textDecoration: "none" }, children: meta.name }), _jsx("span", { children: "/" }), _jsx("span", { style: { color: "#111" }, children: battle.title })] }) }), _jsx("div", { style: { maxWidth: 1200, margin: "0 auto", padding: "32px 48px" }, children: _jsxs("div", { style: { display: "grid", gridTemplateColumns: "1fr 380px", gap: 32, alignItems: "start" }, children: [_jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 20 }, children: [_jsxs("div", { style: { background: "#fff", borderRadius: 20, padding: "28px", border: "1.5px solid #f0f0f0" }, children: [_jsxs("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }, children: [battle.assets.map(a => (_jsx("span", { style: { fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 100, background: ASSET_COLORS[a] + "20", color: ASSET_COLORS[a] }, children: a }, a))), _jsx(StatusPill, { status: battle.status }), _jsxs("span", { style: { marginLeft: "auto", fontSize: 13, fontWeight: 700, color: "#888" }, children: ["\u23F1 ", fmtTime(battle.endsInMs)] })] }), _jsx("h1", { style: { fontSize: 24, fontWeight: 900, color: "#111", margin: "0 0 8px" }, children: battle.title }), _jsx("p", { style: { fontSize: 16, color: "#555", fontWeight: 600, margin: 0, lineHeight: 1.5 }, children: battle.question })] }), _jsx(BattleArenaHero, { battle: battle, sideALabel: sideA.label, sideBLabel: sideB.label, sideAPct: sideA.pct, sideBPct: sideB.pct, color: color, userBet: predictResult && predictResult.ok ? predictResult : null }), _jsxs("div", { style: { background: "#fff", borderRadius: 20, padding: "24px", border: "1.5px solid #f0f0f0" }, children: [_jsx("div", { style: { fontSize: 12, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }, children: "Battle Momentum" }), _jsxs("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 20, fontWeight: 900, marginBottom: 10 }, children: [_jsxs("span", { style: { color: "#16a34a" }, children: [sideA.label, " ", sideA.pct, "%"] }), _jsxs("span", { style: { color: "#dc2626" }, children: [sideB.label, " ", sideB.pct, "%"] })] }), _jsx("div", { style: { height: 12, borderRadius: 100, background: "#f3f4f6", overflow: "hidden", marginBottom: 16 }, children: _jsx("div", { style: { height: "100%", width: `${sideA.pct}%`, background: "linear-gradient(90deg, #22c55e, #16a34a)", borderRadius: 100 } }) }), _jsxs("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginTop: 8 }, children: [_jsx(StatBox, { label: "Volume", value: `${battle.volumeK}K`, sub: "Fini Coin" }), _jsx(StatBox, { label: "Time Left", value: fmtTime(battle.endsInMs), sub: `ends in ${endsInMin}m` }), _jsx(StatBox, { label: "Arena Mood", value: battle.volumeK > 100 ? "Volatile" : "Calm", sub: "intensity" })] })] }), _jsxs("div", { style: { background: "#fff", borderRadius: 20, padding: "24px", border: "1.5px solid #f0f0f0" }, children: [_jsx("div", { style: { fontSize: 12, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }, children: "Battle Log" }), _jsx("div", { style: { display: "flex", flexDirection: "column", gap: 10 }, children: DUMMY_LOG.map((entry, i) => (_jsxs("div", { style: { display: "flex", gap: 12, fontSize: 13 }, children: [_jsx("span", { style: { fontFamily: "monospace", color: "#aaa", flexShrink: 0 }, children: entry.time }), _jsx("span", { style: { color: "#333", fontWeight: 600 }, children: entry.msg })] }, i))) })] }), _jsxs("div", { style: { background: "#fff", borderRadius: 20, padding: "24px", border: "1.5px solid #f0f0f0" }, children: [_jsx("div", { style: { fontSize: 12, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }, children: "Battle Rules" }), _jsxs("div", { style: { fontSize: 13, color: "#555", lineHeight: 1.7, fontWeight: 500 }, children: ["Resolution source: CoinGecko API (primary) + Coinbase and Binance (backup), server-side only.", _jsx("br", {}), "Entry cutoff: 30 seconds before battle end. No late entries accepted.", _jsx("br", {}), "Prices, winners, and payouts are determined server-side. The client cannot submit any of these values.", _jsx("br", {}), "If primary and backup prices deviate by more than 50bps, the battle is held for manual review.", _jsx("br", {}), "If no price can be verified, the battle is voided and all entries are returned in full."] })] }), (() => {
                                    const instance = MOCK_INSTANCES[battle.id];
                                    if (!instance)
                                        return null;
                                    return (_jsx("div", { style: { background: "#fff", borderRadius: 20, padding: "24px", border: "1.5px solid #f0f0f0" }, children: _jsx(ResolutionAuditPanel, { instance: instance }) }));
                                })()] }), _jsx("div", { style: { position: "sticky", top: 80 }, children: _jsxs("div", { style: { background: "#fff", borderRadius: 20, padding: "24px", border: "1.5px solid #f0f0f0", display: "flex", flexDirection: "column", gap: 16 }, children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [_jsx("div", { style: { fontSize: 16, fontWeight: 800, color: "#111" }, children: "Place your prediction" }), _jsx(BalanceDisplay, {})] }), _jsxs("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }, children: [_jsx(SideBtn, { label: sideA.label, pct: sideA.pct, side: "A", selected: selectedSide === "A", color: "#16a34a", bg: "#dcfce7", onSelect: () => setSelectedSide("A") }), _jsx(SideBtn, { label: sideB.label, pct: sideB.pct, side: "B", selected: selectedSide === "B", color: "#dc2626", bg: "#fee2e2", onSelect: () => setSelectedSide("B") })] }), _jsxs("div", { children: [_jsx("div", { style: { fontSize: 12, fontWeight: 700, color: "#aaa", marginBottom: 8 }, children: "FINI$ amount" }), _jsx("div", { style: { display: "flex", gap: 6 }, children: ["50", "100", "250", "500"].map(v => (_jsx("button", { onClick: () => setStake(v), style: {
                                                        flex: 1, padding: "8px 0", borderRadius: 10, border: "none", cursor: "pointer",
                                                        fontSize: 12, fontWeight: 700,
                                                        background: stake === v ? "#111" : "#f3f4f6",
                                                        color: stake === v ? "#fff" : "#666",
                                                    }, children: v }, v))) }), _jsx("input", { type: "number", value: stake, onChange: e => setStake(e.target.value), style: {
                                                    width: "100%", marginTop: 8, padding: "10px 14px", borderRadius: 12,
                                                    border: "1.5px solid #e5e7eb", fontSize: 14, fontWeight: 600, color: "#111",
                                                    boxSizing: "border-box",
                                                } })] }), _jsxs("div", { style: { background: "#f9fafb", borderRadius: 12, padding: "12px 14px", fontSize: 12, display: "flex", flexDirection: "column", gap: 4 }, children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", color: "#666" }, children: [_jsx("span", { children: "Stake" }), _jsxs("span", { style: { fontWeight: 700 }, children: [stake, " FINI$"] })] }), _jsxs("div", { style: { display: "flex", justifyContent: "space-between", color: "#666" }, children: [_jsx("span", { children: "Arena fee (7%)" }), _jsxs("span", { style: { fontWeight: 700 }, children: ["~", fee, " FINI$"] })] }), _jsx("div", { style: { height: 1, background: "#e5e7eb", margin: "4px 0" } }), _jsxs("div", { style: { display: "flex", justifyContent: "space-between", fontWeight: 800, color: "#111" }, children: [_jsx("span", { children: "Max winnings" }), _jsxs("span", { children: [selectedSide ? Math.round(Number(stake) * (selectedSide === "A" ? 100 / sideA.pct : 100 / sideB.pct)) : "—", " FINI$"] })] })] }), walletAddress ? (() => {
                                        // Once an entry is placed on this battle, lock the page —
                                        // you can't double-up or change your pick on the same outcome.
                                        const locked = !!predictResult?.ok;
                                        if (locked && predictResult?.ok) {
                                            return (_jsxs("div", { children: [_jsxs("button", { disabled: true, style: {
                                                            width: "100%", padding: "14px 0", borderRadius: 100,
                                                            border: "2px solid #16a34a",
                                                            fontSize: 15, fontWeight: 800,
                                                            cursor: "not-allowed",
                                                            background: "#dcfce7", color: "#15803d",
                                                            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                                                        }, children: [_jsx("span", { style: { fontSize: 18 }, children: "\uD83D\uDD12" }), "Entry locked \u2014 ", predictResult.stake, " FINI$ on ", predictResult.side === "A" ? sideA.label : sideB.label] }), _jsx("div", { style: { marginTop: 10, padding: "10px 14px", borderRadius: 10, background: "#fff", border: "1.5px solid #f0f0f0", fontSize: 12, color: "#666", fontWeight: 600, lineHeight: 1.5, textAlign: "center" }, children: "Entry placed. The outcome settles when the battle's resolution timer hits zero \u2014 sit tight." }), _jsx(Link, { to: "/crypto", style: {
                                                            display: "block", marginTop: 10, padding: "10px 14px", borderRadius: 100,
                                                            border: "1.5px solid #e5e7eb", background: "#fff",
                                                            color: "#666", fontWeight: 700, fontSize: 13,
                                                            textAlign: "center", textDecoration: "none",
                                                        }, children: "\u2190 Find another battle" })] }));
                                        }
                                        return (_jsxs(_Fragment, { children: [_jsx("button", { onClick: placePrediction, disabled: !selectedSide || predicting, style: {
                                                        width: "100%", padding: "14px 0", borderRadius: 100, border: "none",
                                                        fontSize: 15, fontWeight: 800,
                                                        cursor: (!selectedSide || predicting) ? "not-allowed" : "pointer",
                                                        background: (!selectedSide || predicting) ? "#e5e7eb" : "#f472b6",
                                                        color: (!selectedSide || predicting) ? "#aaa" : "#fff",
                                                        transition: "all 0.15s",
                                                    }, children: predicting ? "Placing prediction…"
                                                        : selectedSide ? `Predict ${selectedSide === "A" ? sideA.label : sideB.label} →`
                                                            : "Select a side" }), predictResult && !predictResult.ok && (_jsx("div", { style: { marginTop: 10, padding: "10px 14px", borderRadius: 10, background: "#fee2e2", border: "1.5px solid #fca5a5", fontSize: 12, color: "#dc2626", fontWeight: 700 }, children: predictResult.error }))] }));
                                    })() : (_jsxs("div", { style: { textAlign: "center" }, children: [_jsx("div", { style: { fontSize: 13, color: "#888", marginBottom: 10, fontWeight: 600 }, children: "Connect wallet to predict" }), _jsx("button", { onClick: () => openConnectModal?.(), style: {
                                                    width: "100%", padding: "14px 0", borderRadius: 100, border: "none",
                                                    fontSize: 15, fontWeight: 800, cursor: "pointer",
                                                    background: "#f472b6", color: "#fff",
                                                }, children: "Connect Wallet" })] })), _jsx("div", { style: { fontSize: 11, color: "#bbb", textAlign: "center", lineHeight: 1.5 }, children: "Fini Coin is a non-transferable in-game currency. No real-world value." })] }) })] }) })] }));
}
function StatusPill({ status }) {
    const styles = {
        live: { bg: "#dcfce7", color: "#15803d", label: "🟢 Live" },
        upcoming: { bg: "#dbeafe", color: "#1d4ed8", label: "🔵 Upcoming" },
        resolving: { bg: "#f3e8ff", color: "#7c3aed", label: "🟣 Resolving" },
        resolved: { bg: "#f3f4f6", color: "#6b7280", label: "⚫ Resolved" },
    };
    const s = styles[status] ?? styles.resolved;
    return _jsx("span", { style: { fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 100, background: s.bg, color: s.color }, children: s.label });
}
function StatBox({ label, value, sub }) {
    return (_jsxs("div", { style: { textAlign: "center", padding: "12px", borderRadius: 12, background: "#f9fafb" }, children: [_jsx("div", { style: { fontSize: 10, color: "#aaa", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }, children: label }), _jsx("div", { style: { fontSize: 18, fontWeight: 900, color: "#111" }, children: value }), _jsx("div", { style: { fontSize: 10, color: "#aaa", fontWeight: 600 }, children: sub })] }));
}
function SideBtn({ label, pct, selected, color, bg, onSelect }) {
    return (_jsxs("button", { onClick: onSelect, style: {
            padding: "12px 8px", borderRadius: 12, border: selected ? `2px solid ${color}` : "2px solid transparent",
            background: selected ? bg : "#f9fafb", cursor: "pointer", transition: "all 0.12s",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
        }, children: [_jsxs("span", { style: { fontSize: 18, fontWeight: 900, color: selected ? color : "#555" }, children: [pct, "%"] }), _jsx("span", { style: { fontSize: 12, fontWeight: 700, color: selected ? color : "#888" }, children: label })] }));
}
function BalanceDisplay() {
    const balance = useCoinStore(s => s.balance);
    return (_jsxs("div", { style: {
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "5px 11px", borderRadius: 100,
            background: "linear-gradient(135deg, #fef3c7, #fde68a)",
            border: "1.5px solid #fbbf24",
            color: "#854d0e", fontWeight: 800, fontSize: 12,
        }, children: [_jsx("span", { style: { fontSize: 13 }, children: "\uD83E\uDE99" }), _jsx("span", { children: fmtCoin(balance, { compact: true }) }), _jsx("span", { style: { fontSize: 10, opacity: 0.75 }, children: "FINI$" })] }));
}
/**
 * Hero battle arena — two Finis facing off with a time-remaining progress bar.
 * Expands to a large dramatic scene when the user has placed a prediction.
 *
 * The placeholder image lives at /public/battle-placeholder.png — Ed dropped
 * the reference there. (Two cute Finis sketched facing each other.)
 */
function BattleArenaHero({ battle, sideALabel, sideBLabel, sideAPct, sideBPct, color, userBet, }) {
    // Parse the *total* battle duration from its label ("15m", "1h", "2h", "24h").
    // `battle.endsInMs` is only the time REMAINING, so we can't use it alone to
    // compute elapsed%.
    function parseDurationLabel(label) {
        if (!label)
            return battle.endsInMs;
        const m = /^(\d+)(m|h)$/.exec(label.trim());
        if (!m)
            return battle.endsInMs;
        const n = Number(m[1]);
        return m[2] === "h" ? n * 60 * 60 * 1000 : n * 60 * 1000;
    }
    const totalDuration = parseDurationLabel(battle.durationLabel);
    const initialEndsAt = useState(() => Date.now() + battle.endsInMs)[0];
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 500);
        return () => clearInterval(t);
    }, []);
    const remaining = Math.max(0, initialEndsAt - now);
    // Elapsed = total - remaining. Clamped to 0..100%.
    const elapsedPct = totalDuration > 0
        ? Math.min(100, Math.max(0, ((totalDuration - remaining) / totalDuration) * 100))
        : 0;
    function fmt(ms) {
        if (ms <= 0)
            return "Resolving…";
        const s = Math.floor(ms / 1000);
        const m = Math.floor(s / 60);
        const h = Math.floor(m / 60);
        if (h > 0)
            return `${h}h ${m % 60}m`;
        if (m > 0)
            return `${m}m ${s % 60}s`;
        return `${s}s`;
    }
    const placed = !!userBet;
    // After prediction: bigger, more dramatic. Before: compact intro.
    const minH = placed ? 480 : 260;
    return (_jsxs("div", { style: {
            position: "relative",
            background: `linear-gradient(135deg, ${color}10, ${color}03)`,
            borderRadius: 24,
            border: `1.5px solid ${color}30`,
            overflow: "hidden",
            minHeight: minH,
            transition: "min-height 0.4s ease",
        }, children: [_jsx("img", { src: "/battle-placeholder.png", alt: "", onError: e => { e.currentTarget.style.display = "none"; }, style: {
                    position: "absolute", inset: 0, width: "100%", height: "100%",
                    objectFit: "contain", objectPosition: "center 60%",
                    opacity: placed ? 1 : 0.55,
                    transition: "opacity 0.4s ease",
                    pointerEvents: "none",
                } }), _jsxs("div", { style: {
                    position: "absolute", top: 0, left: 0, right: 0,
                    display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                    padding: "20px 28px", zIndex: 2,
                }, children: [_jsxs("div", { style: { textAlign: "left", background: "rgba(255,255,255,0.85)", backdropFilter: "blur(8px)", padding: "10px 16px", borderRadius: 14, border: userBet?.side === "A" ? "2.5px solid #16a34a" : "1px solid #e5e7eb" }, children: [_jsx("div", { style: { fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 0.5 }, children: battle.familyA ?? "Side A" }), _jsxs("div", { style: { fontSize: 26, fontWeight: 900, color: "#16a34a" }, children: [sideAPct, "%"] }), _jsx("div", { style: { fontSize: 13, fontWeight: 800, color: "#16a34a" }, children: sideALabel }), userBet?.side === "A" && _jsx("div", { style: { fontSize: 10, fontWeight: 800, color: "#16a34a", marginTop: 3 }, children: "\u2605 YOUR PICK" })] }), _jsxs("div", { style: { textAlign: "right", background: "rgba(255,255,255,0.85)", backdropFilter: "blur(8px)", padding: "10px 16px", borderRadius: 14, border: userBet?.side === "B" ? "2.5px solid #dc2626" : "1px solid #e5e7eb" }, children: [_jsx("div", { style: { fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 0.5 }, children: battle.familyB ?? "Side B" }), _jsxs("div", { style: { fontSize: 26, fontWeight: 900, color: "#dc2626" }, children: [sideBPct, "%"] }), _jsx("div", { style: { fontSize: 13, fontWeight: 800, color: "#dc2626" }, children: sideBLabel }), userBet?.side === "B" && _jsx("div", { style: { fontSize: 10, fontWeight: 800, color: "#dc2626", marginTop: 3 }, children: "\u2605 YOUR PICK" })] })] }), _jsxs("div", { style: {
                    position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 2,
                    background: "rgba(255,255,255,0.92)", backdropFilter: "blur(10px)",
                    padding: "18px 28px", borderTop: "1.5px solid #f0f0f0",
                }, children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontSize: 10, fontWeight: 800, color: "#888", textTransform: "uppercase", letterSpacing: 0.5 }, children: "Resolution in" }), _jsx("div", { style: { fontSize: 20, fontWeight: 900, color: "#111", fontFamily: "monospace", fontVariantNumeric: "tabular-nums" }, children: fmt(remaining) })] }), _jsxs("div", { style: { textAlign: "right" }, children: [_jsx("div", { style: { fontSize: 10, fontWeight: 800, color: "#888", textTransform: "uppercase", letterSpacing: 0.5 }, children: "Status" }), _jsx("div", { style: { fontSize: 13, fontWeight: 800, color: remaining > 0 ? "#16a34a" : "#a855f7" }, children: remaining > 0 ? "● Battle in progress" : "⚖️ Awaiting price oracle" })] })] }), _jsx("div", { style: { height: 8, borderRadius: 100, background: "#f3f4f6", overflow: "hidden", position: "relative" }, children: _jsx("div", { style: {
                                height: "100%", width: `${elapsedPct}%`,
                                background: `linear-gradient(90deg, ${color}, ${color}dd)`,
                                borderRadius: 100,
                                transition: "width 0.5s ease",
                            } }) }), placed && userBet && (_jsxs("div", { style: { marginTop: 10, fontSize: 12, color: "#666", fontWeight: 600 }, children: ["You staked ", _jsxs("b", { style: { color: "#111" }, children: [userBet.stake, " FINI$"] }), " on ", _jsx("b", { style: { color: userBet.side === "A" ? "#16a34a" : "#dc2626" }, children: userBet.side === "A" ? sideALabel : sideBLabel }), ". Sit tight \u2014 payout settles when the timer hits zero."] }))] })] }));
}
