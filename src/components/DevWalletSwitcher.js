import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Dev Wallet Switcher — paste any 0x… address (or pick a holder from the
 * ghost-team snapshot) to use the app as that wallet without going through
 * MetaMask / SIWE.
 *
 * Gating: visible when `?dev=1` is in the URL OR `localStorage.fini_dev === "1"`.
 * Toggling either persists across reloads (`?dev=1` writes the localStorage flag).
 *
 * What it bypasses:
 *   - RainbowKit / MetaMask connection
 *   - SIWE signature → Supabase session
 *
 * What it does NOT bypass:
 *   - Any code path that calls `supabase.auth.getSession()` and requires a real
 *     JWT (server-side debit/credit, real claims). In dev-impersonation mode
 *     those calls will fail and we fall back to local state — the UI still works
 *     for browsing, matchmaking, battling, and inspecting balances.
 */
import { useEffect, useState } from "react";
import { useUIStore } from "../state/uiStore";
import { useCoinStore } from "../state/coinStore";
const QUICK_PICKS = [
    // Top whales from public/data/ownership.json (verified via seed-ghost-teams)
    { label: "🐋 Whale #1", addr: "0x18ce6cd5c283dca2f50c8347420607a4e59716a6", note: "253 Finis" },
    { label: "🐋 Whale #2", addr: "0x6266dbb2d202d4e246ee86d76bb2fbb9a71eafcd", note: "251 Finis" },
    { label: "🐋 Whale #3", addr: "0x28d2d8d8780ff95d94689ce59f031cf829a41d40", note: "230 Finis" },
    { label: "📊 Mid", addr: "0x5377000000000000000000000000000000d7be00", note: "(custom mid sample)" },
];
function isDevModeEnabled() {
    if (typeof window === "undefined")
        return false;
    const params = new URLSearchParams(window.location.search);
    if (params.get("dev") === "1") {
        try {
            localStorage.setItem("fini_dev", "1");
        }
        catch { /* ignore */ }
        return true;
    }
    if (params.get("dev") === "0") {
        try {
            localStorage.removeItem("fini_dev");
        }
        catch { /* ignore */ }
        return false;
    }
    try {
        return localStorage.getItem("fini_dev") === "1";
    }
    catch {
        return false;
    }
}
export function DevWalletSwitcher() {
    const walletAddress = useUIStore(s => s.walletAddress);
    const [visible, setVisible] = useState(false);
    const [open, setOpen] = useState(false);
    const [input, setInput] = useState("");
    const [mid, setMid] = useState("");
    useEffect(() => {
        setVisible(isDevModeEnabled());
        // Listen for hash/path changes in case ?dev=1 is added mid-session
        const handler = () => setVisible(isDevModeEnabled());
        window.addEventListener("popstate", handler);
        return () => window.removeEventListener("popstate", handler);
    }, []);
    // Lazy-pick a mid-tier holder from the ghostTeams snapshot for the quick-pick.
    useEffect(() => {
        if (!visible || mid)
            return;
        fetch("/data/ghostTeams.json").then(r => r.ok ? r.json() : null).then(j => {
            if (!j?.teams)
                return;
            const midTier = j.teams.find((t) => t.ownedCount >= 5 && t.ownedCount <= 15);
            if (midTier)
                setMid(midTier.wallet);
        }).catch(() => { });
    }, [visible, mid]);
    if (!visible)
        return null;
    function impersonate(addr) {
        const a = addr.trim().toLowerCase();
        if (!/^0x[0-9a-f]{40}$/i.test(a)) {
            alert("Not a valid 0x address");
            return;
        }
        useUIStore.setState({ walletAddress: a });
        // Seed the SAP-style starting bank (1,000 FINI$). Same for everyone — your
        // task is to run it up without busting.
        if (useCoinStore.getState().balance < 100) {
            useCoinStore.getState().setBalance(1_000);
        }
        // Also seed starting Crumbs (30 🍪) for the in-battle economy.
        import("../state/crumbStore").then(({ useCrumbStore }) => {
            if (useCrumbStore.getState().crumbs > 30)
                useCrumbStore.getState().resetRun();
        });
        setOpen(false);
    }
    function disconnect() {
        useUIStore.setState({ walletAddress: null });
    }
    const short = walletAddress ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}` : "—";
    return (_jsx("div", { style: {
            position: "fixed", bottom: 12, right: 12, zIndex: 9999,
            fontFamily: "'Nunito', system-ui, sans-serif", fontSize: 13,
        }, children: open ? (_jsxs("div", { style: {
                background: "#111", color: "#fff", borderRadius: 12, padding: 14,
                width: 320, boxShadow: "0 12px 32px rgba(0,0,0,0.35)",
                border: "1px solid #333",
            }, children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }, children: [_jsx("strong", { style: { fontSize: 12, letterSpacing: 0.5, color: "#f472b6" }, children: "DEV \u00B7 IMPERSONATE" }), _jsx("button", { onClick: () => setOpen(false), style: btnX, children: "\u00D7" })] }), _jsxs("div", { style: { fontSize: 11, color: "#aaa", marginBottom: 6 }, children: ["Current: ", _jsx("span", { style: { color: "#fff", fontFamily: "monospace" }, children: short })] }), _jsx("input", { value: input, onChange: e => setInput(e.target.value), placeholder: "0x\u2026  (paste any address)", style: inputStyle, onKeyDown: e => { if (e.key === "Enter")
                        impersonate(input); } }), _jsx("button", { onClick: () => impersonate(input), style: btnPrimary, children: "Sign in as this address" }), _jsx("div", { style: { fontSize: 10, color: "#777", margin: "12px 0 6px", textTransform: "uppercase", letterSpacing: 0.5 }, children: "Quick picks" }), QUICK_PICKS.map(p => (_jsxs("button", { onClick: () => impersonate(p.addr), style: btnRow, children: [_jsx("span", { children: p.label }), _jsx("span", { style: { color: "#888", fontSize: 11 }, children: p.note })] }, p.addr))), mid && (_jsxs("button", { onClick: () => impersonate(mid), style: btnRow, children: [_jsx("span", { children: "\uD83D\uDCCA Mid holder (live)" }), _jsxs("span", { style: { color: "#888", fontSize: 11, fontFamily: "monospace" }, children: [mid.slice(0, 6), "\u2026", mid.slice(-4)] })] })), walletAddress && (_jsxs("button", { onClick: disconnect, style: { ...btnRow, marginTop: 8, color: "#f87171" }, children: [_jsx("span", { children: "\u21B6 Disconnect" }), _jsx("span", {})] })), _jsx("div", { style: { fontSize: 10, color: "#666", marginTop: 10, lineHeight: 1.4 }, children: "Bypasses MetaMask + SIWE. Server-side calls (claim, debit) will fail \u2014 local state still works." })] })) : (_jsxs("button", { onClick: () => setOpen(true), style: floatingPill, children: ["\u2699 DEV \u00B7 ", short] })) }));
}
const inputStyle = {
    width: "100%", padding: "8px 10px", borderRadius: 8, background: "#1c1c1c",
    border: "1px solid #333", color: "#fff", fontSize: 13, marginBottom: 8,
    boxSizing: "border-box", fontFamily: "monospace",
};
const btnPrimary = {
    width: "100%", padding: "8px 10px", borderRadius: 8, background: "#f472b6",
    color: "#fff", border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer",
};
const btnRow = {
    width: "100%", padding: "8px 10px", borderRadius: 8, background: "#1c1c1c",
    color: "#eee", border: "1px solid #2a2a2a", fontSize: 12, cursor: "pointer",
    display: "flex", justifyContent: "space-between", alignItems: "center",
    marginBottom: 4, textAlign: "left",
};
const btnX = {
    background: "transparent", color: "#888", border: "none", fontSize: 20,
    cursor: "pointer", padding: 0, lineHeight: 1,
};
const floatingPill = {
    background: "#111", color: "#fff", border: "1px solid #333",
    borderRadius: 999, padding: "8px 14px", fontSize: 12, cursor: "pointer",
    fontFamily: "monospace", boxShadow: "0 6px 16px rgba(0,0,0,0.25)",
};
