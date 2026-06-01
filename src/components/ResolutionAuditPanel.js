import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
const SOURCE_LABELS = {
    coingecko_v3: "CoinGecko v3 API",
    coinbase_spot: "Coinbase Advanced Trade",
    binance_spot: "Binance Spot API",
    kraken_spot: "Kraken REST API",
    manual_admin: "Manual admin entry",
};
const STATUS_CONFIG = {
    resolved: { bg: "#dcfce7", color: "#15803d", icon: "✓", label: "Resolved" },
    manual_review: { bg: "#fef9c3", color: "#854d0e", icon: "⚠", label: "Manual Review" },
    voided: { bg: "#fee2e2", color: "#dc2626", icon: "✕", label: "Voided — Entries Returned" },
    resolving: { bg: "#dbeafe", color: "#1d4ed8", icon: "⟳", label: "Resolving" },
    locked: { bg: "#f3e8ff", color: "#7c3aed", icon: "🔒", label: "Locked" },
    open: { bg: "#f3f4f6", color: "#6b7280", icon: "○", label: "Open" },
    pending: { bg: "#f3f4f6", color: "#6b7280", icon: "○", label: "Pending" },
};
export function ResolutionAuditPanel({ instance }) {
    const status = STATUS_CONFIG[instance.resolutionStatus] ?? STATUS_CONFIG.pending;
    return (_jsxs("div", { style: { fontFamily: "'Nunito', system-ui, sans-serif", display: "flex", flexDirection: "column", gap: 16 }, children: [_jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between" }, children: [_jsx("div", { style: { fontSize: 14, fontWeight: 800, color: "#111" }, children: "Resolution Audit" }), _jsxs("span", { style: {
                            fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 100,
                            background: status.bg, color: status.color,
                        }, children: [status.icon, " ", status.label] })] }), instance.resolutionStatus === "voided" && instance.voidReason && (_jsxs(Notice, { color: "#fee2e2", border: "#fca5a5", textColor: "#7f1d1d", children: [_jsx("strong", { children: "Why this battle was voided:" }), " ", instance.voidReason] })), instance.resolutionStatus === "manual_review" && (_jsxs(Notice, { color: "#fef9c3", border: "#fde047", textColor: "#713f12", children: [_jsx("strong", { children: "Pending admin review." }), " All entries are held. No payouts will occur until an admin resolves this battle. You will see the outcome here when it is decided."] })), _jsx(Notice, { color: "#f0f9ff", border: "#bae6fd", textColor: "#075985", children: "All prices, winners, and payouts are determined server-side. The client cannot submit prices or influence resolution. Entries accepted before the cutoff cannot be changed." }), _jsxs("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }, children: [_jsx(SnapshotCard, { label: "Official Start Price", price: instance.officialStartPrice, source: instance.officialStartPriceSource, timestamp: instance.officialStartTimestamp, backups: instance.startBackupPriceChecks, deviation: instance.startDeviationReport }), _jsx(SnapshotCard, { label: "Official End Price", price: instance.officialEndPrice, source: instance.officialEndPriceSource, timestamp: instance.officialEndTimestamp, backups: instance.endBackupPriceChecks, deviation: instance.endDeviationReport, failed: instance.resolutionStatus !== "resolved" && instance.officialEndPrice === null })] }), _jsx(Section, { label: "Resolution Formula", children: _jsx("div", { style: { fontSize: 13, color: "#555", lineHeight: 1.6, fontWeight: 500, fontFamily: "monospace", background: "#f9fafb", padding: "10px 14px", borderRadius: 10 }, children: instance.resolutionFormula }) }), instance.resolutionStatus === "resolved" && (_jsxs(Section, { label: "Calculation Applied", children: [_jsx("div", { style: { fontSize: 13, fontWeight: 700, color: "#111", background: "#f0fdf4", border: "1.5px solid #bbf7d0", borderRadius: 10, padding: "10px 14px" }, children: instance.resolutionCalculation }), _jsxs("div", { style: { marginTop: 8, display: "flex", gap: 8 }, children: [_jsx(WinnerChip, { label: instance.winningSide === "A" ? instance.sideALabel : instance.sideBLabel, won: true }), _jsx(WinnerChip, { label: instance.winningSide === "A" ? instance.sideBLabel : instance.sideALabel, won: false })] })] })), _jsx(Section, { label: "Full Audit Log", children: _jsx("div", { style: { display: "flex", flexDirection: "column", gap: 0, borderLeft: "2px solid #e5e7eb", paddingLeft: 16 }, children: instance.resolutionAuditLog.map((entry, i) => (_jsxs("div", { style: { paddingBottom: 14, position: "relative" }, children: [_jsx("div", { style: {
                                    position: "absolute", left: -22, top: 3,
                                    width: 10, height: 10, borderRadius: "50%",
                                    background: entry.actor === "admin" ? "#f59e0b" : "#6366f1",
                                    border: "2px solid #fff",
                                } }), _jsxs("div", { style: { fontSize: 11, color: "#aaa", fontFamily: "monospace", marginBottom: 2 }, children: [new Date(entry.timestamp).toLocaleString("en-GB", { hour12: false }), " · ", _jsx("span", { style: { color: entry.actor === "admin" ? "#f59e0b" : "#6366f1", fontWeight: 700 }, children: entry.actor })] }), _jsx("div", { style: { fontSize: 13, fontWeight: 700, color: "#222" }, children: entry.event }), entry.detail && (_jsx("div", { style: { fontSize: 12, color: "#666", marginTop: 2, lineHeight: 1.5 }, children: entry.detail }))] }, i))) }) })] }));
}
function SnapshotCard({ label, price, source, timestamp, backups, deviation, failed }) {
    return (_jsxs("div", { style: {
            borderRadius: 14, border: `1.5px solid ${failed ? "#fca5a5" : "#e5e7eb"}`,
            background: failed ? "#fff5f5" : "#f9fafb", padding: "14px",
        }, children: [_jsx("div", { style: { fontSize: 10, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }, children: label }), price !== null ? (_jsxs(_Fragment, { children: [_jsxs("div", { style: { fontSize: 22, fontWeight: 900, color: "#111" }, children: ["$", price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })] }), _jsxs("div", { style: { fontSize: 11, color: "#888", marginTop: 4 }, children: [_jsx("div", { children: source ? SOURCE_LABELS[source] ?? source : "—" }), _jsx("div", { style: { fontFamily: "monospace" }, children: timestamp ? new Date(timestamp).toISOString() : "—" })] }), deviation && (_jsxs("div", { style: {
                            marginTop: 8, fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6,
                            background: deviation.withinThreshold ? "#dcfce7" : "#fee2e2",
                            color: deviation.withinThreshold ? "#15803d" : "#dc2626",
                            display: "inline-block",
                        }, children: [deviation.withinThreshold ? "✓" : "✕", " ", deviation.maxDeviationBps.toFixed(1), "bps deviation"] })), backups.length > 0 && (_jsxs("div", { style: { marginTop: 10, borderTop: "1px solid #e5e7eb", paddingTop: 8, display: "flex", flexDirection: "column", gap: 3 }, children: [_jsx("div", { style: { fontSize: 9, fontWeight: 700, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }, children: "Backup checks" }), backups.map(b => (_jsxs("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 11, color: "#666" }, children: [_jsx("span", { children: SOURCE_LABELS[b.source] ?? b.source }), _jsxs("span", { style: { fontWeight: 700, fontFamily: "monospace" }, children: ["$", b.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), _jsxs("span", { style: { color: "#bbb", fontWeight: 400 }, children: [" ", b.latencyMs, "ms"] })] })] }, b.source)))] }))] })) : (_jsxs("div", { style: { fontSize: 13, fontWeight: 700, color: failed ? "#dc2626" : "#aaa" }, children: [failed ? "⚠ Price integrity check failed — see audit log" : "Not yet recorded", backups.length > 0 && (_jsxs("div", { style: { marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }, children: [_jsx("div", { style: { fontSize: 9, fontWeight: 700, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.06em" }, children: "Attempted sources" }), backups.map(b => (_jsxs("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 11 }, children: [_jsx("span", { style: { color: "#666" }, children: SOURCE_LABELS[b.source] ?? b.source }), _jsxs("span", { style: { fontWeight: 700, fontFamily: "monospace", color: "#ef4444" }, children: ["$", b.price.toLocaleString(), " ", _jsxs("span", { style: { color: "#bbb", fontWeight: 400 }, children: [b.latencyMs, "ms"] })] })] }, b.source))), deviation && !deviation.withinThreshold && (_jsxs("div", { style: { fontSize: 11, fontWeight: 700, color: "#ef4444", background: "#fee2e2", padding: "4px 8px", borderRadius: 6, marginTop: 4 }, children: ["\u2715 ", deviation.maxDeviationBps.toFixed(1), "bps \u2014 exceeds 50bps limit"] }))] }))] }))] }));
}
function Section({ label, children }) {
    return (_jsxs("div", { children: [_jsx("div", { style: { fontSize: 10, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }, children: label }), children] }));
}
function Notice({ color, border, textColor, children }) {
    return (_jsx("div", { style: { background: color, border: `1.5px solid ${border}`, borderRadius: 12, padding: "12px 14px", fontSize: 12, color: textColor, lineHeight: 1.6 }, children: children }));
}
function WinnerChip({ label, won }) {
    return (_jsxs("span", { style: {
            fontSize: 12, fontWeight: 800, padding: "5px 14px", borderRadius: 100,
            background: won ? "#dcfce7" : "#f3f4f6",
            color: won ? "#15803d" : "#9ca3af",
        }, children: [won ? "🏆" : "✕", " ", label] }));
}
