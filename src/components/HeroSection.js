import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef } from "react";
import { useUIStore } from "../state/uiStore";
import { useGameStore } from "../state/gameStore";
import { ConnectWalletButton } from "./ConnectWalletButton";
export function HeroSection() {
    const { walletAddress, walletDropdownOpen, setWalletDropdown, disconnectWallet, openTournament, openLeaderboard, openStable } = useUIStore();
    const startRanked = useGameStore((s) => s.startRankedLadder);
    const dropdownRef = useRef(null);
    // Close dropdown on outside click
    useEffect(() => {
        function handler(e) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setWalletDropdown(false);
            }
        }
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [setWalletDropdown]);
    const shortAddress = walletAddress
        ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`
        : null;
    return (_jsxs("div", { style: { fontFamily: "'Nunito', system-ui, sans-serif" }, children: [_jsxs("nav", { style: {
                    background: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "0 48px", height: 64,
                    borderBottom: "1px solid #f0f0f0",
                    position: "sticky", top: 0, zIndex: 100,
                }, children: [_jsxs("span", { style: { fontSize: 26, fontWeight: 900, letterSpacing: "-1px", lineHeight: 1 }, children: [_jsx("span", { style: { color: "#4aaee8" }, children: "F" }), _jsx("span", { style: { color: "#f472b6" }, children: "i" }), _jsx("span", { style: { color: "#fbbf24" }, children: "n" }), _jsx("span", { style: { color: "#f97316" }, children: "i" })] }), _jsxs("div", { style: { display: "flex", alignItems: "center", gap: 32, fontSize: 15, fontWeight: 600, color: "#111" }, children: [_jsxs("button", { onClick: startRanked, style: { display: "flex", alignItems: "center", gap: 6, color: "#111", background: "none", border: "none", cursor: "pointer", fontSize: 15, fontWeight: 600, padding: 0 }, onMouseEnter: e => (e.currentTarget.style.opacity = "0.7"), onMouseLeave: e => (e.currentTarget.style.opacity = "1"), children: [_jsx("span", { style: { width: 8, height: 8, borderRadius: "50%", background: "#60a5fa", flexShrink: 0 } }), "Fight Club"] }), _jsxs("button", { onClick: openTournament, style: { display: "flex", alignItems: "center", gap: 6, color: "#111", background: "none", border: "none", cursor: "pointer", fontSize: 15, fontWeight: 600, padding: 0 }, onMouseEnter: e => (e.currentTarget.style.opacity = "0.7"), onMouseLeave: e => (e.currentTarget.style.opacity = "1"), children: [_jsx("span", { style: { width: 8, height: 8, borderRadius: "50%", background: "#4ade80", flexShrink: 0 } }), "Tournament"] }), _jsxs("button", { onClick: openLeaderboard, style: { display: "flex", alignItems: "center", gap: 6, color: "#111", background: "none", border: "none", cursor: "pointer", fontSize: 15, fontWeight: 600, padding: 0 }, onMouseEnter: e => (e.currentTarget.style.opacity = "0.7"), onMouseLeave: e => (e.currentTarget.style.opacity = "1"), children: [_jsx("span", { style: { width: 8, height: 8, borderRadius: "50%", background: "#f97316", flexShrink: 0 } }), "Leaderboard"] })] }), _jsx("div", { style: { position: "relative" }, ref: dropdownRef, children: walletAddress ? (_jsxs(_Fragment, { children: [_jsxs("button", { onClick: () => setWalletDropdown(!walletDropdownOpen), style: {
                                        background: "#fce8f3", color: "#111",
                                        border: "1.5px solid #f472b6", borderRadius: 100,
                                        padding: "9px 18px", fontSize: 14, fontWeight: 700,
                                        cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
                                    }, children: [shortAddress, _jsx("svg", { width: "12", height: "12", viewBox: "0 0 12 12", fill: "none", children: _jsx("path", { d: "M2 4l4 4 4-4", stroke: "#f472b6", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round" }) })] }), walletDropdownOpen && (_jsx("div", { style: {
                                        position: "absolute", top: "calc(100% + 8px)", right: 0,
                                        background: "#fff", border: "1.5px solid #f0e0ea",
                                        borderRadius: 16, boxShadow: "0 8px 32px rgba(0,0,0,0.10)",
                                        minWidth: 200, overflow: "hidden", zIndex: 200,
                                    }, children: [
                                        { icon: "👤", label: "Profile", action: () => { setWalletDropdown(false); } },
                                        { icon: "🐾", label: "My Stable", action: () => { openStable(); setWalletDropdown(false); } },
                                        { icon: "→", label: "Logout", action: () => { disconnectWallet(); } },
                                    ].map(({ icon, label, action }) => (_jsxs("button", { onClick: action, style: {
                                            width: "100%", textAlign: "left", background: "none", border: "none",
                                            padding: "13px 20px", fontSize: 14, fontWeight: 600, color: "#111",
                                            cursor: "pointer", display: "flex", alignItems: "center", gap: 12,
                                            borderBottom: label !== "Logout" ? "1px solid #f5eaf0" : "none",
                                        }, onMouseEnter: e => (e.currentTarget.style.background = "#fdf0f7"), onMouseLeave: e => (e.currentTarget.style.background = "none"), children: [_jsx("span", { style: { fontSize: 16 }, children: icon }), label] }, label))) }))] })) : (_jsx(ConnectWalletButton, { style: {
                                background: "#f472b6", color: "#fff",
                                border: "none", borderRadius: 100,
                                padding: "10px 22px", fontSize: 14, fontWeight: 700,
                                cursor: "pointer",
                            } })) })] }), _jsx("section", { style: {
                    background: "#c7f6fb",
                    minHeight: "calc(100vh - 64px)",
                    display: "flex", alignItems: "center",
                    padding: "0 48px",
                    overflow: "hidden",
                    position: "relative",
                }, children: _jsxs("div", { style: {
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 40,
                        width: "100%",
                        maxWidth: 1200,
                        margin: "0 auto",
                        alignItems: "center",
                    }, children: [_jsxs("div", { style: { paddingBottom: 40 }, children: [_jsxs("h1", { style: {
                                        fontSize: "clamp(40px, 5.5vw, 76px)",
                                        fontWeight: 900, color: "#0a0a0a",
                                        lineHeight: 1.08, letterSpacing: "-2px", margin: 0,
                                    }, children: ["Digital cuties for", " ", _jsxs("span", { style: { position: "relative", display: "inline-block", whiteSpace: "nowrap" }, children: [_jsx("span", { style: { position: "relative", zIndex: 1 }, children: "everything that" }), _jsx("svg", { "aria-hidden": true, style: { position: "absolute", top: "-18%", left: "-4%", width: "108%", height: "136%", pointerEvents: "none" }, viewBox: "0 0 340 80", preserveAspectRatio: "none", children: _jsx("ellipse", { cx: "170", cy: "40", rx: "165", ry: "36", fill: "none", stroke: "#60a5fa", strokeWidth: "5", strokeLinecap: "round" }) })] }), " ", "matters"] }), _jsx("p", { style: { marginTop: 28, fontSize: 17, color: "#444", lineHeight: 1.6, maxWidth: 420, fontWeight: 500 }, children: "Finis are digital beings that embody the emotional ties between people and the world around them." }), _jsxs("div", { style: { display: "flex", gap: 12, marginTop: 36 }, children: [_jsx("button", { style: { background: "#0a0a0a", color: "#fff", border: "none", borderRadius: 100, padding: "14px 28px", fontSize: 15, fontWeight: 700, cursor: "pointer" }, children: "Get your Fini" }), _jsx("button", { style: { background: "transparent", color: "#0a0a0a", border: "2px solid #0a0a0a", borderRadius: 100, padding: "14px 28px", fontSize: 15, fontWeight: 700, cursor: "pointer" }, children: "View collection" })] })] }), _jsxs("div", { style: { position: "relative", display: "flex", alignItems: "flex-end", justifyContent: "center", minHeight: 480 }, children: [_jsx("video", { autoPlay: true, loop: true, muted: true, playsInline: true, style: { position: "absolute", top: "12%", left: "4%", height: "28%", width: "auto", objectFit: "contain", opacity: 0.9 }, children: _jsx("source", { src: "/hero/skull.mp4", type: "video/mp4" }) }), _jsx("video", { autoPlay: true, loop: true, muted: true, playsInline: true, style: { height: "88%", maxHeight: 480, width: "auto", objectFit: "contain", position: "relative", zIndex: 1, marginRight: "5%" }, children: _jsx("source", { src: "/hero/sunflower.mp4", type: "video/mp4" }) })] })] }) }), _jsx("section", { style: {
                    position: "relative",
                    minHeight: "100vh",
                    background: "#fce8e8",
                    overflow: "hidden",
                    display: "flex", alignItems: "center",
                }, children: _jsxs("div", { style: {
                        position: "relative", zIndex: 1,
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        width: "100%",
                        maxWidth: 1200,
                        margin: "0 auto",
                        padding: "0 48px",
                        alignItems: "center",
                        minHeight: "100vh",
                    }, children: [_jsxs("div", { children: [_jsxs("h2", { style: {
                                        fontSize: "clamp(40px, 5vw, 68px)",
                                        fontWeight: 900, color: "#0a0a0a",
                                        lineHeight: 1.1, letterSpacing: "-2px", margin: 0,
                                    }, children: ["Fini", " ", _jsxs("span", { style: { position: "relative", display: "inline-block", whiteSpace: "nowrap" }, children: [_jsx("span", { style: { position: "relative", zIndex: 1 }, children: "fight club" }), _jsx("svg", { "aria-hidden": true, style: { position: "absolute", top: "-22%", left: "-6%", width: "112%", height: "148%", pointerEvents: "none" }, viewBox: "0 0 300 80", preserveAspectRatio: "none", children: _jsx("ellipse", { cx: "150", cy: "40", rx: "144", ry: "34", fill: "none", stroke: "#60a5fa", strokeWidth: "5", strokeLinecap: "round" }) })] })] }), _jsx("p", { style: { marginTop: 16, fontSize: 16, color: "#555", fontWeight: 600 }, children: "Build teams, battle, win rewards" })] }), _jsx("div", { style: { position: "relative", minHeight: 500 }, children: _jsx("img", { src: "/hero/fight_club.png", alt: "Fini fight club characters", style: {
                                    width: "110%", maxWidth: 680,
                                    objectFit: "contain",
                                    position: "absolute", bottom: 0, right: "-60px",
                                } }) })] }) })] }));
}
