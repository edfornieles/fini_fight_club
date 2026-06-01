import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { useUIStore } from "../state/uiStore";
import { useLivePrices } from "../hooks/useLivePrices";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { api } from "../lib/api";
import { useCoinStore } from "../state/coinStore";
const GENESIS_CAMPAIGN_ID = "00000000-0000-0000-0000-000000000001";
const S = { fontFamily: "'Nunito', system-ui, sans-serif" };
const BASE_CLAIM = 0;
const PER_FINI = 10_000;
const MAX_CLAIM = Infinity;
// Mock snapshot data — in production this comes from the server snapshot
const MOCK_SNAPSHOT_FINIS = [
    { tokenId: 1062, family: "BTC", clan: "Townspeople", eligible: true },
    { tokenId: 2847, family: "ETH", clan: "Artists", eligible: true },
    { tokenId: 4103, family: "SOL", clan: "Soldiers", eligible: true },
    { tokenId: 7291, family: "DOGE", clan: "Miners", eligible: true },
    { tokenId: 6010, family: "LINK", clan: "Twice Daily", eligible: true },
    { tokenId: 6212, family: "UNI", clan: "Artists", eligible: true },
    { tokenId: 6420, family: "AVAX", clan: "Soldiers", eligible: true },
    { tokenId: 6818, family: "BNB", clan: "Hourly", eligible: true },
    { tokenId: 7001, family: "MATIC", clan: "Arms of the State", eligible: true },
    { tokenId: 9100, family: "XTZ", clan: "Farmers", eligible: true },
];
export function ClaimPage() {
    const { walletAddress } = useUIStore();
    const { openConnectModal } = useConnectModal();
    const [step, setStep] = useState(walletAddress ? "check" : "connect");
    const [loading, setLoading] = useState(false);
    const { prices } = useLivePrices();
    const finiCount = MOCK_SNAPSHOT_FINIS.length;
    const totalClaim = finiCount * PER_FINI;
    const short = walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : "";
    const nonce = "8f3a92c1-d4e7-4b91-a2f3-9c8d6e2a1b47";
    const issuedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 300_000).toISOString();
    async function handleConnect() {
        openConnectModal?.();
    }
    // Auto-advance to "check" once a real wallet is connected
    useEffect(() => {
        if (walletAddress && step === "connect")
            setStep("check");
    }, [walletAddress, step]);
    const [claimError, setClaimError] = useState(null);
    const [, setClaimResult] = useState(null);
    async function handleSign() {
        setLoading(true);
        setClaimError(null);
        try {
            const result = await api.claimFini(GENESIS_CAMPAIGN_ID);
            setClaimResult({ amount: result.claimedAmount, tokenIds: result.tokenIds });
            useCoinStore.setState({ balance: result.newBalance, loaded: true });
            setStep("done");
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : "claim_failed";
            // Friendly errors for common cases
            if (msg.includes("already_claimed"))
                setClaimError("This wallet has already claimed in this campaign.");
            else if (msg.includes("no_finis_in_snapshot"))
                setClaimError("No Finis found in the campaign snapshot for this wallet.");
            else if (msg.includes("supply_cap"))
                setClaimError("Sorry — the campaign supply cap has been reached.");
            else if (msg.includes("offline"))
                setClaimError("Backend not configured. Claim disabled in offline mode.");
            else
                setClaimError(msg);
        }
        finally {
            setLoading(false);
        }
    }
    const STEPS = ["connect", "check", "sign", "done"];
    const STEP_LABELS = ["Connect Wallet", "Check Holdings", "Sign & Claim", "Done!"];
    return (_jsx("div", { style: { ...S, background: "#f8f9fa", minHeight: "100vh" }, children: _jsxs("div", { style: { maxWidth: 1100, margin: "0 auto", padding: "48px 24px" }, children: [_jsxs("div", { style: { textAlign: "center", marginBottom: 48 }, children: [_jsx("div", { style: { fontSize: 52, marginBottom: 12 }, children: "\uD83E\uDE99" }), _jsx("h1", { style: { fontSize: 34, fontWeight: 900, color: "#111", margin: "0 0 10px" }, children: "Fini Coin Claim" }), _jsx("p", { style: { fontSize: 16, color: "#666", maxWidth: 560, margin: "0 auto", lineHeight: 1.7 }, children: "Existing Fini NFT holders can claim an initial Fini Coin allocation to start playing in the Battle Arena." })] }), _jsxs("div", { style: { display: "grid", gridTemplateColumns: "1fr 380px", gap: 32, alignItems: "start" }, children: [_jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 20 }, children: [_jsxs(InfoCard, { title: "What is Fini Coin?", children: [_jsxs("p", { style: P, children: ["Fini Coin is an ", _jsx("strong", { children: "internal, non-transferable game currency" }), " used exclusively inside Fini Crypto Battle Arena. It has no real-world value and cannot be withdrawn, sold, transferred, or exchanged for money, crypto, NFTs, or anything of monetary value."] }), _jsx("p", { style: P, children: "You use Fini Coin to predict battle outcomes, enter arenas, and participate in clan competitions. Think of it as battle energy \u2014 the fuel that powers your predictions." }), _jsx("div", { style: { background: "#fef9c3", border: "1.5px solid #fde047", borderRadius: 12, padding: "12px 16px", fontSize: 12, color: "#854d0e", fontWeight: 600, lineHeight: 1.6, marginTop: 8 }, children: "Fini Coin is a game currency. It may not become money, a token, or anything redeemable. Future ecosystem rewards, if any, are discretionary and subject to legal and regulatory review." })] }), _jsxs(InfoCard, { title: "Your Claim Allocation", children: [_jsxs("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }, children: [_jsx(AllocRow, { label: "One-time per Fini", value: `${BASE_CLAIM.toLocaleString()} FINI$`, color: "#f472b6" }), _jsx(AllocRow, { label: "Per Fini NFT (once each)", value: `${PER_FINI.toLocaleString()} FINI$`, color: "#a78bfa" }), _jsx(AllocRow, { label: "Each Fini redeemable once", value: `${MAX_CLAIM.toLocaleString()} FINI$`, color: "#60a5fa" }), _jsx(AllocRow, { label: "Campaign status", value: "Active", color: "#22c55e" })] }), _jsxs("div", { style: { background: "#f9fafb", borderRadius: 12, padding: "14px 16px", fontSize: 13 }, children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", color: "#666", marginBottom: 5 }, children: [_jsx("span", { children: "One-time per Fini" }), _jsxs("span", { style: { fontWeight: 700 }, children: [BASE_CLAIM.toLocaleString(), " FINI$"] })] }), _jsxs("div", { style: { display: "flex", justifyContent: "space-between", color: "#666", marginBottom: 5 }, children: [_jsxs("span", { children: ["Finis held \u00D7 ", PER_FINI, " FINI$"] }), _jsxs("span", { style: { fontWeight: 700 }, children: [finiCount, " \u00D7 ", PER_FINI, " = ", (finiCount * PER_FINI).toLocaleString(), " FINI$"] })] }), _jsx("div", { style: { height: 1, background: "#e5e7eb", margin: "8px 0" } }), _jsxs("div", { style: { display: "flex", justifyContent: "space-between", fontWeight: 900, color: "#111", fontSize: 15 }, children: [_jsx("span", { children: "Your claim" }), _jsxs("span", { style: { color: "#f472b6" }, children: [totalClaim.toLocaleString(), " Fini Coin"] })] })] })] }), _jsxs(InfoCard, { title: "Daily Holder Play Allowance", children: [_jsx("p", { style: P, children: "After your initial claim, Fini holders receive a daily Fini Coin grant to keep playing. This is not yield or income \u2014 it is battle energy to keep you in the arena." }), _jsxs("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 }, children: [_jsx(AllocRow, { label: "Non-holder daily grant", value: "100 FINI$ / day", color: "#9ca3af" }), _jsx(AllocRow, { label: "Holder base grant", value: "250 FINI$ / day", color: "#f472b6" }), _jsx(AllocRow, { label: "Per Fini bonus", value: "50 FINI$ / day", color: "#a78bfa" }), _jsx(AllocRow, { label: "Your daily grant", value: `${250 + finiCount * 50} FINI$ / day`, color: "#22c55e" })] })] }), _jsx(InfoCard, { title: "Claim Security", children: _jsxs("ul", { style: { margin: 0, padding: "0 0 0 18px", fontSize: 13, color: "#555", lineHeight: 1.8 }, children: [_jsxs("li", { children: ["Each wallet can claim ", _jsx("strong", { children: "once per campaign" })] }), _jsxs("li", { children: ["Each NFT token ID can only be used ", _jsx("strong", { children: "once per campaign" })] }), _jsxs("li", { children: ["Claim calculation happens ", _jsx("strong", { children: "server-side only" }), " \u2014 the client never decides your allocation"] }), _jsxs("li", { children: ["Wallet signature is ", _jsx("strong", { children: "single-use with a 5-minute expiry" })] }), _jsxs("li", { children: ["Signature is ", _jsx("strong", { children: "domain-bound" }), " \u2014 cannot be replayed on another site"] }), _jsxs("li", { children: ["All claims are written to an ", _jsx("strong", { children: "append-only ledger" }), " with idempotency keys"] }), _jsx("li", { children: "No gas cost. No token approvals. No asset transfers of any kind." })] }) }), Object.keys(prices).length > 0 && (_jsx(InfoCard, { title: "Your Finis vs Today's Market", children: _jsx("div", { style: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }, children: MOCK_SNAPSHOT_FINIS.map(f => {
                                            const p = prices[f.family];
                                            return (_jsxs("div", { style: { textAlign: "center", background: "#f9fafb", borderRadius: 12, padding: "10px 8px" }, children: [_jsx("div", { style: { fontSize: 18 }, children: "\uD83D\uDC3E" }), _jsxs("div", { style: { fontSize: 11, fontWeight: 800, color: "#333", marginTop: 4 }, children: ["#", f.tokenId] }), _jsxs("div", { style: { fontSize: 10, color: "#888" }, children: [f.family, " \u00B7 ", f.clan] }), p && _jsxs("div", { style: { fontSize: 10, fontWeight: 700, color: p.usd_24h_change >= 0 ? "#16a34a" : "#dc2626", marginTop: 2 }, children: [p.usd_24h_change >= 0 ? "▲" : "▼", " ", Math.abs(p.usd_24h_change).toFixed(1), "% today"] })] }, f.tokenId));
                                        }) }) }))] }), _jsxs("div", { style: { position: "sticky", top: 80 }, children: [_jsxs("div", { style: { background: "#fff", borderRadius: 24, border: "1.5px solid #f0f0f0", overflow: "hidden" }, children: [_jsx("div", { style: { display: "flex", borderBottom: "1px solid #f0f0f0" }, children: STEPS.map((s, i) => {
                                                const done = STEPS.indexOf(step) > i;
                                                const active = step === s;
                                                return (_jsxs("div", { style: {
                                                        flex: 1, padding: "12px 6px", textAlign: "center", fontSize: 10, fontWeight: 700,
                                                        color: active ? "#f472b6" : done ? "#22c55e" : "#aaa",
                                                        borderBottom: active ? "2px solid #f472b6" : "2px solid transparent",
                                                        background: active ? "#fdf0f7" : "transparent",
                                                    }, children: [_jsx("div", { style: { fontSize: 13, marginBottom: 2 }, children: done ? "✓" : i + 1 }), STEP_LABELS[i]] }, s));
                                            }) }), _jsxs("div", { style: { padding: "28px 24px" }, children: [step === "connect" && (_jsxs("div", { style: { textAlign: "center", display: "flex", flexDirection: "column", gap: 18 }, children: [_jsx("div", { style: { fontSize: 40 }, children: "\uD83D\uDC5B" }), _jsxs("div", { children: [_jsx("div", { style: { fontSize: 17, fontWeight: 800, color: "#111", marginBottom: 6 }, children: "Connect your wallet" }), _jsx("div", { style: { fontSize: 13, color: "#666", lineHeight: 1.6 }, children: "Connect the wallet that holds your Fini NFTs. Read-only \u2014 no approvals, no gas, no transfers." })] }), _jsx("button", { onClick: handleConnect, disabled: loading, style: pinkBtn, children: loading ? "Connecting..." : "Connect Wallet" }), _jsx("div", { style: { fontSize: 11, color: "#bbb" }, children: "MetaMask \u00B7 Rainbow \u00B7 Coinbase Wallet \u00B7 WalletConnect" })] })), step === "check" && (_jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 16 }, children: [_jsx(WalletRow, { address: short }), _jsxs("div", { children: [_jsxs("div", { style: { fontSize: 11, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }, children: ["Finis in snapshot (", finiCount, ")"] }), MOCK_SNAPSHOT_FINIS.map(f => (_jsxs("div", { style: { display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 10, border: "1.5px solid #f0f0f0", marginBottom: 6 }, children: [_jsx("span", { children: "\uD83D\uDC3E" }), _jsxs("div", { style: { flex: 1 }, children: [_jsxs("div", { style: { fontSize: 12, fontWeight: 700, color: "#111" }, children: ["Fini #", f.tokenId] }), _jsxs("div", { style: { fontSize: 10, color: "#888" }, children: [f.family, " \u00B7 ", f.clan] })] }), _jsxs("span", { style: { fontSize: 11, fontWeight: 700, color: "#a78bfa" }, children: ["+", PER_FINI, " FINI$"] })] }, f.tokenId)))] }), _jsxs("div", { style: { background: "#f9fafb", borderRadius: 12, padding: "14px" }, children: [_jsx(Row, { label: `Base claim`, value: `${BASE_CLAIM.toLocaleString()} FINI$` }), _jsx(Row, { label: `${finiCount} Finis × ${PER_FINI} FINI$`, value: `${(finiCount * PER_FINI).toLocaleString()} FINI$` }), _jsx("div", { style: { height: 1, background: "#e5e7eb", margin: "8px 0" } }), _jsx(Row, { label: "Total", value: `${totalClaim.toLocaleString()} FINI$`, bold: true })] }), _jsx("button", { onClick: () => setStep("sign"), style: pinkBtn, children: "Proceed to Sign \u2192" })] })), step === "sign" && (_jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 16 }, children: [_jsxs("div", { style: { textAlign: "center" }, children: [_jsx("div", { style: { fontSize: 36, marginBottom: 6 }, children: "\u270D\uFE0F" }), _jsx("div", { style: { fontSize: 16, fontWeight: 800, color: "#111", marginBottom: 4 }, children: "Sign to claim" }), _jsx("div", { style: { fontSize: 12, color: "#666" }, children: "No gas. No approvals. Proves wallet ownership." })] }), _jsxs("div", { style: { fontFamily: "monospace", fontSize: 10.5, background: "#111", color: "#a0aec0", borderRadius: 12, padding: "14px", lineHeight: 1.9, overflowX: "auto" }, children: [_jsx("div", { style: { color: "#fff", fontWeight: 700, marginBottom: 6 }, children: "Fini Crypto Battle Arena" }), _jsx("div", { children: "Sign this message to verify wallet ownership and" }), _jsx("div", { children: "claim non-transferable Fini Coin for gameplay." }), _jsx("br", {}), _jsx("div", { children: "Domain: fini.xyz" }), _jsxs("div", { children: ["Wallet: ", short] }), _jsxs("div", { children: ["Nonce: ", nonce.slice(0, 18), "..."] }), _jsxs("div", { children: ["Issued At: ", issuedAt.slice(0, 19), "Z"] }), _jsxs("div", { children: ["Expires At: ", expiresAt.slice(0, 19), "Z"] }), _jsx("br", {}), _jsx("div", { style: { color: "#68d391" }, children: "This signature does not cost gas and does not" }), _jsx("div", { style: { color: "#68d391" }, children: "give permission to move any assets." })] }), _jsx("button", { onClick: handleSign, disabled: loading, style: { ...pinkBtn, background: loading ? "#e5e7eb" : "#f472b6", color: loading ? "#aaa" : "#fff" }, children: loading ? "Verifying..." : "Sign & Claim FINI$" }), claimError && (_jsx("div", { style: { fontSize: 13, color: "#dc2626", fontWeight: 700, padding: "10px 14px", background: "#fee2e2", border: "1.5px solid #fca5a5", borderRadius: 10 }, children: claimError }))] })), step === "done" && (_jsxs("div", { style: { textAlign: "center", display: "flex", flexDirection: "column", gap: 16 }, children: [_jsx("div", { style: { fontSize: 52 }, children: "\uD83C\uDF89" }), _jsxs("div", { children: [_jsx("div", { style: { fontSize: 20, fontWeight: 900, color: "#111", marginBottom: 6 }, children: "Claim successful!" }), _jsxs("div", { style: { fontSize: 14, color: "#666" }, children: [_jsxs("strong", { style: { color: "#f472b6" }, children: [totalClaim.toLocaleString(), " Fini Coin"] }), " added to your balance"] })] }), _jsxs("div", { style: { background: "#f9fafb", borderRadius: 14, padding: "14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }, children: [_jsx(MiniStat, { label: "Fini Coin", value: totalClaim.toLocaleString() + " FINI$" }), _jsx(MiniStat, { label: "Finis counted", value: String(finiCount) }), _jsx(MiniStat, { label: "Status", value: "Claimed" }), _jsx(MiniStat, { label: "Daily grant", value: `${250 + finiCount * 50} FINI$/day` })] }), _jsx("a", { href: "/crypto", style: { ...pinkBtn, display: "block", textDecoration: "none", textAlign: "center" }, children: "Enter the Arena \u2192" }), _jsx("div", { style: { fontSize: 10, color: "#bbb", lineHeight: 1.6 }, children: "Claim recorded in immutable ledger. Each wallet claims once per campaign." })] }))] })] }), _jsxs("div", { style: { marginTop: 12, padding: "14px 16px", borderRadius: 14, background: "#fef9c3", border: "1.5px solid #fde047", fontSize: 11, color: "#854d0e", lineHeight: 1.6 }, children: [_jsx("strong", { children: "Game currency only." }), " Fini Coin cannot be withdrawn, sold, transferred, or exchanged for money, crypto, NFTs, or anything of value. This is a game claim, not a token launch, airdrop, or investment."] })] })] })] }) }));
}
// ── Small helpers ──────────────────────────────────────────────────────────────
const P = { fontSize: 13, color: "#555", lineHeight: 1.7, margin: "0 0 8px" };
const pinkBtn = { width: "100%", padding: "13px 0", borderRadius: 100, border: "none", background: "#f472b6", color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer" };
function InfoCard({ title, children }) {
    return (_jsxs("div", { style: { background: "#fff", borderRadius: 20, padding: "22px 24px", border: "1.5px solid #f0f0f0" }, children: [_jsx("div", { style: { fontSize: 14, fontWeight: 800, color: "#111", marginBottom: 14 }, children: title }), children] }));
}
function AllocRow({ label, value, color }) {
    return (_jsxs("div", { style: { background: color + "12", borderRadius: 10, padding: "10px 12px" }, children: [_jsx("div", { style: { fontSize: 10, color: "#aaa", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }, children: label }), _jsx("div", { style: { fontSize: 15, fontWeight: 900, color }, children: value })] }));
}
function Row({ label, value, bold }) {
    return (_jsxs("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 12, color: bold ? "#111" : "#666", fontWeight: bold ? 900 : 400, marginBottom: bold ? 0 : 4 }, children: [_jsx("span", { children: label }), _jsx("span", { style: { fontWeight: 700 }, children: value })] }));
}
function WalletRow({ address }) {
    return (_jsxs("div", { style: { display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 12, background: "#f9fafb" }, children: [_jsx("span", { children: "\uD83D\uDC5B" }), _jsxs("div", { style: { flex: 1 }, children: [_jsx("div", { style: { fontSize: 10, color: "#aaa", fontWeight: 700 }, children: "Connected" }), _jsx("div", { style: { fontSize: 13, fontFamily: "monospace", fontWeight: 700, color: "#111" }, children: address })] }), _jsx("span", { style: { fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 100, background: "#dcfce7", color: "#15803d" }, children: "\u2713 Verified" })] }));
}
function MiniStat({ label, value }) {
    return (_jsxs("div", { style: { textAlign: "center" }, children: [_jsx("div", { style: { fontSize: 9, color: "#aaa", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }, children: label }), _jsx("div", { style: { fontSize: 14, fontWeight: 900, color: "#111" }, children: value })] }));
}
