import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState, useRef } from "react";
import { ALL_COIN_FAMILIES } from "../game/types";
import { loadTaxonomy, familyView, } from "../game/taxonomy";
import { FAMILY_COLOR } from "./familyColors";
import CLAN_COLORS from "../clanColors.json";
// ─── Label maps ───────────────────────────────────────────────────────────────
const FAMILY_LABEL = {
    BTC: "Bitcoin", ETH: "Ethereum", SOL: "Solana", DOGE: "Dodge",
    LINK: "Chain link", UNI: "Uniswap", AVAX: "Avalanche",
    BNB: "Binance", MATIC: "Polygon", XTZ: "Tezos",
};
const PASSIVE_LABEL = {
    DIAMOND_BODY: "Diamond Body", COMPOUND: "Compound",
    HIGH_THROUGHPUT: "High Throughput", MEME_SPIKE: "Meme Spike",
    ORACLE: "Oracle", SWAP: "Swap", AVALANCHE: "Avalanche",
    FEE_BURN: "Fee Burn", SCALING: "Scaling", SELF_AMEND: "Self-Amend",
};
// ─── Asset helpers ────────────────────────────────────────────────────────────
function slugify(name) {
    return name.toLowerCase().replace(/'/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}
function clanGifUrl(clanName) { return `/clan-art/${slugify(clanName)}.gif`; }
function finiVideoUrl(clanSlug, tokenId) { return `/clan-finis/${clanSlug}/${tokenId}.mp4`; }
// ─── Card palette ─────────────────────────────────────────────────────────────
const SPECIALS_PALETTE = { bg: "#1a1a2e", text: "#ffd700" };
const MYTHICALS_PALETTE = { bg: "#0d1b2a", text: "#c0a0ff" };
/** Return { bg, text } for a clan — bg from extracted GIF pixel, text auto light/dark. */
function clanPalette(clanSlug, isSpecial, isMythical) {
    if (isSpecial)
        return SPECIALS_PALETTE;
    if (isMythical)
        return MYTHICALS_PALETTE;
    const bg = CLAN_COLORS[clanSlug] ?? "#e8e0d0";
    // Perceived brightness: if dark bg use light text, else dark text
    const hex = bg.replace("#", "");
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    const text = brightness < 128 ? "#f0e8d0" : "#2a1f10";
    return { bg, text };
}
const CLANS_PER_PAGE = 4;
const TIME_TABS = ["1D", "1H", "1W", "1M", "1Y"];
// ─── Main component ───────────────────────────────────────────────────────────
export function ExploreOverlay() {
    const [open, setOpen] = useState(false);
    const [dataset, setDataset] = useState(null);
    const [loaded, setLoaded] = useState(false);
    const [manifest, setManifest] = useState(null);
    const [selectedFamily, setSelectedFamily] = useState("BTC");
    const [selectedClanIdx, setSelectedClanIdx] = useState(0);
    const [page, setPage] = useState(0);
    const [finiIdx, setFiniIdx] = useState(0);
    const [timeTab, setTimeTab] = useState("1D");
    useEffect(() => {
        if (!open || loaded)
            return;
        Promise.all([
            loadTaxonomy(),
            fetch("/clan-finis/manifest.json").then(r => r.json()).catch(() => null),
        ]).then(([tax, man]) => {
            setDataset(tax);
            setManifest(man);
            setLoaded(true);
        });
    }, [open, loaded]);
    const handleFamily = (f) => {
        setSelectedFamily(f);
        setSelectedClanIdx(0);
        setPage(0);
        setFiniIdx(0);
    };
    const view = familyView(selectedFamily, dataset ?? null);
    // Build full clan list including virtual Specials / Mythicals
    const allClans = [
        ...view.clans,
        ...(view.specials && view.specials > 0
            ? [{ clan: "✦ Specials", count: view.specials, isSpecial: true }]
            : []),
        ...(view.mythicals && view.mythicals > 0
            ? [{ clan: "★ Mythicals", count: view.mythicals, isMythical: true }]
            : []),
    ];
    const totalPages = Math.ceil(allClans.length / CLANS_PER_PAGE);
    const paginated = allClans.slice(page * CLANS_PER_PAGE, (page + 1) * CLANS_PER_PAGE);
    const selectedClan = allClans[selectedClanIdx];
    const familyColor = FAMILY_COLOR[selectedFamily].hex;
    // Get manifest tokens for selected clan
    const isSpecialClan = selectedClan?.isSpecial;
    const isMythicalClan = selectedClan?.isMythical;
    const clanSlug = isSpecialClan || isMythicalClan ? "special" : selectedClan ? slugify(selectedClan.clan) : "";
    const tokens = manifest?.[clanSlug] ?? [];
    return (_jsxs(_Fragment, { children: [_jsx("button", { onClick: () => setOpen(true), className: "fixed bottom-[4.25rem] left-4 z-40 kbtn kbtn-grape px-4 py-2.5 text-sm shadow-puff", children: "\uD83D\uDD0D Explore" }), !open ? null : (_jsxs("div", { style: {
                    position: "fixed", inset: 0, zIndex: 50, background: "#fff",
                    fontFamily: "'Nunito', system-ui, sans-serif",
                    overflow: "hidden", display: "flex", flexDirection: "column",
                }, children: [_jsxs("header", { style: { padding: "36px 56px 20px", flexShrink: 0, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }, children: [_jsxs("div", { children: [_jsxs("h1", { style: { fontSize: 42, fontWeight: 800, color: "#111", lineHeight: 1.15, letterSpacing: "-0.5px", margin: 0 }, children: ["Track your favorite", " ", _jsxs("span", { style: { position: "relative", display: "inline-block" }, children: [_jsx("span", { style: { position: "relative", zIndex: 1 }, children: "coins" }), _jsx("svg", { "aria-hidden": true, style: { position: "absolute", top: "-10px", left: "-12px", width: "calc(100% + 24px)", height: "calc(100% + 20px)", pointerEvents: "none" }, viewBox: "0 0 130 50", preserveAspectRatio: "none", children: _jsx("ellipse", { cx: "65", cy: "25", rx: "62", ry: "22", fill: "none", stroke: "#f472b6", strokeWidth: "3.5", strokeLinecap: "round" }) })] })] }), _jsx("p", { style: { fontSize: 14, color: "#777", marginTop: 8 }, children: "Finis are emotionally connected to the performance of financial assets." })] }), _jsxs("div", { style: { display: "flex", alignItems: "center", gap: 16, fontSize: 14, paddingTop: 6 }, children: [_jsx("a", { href: "https://opensea.io/collection/finiliar", target: "_blank", rel: "noopener noreferrer", style: { color: "#f472b6", fontWeight: 700 }, children: "Get a Fini \u2192 View on Opensea" }), _jsx("button", { onClick: () => setOpen(false), style: { background: "none", border: "none", cursor: "pointer", color: "#aaa", fontSize: 20 }, children: "\u2715" })] })] }), _jsxs("div", { style: { flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, padding: "0 56px 32px", overflow: "hidden", minHeight: 0 }, children: [_jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 28, overflowY: "auto", minHeight: 0, paddingRight: 8 }, children: [_jsxs("section", { children: [_jsx("p", { style: { fontSize: 12, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }, children: "Select a Family" }), _jsx("div", { style: { display: "flex", flexWrap: "wrap", gap: 8 }, children: ALL_COIN_FAMILIES.map(f => {
                                                    const active = f === selectedFamily;
                                                    return (_jsxs("button", { onClick: () => handleFamily(f), style: {
                                                            display: "flex", alignItems: "center", gap: 8,
                                                            padding: "8px 16px", borderRadius: 100,
                                                            border: active ? "none" : "1.5px solid #e5e7eb",
                                                            background: active ? "#f472b6" : "#fff",
                                                            color: active ? "#fff" : "#222",
                                                            fontWeight: 600, fontSize: 14, cursor: "pointer",
                                                            boxShadow: active ? "none" : "0 1px 3px rgba(0,0,0,0.06)",
                                                            transition: "all 0.15s",
                                                        }, children: [_jsx("span", { style: { width: 22, height: 22, borderRadius: "50%", background: active ? "rgba(0,0,0,0.18)" : "#111", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: "#fff", flexShrink: 0 }, children: f.slice(0, 2) }), FAMILY_LABEL[f]] }, f));
                                                }) })] }), _jsxs("section", { style: { flex: 1 }, children: [_jsx("p", { style: { fontSize: 12, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }, children: "Select a Clan" }), !loaded ? _jsx("p", { style: { color: "#bbb", fontSize: 14 }, children: "Loading\u2026" }) : (_jsxs(_Fragment, { children: [_jsx("div", { style: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }, children: paginated.map((clan, i) => {
                                                            const absIdx = page * CLANS_PER_PAGE + i;
                                                            const active = absIdx === selectedClanIdx;
                                                            const vc = clan;
                                                            const cSlug = vc.isSpecial || vc.isMythical ? "special" : slugify(clan.clan);
                                                            const palette = clanPalette(cSlug, vc.isSpecial, vc.isMythical);
                                                            const gifUrl = vc.isSpecial || vc.isMythical ? "/clan-art/special.gif" : clanGifUrl(clan.clan);
                                                            return (_jsxs("button", { onClick: () => { setSelectedClanIdx(absIdx); setFiniIdx(0); }, style: {
                                                                    display: "flex", flexDirection: "column", borderRadius: 16,
                                                                    overflow: "hidden", border: "none", padding: 0, cursor: "pointer",
                                                                    outline: active ? `3px solid ${vc.isSpecial ? "#ffd700" : vc.isMythical ? "#c0a0ff" : familyColor}` : "3px solid transparent",
                                                                    outlineOffset: 2, transition: "all 0.12s",
                                                                    transform: active ? "scale(1.02)" : "scale(1)", background: "transparent",
                                                                }, children: [_jsx("div", { style: { background: palette.bg, height: 100, display: "flex", alignItems: "flex-end", justifyContent: "center", overflow: "hidden", paddingBottom: 4 }, children: vc.isSpecial || vc.isMythical ? (_jsx("div", { style: { fontSize: vc.isSpecial ? 32 : 28, paddingBottom: 8 }, children: vc.isSpecial ? "✦" : "★" })) : (_jsx("img", { src: gifUrl, alt: clan.clan, style: { height: 80, width: "auto", objectFit: "contain" }, onError: e => { e.target.style.display = "none"; } })) }), _jsxs("div", { style: { background: "#fff", padding: "6px 4px 8px", textAlign: "center" }, children: [_jsx("span", { style: { fontSize: 10, fontWeight: 700, color: active ? (vc.isSpecial ? "#b8860b" : vc.isMythical ? "#7c3aed" : familyColor) : "#333", display: "block", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }, children: clan.clan }), _jsxs("span", { style: { fontSize: 9, color: "#bbb", display: "block" }, children: [clan.count, " Finis"] })] })] }, clan.clan));
                                                        }) }), _jsxs("div", { style: { display: "flex", alignItems: "center", gap: 10, marginTop: 16 }, children: [_jsx(NavArrow, { dir: "\u2190", disabled: page === 0, onClick: () => setPage(p => Math.max(0, p - 1)) }), _jsx(NavArrow, { dir: "\u2192", disabled: page >= totalPages - 1, onClick: () => setPage(p => Math.min(totalPages - 1, p + 1)) }), _jsxs("span", { style: { fontSize: 12, color: "#bbb" }, children: [page + 1, " / ", totalPages] })] }), _jsx("div", { style: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginTop: 20 }, children: ["Strength", "Health", "Speed", "Defense"].map((label, i) => {
                                                            const vals = [view.info.baseStats.strength, view.info.baseStats.maxHealth, view.info.baseStats.speed, view.info.baseStats.defense];
                                                            return (_jsxs("div", { style: { textAlign: "center", padding: "8px 4px", borderRadius: 12, border: "1.5px solid #eee" }, children: [_jsx("div", { style: { fontSize: 18, fontWeight: 800, color: "#222" }, children: vals[i] }), _jsx("div", { style: { fontSize: 10, color: "#aaa" }, children: label })] }, label));
                                                        }) }), _jsx("div", { style: { display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }, children: [
                                                            { label: `Default passive: ${PASSIVE_LABEL[view.info.defaultPassive]}`, bg: "#fce7f3", color: "#be185d" },
                                                            { label: `Beats ${view.info.beats} (×1.1)`, bg: "#dcfce7", color: "#15803d" },
                                                            { label: `Loses to ${view.info.losesTo} (×0.9)`, bg: "#fff7ed", color: "#c2410c" },
                                                            { label: `Volatility ${Math.round(view.info.volatilityAffinity * 100)}%`, bg: "#f3e8ff", color: "#7c3aed" },
                                                            ...(view.specials != null ? [{ label: `◆ ${view.specials} specials · ★ ${view.mythicals} mythicals`, bg: "#fefce8", color: "#854d0e" }] : []),
                                                        ].map(c => (_jsx("span", { style: { fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 100, background: c.bg, color: c.color }, children: c.label }, c.label))) })] }))] })] }), _jsx("div", { style: { display: "flex", flexDirection: "column", minHeight: 0 }, children: selectedClan && loaded ? (_jsx(FiniViewer, { clan: selectedClan, familyLabel: FAMILY_LABEL[selectedFamily], familyCode: selectedFamily, familyColor: familyColor, clanIdx: selectedClanIdx, tokens: tokens, finiIdx: finiIdx, setFiniIdx: setFiniIdx, timeTab: timeTab, setTimeTab: setTimeTab, passiveLabel: selectedClan && !selectedClan.isSpecial && !selectedClan.isMythical
                                        ? PASSIVE_LABEL[selectedClan.passive]
                                        : undefined })) : (_jsx("div", { style: { flex: 1, borderRadius: 24, background: `${familyColor}18`, display: "flex", alignItems: "center", justifyContent: "center", color: "#ccc", fontSize: 16 }, children: loaded ? "Select a clan" : "Loading…" })) })] }), dataset && (_jsxs("div", { style: { padding: "0 56px 16px", fontSize: 11, color: "#bbb", flexShrink: 0 }, children: [dataset.scanned.toLocaleString(), " Finis scanned \u00B7 families beat the one they counter (\u00D71.1) and lose to the next (\u00D70.9)."] }))] }))] }));
}
// ─── Fini Viewer ─────────────────────────────────────────────────────────────
function FiniViewer({ clan, familyLabel, familyCode, familyColor, clanIdx: _clanIdx, tokens, finiIdx, setFiniIdx, timeTab, setTimeTab, passiveLabel, }) {
    const vc = clan;
    const isSpecial = vc.isSpecial;
    const isMythical = vc.isMythical;
    const clanSlug = isSpecial || isMythical ? "special" : slugify(clan.clan);
    const palette = clanPalette(clanSlug, isSpecial, isMythical);
    const token = tokens[finiIdx];
    const videoUrl = token ? finiVideoUrl(clanSlug, token) : null;
    const videoRef = useRef(null);
    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.load();
        }
    }, [videoUrl]);
    const prev = () => setFiniIdx(Math.max(0, finiIdx - 1));
    const next = () => setFiniIdx(Math.min(tokens.length - 1, finiIdx + 1));
    const displayClanName = isSpecial ? "Specials" : isMythical ? "Mythicals" : clan.clan;
    const accentColor = isSpecial ? "#ffd700" : isMythical ? "#c0a0ff" : familyColor;
    return (_jsxs("div", { style: {
            flex: 1, borderRadius: 24, overflow: "hidden",
            background: palette.bg, display: "flex", flexDirection: "column",
            minHeight: 0,
        }, children: [_jsxs("div", { style: { padding: "18px 20px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }, children: [_jsxs("div", { style: { display: "flex", alignItems: "center", gap: 10 }, children: [_jsx("span", { style: { width: 28, height: 28, borderRadius: "50%", background: familyColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: "#fff" }, children: familyCode.slice(0, 2) }), _jsxs("span", { style: { fontSize: 15, fontWeight: 700, color: isSpecial || isMythical ? palette.text : "#333" }, children: [familyLabel, ": ", displayClanName] })] }), token && (_jsxs("div", { style: { display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,0.85)", borderRadius: 12, padding: "6px 14px" }, children: [_jsxs("span", { style: { fontSize: 13, fontWeight: 700, color: "#333" }, children: ["Fini #", token] }), passiveLabel && _jsx("span", { style: { fontSize: 11, color: "#999" }, children: passiveLabel })] }))] }), _jsx("div", { style: { flex: 1, position: "relative", overflow: "hidden", minHeight: 0 }, children: videoUrl ? (_jsx("video", { ref: videoRef, autoPlay: true, loop: true, muted: true, playsInline: true, style: { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", objectPosition: "center" }, children: _jsx("source", { src: videoUrl, type: "video/mp4" }) }, videoUrl)) : (_jsx("div", { style: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }, children: _jsx("img", { src: isSpecial || isMythical ? "/clan-art/special.gif" : `/clan-art/${clanSlug}.gif`, alt: clan.clan, style: { height: "80%", width: "auto", objectFit: "contain" } }) })) }), _jsxs("div", { style: { padding: "12px 20px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.6)", backdropFilter: "blur(8px)" }, children: [_jsx(NavArrow, { dir: "\u2190", disabled: finiIdx === 0 || tokens.length === 0, onClick: prev, size: 36 }), _jsx("div", { style: { display: "flex", gap: 4, background: "rgba(0,0,0,0.08)", borderRadius: 100, padding: 3 }, children: TIME_TABS.map(t => (_jsx("button", { onClick: () => setTimeTab(t), style: {
                                padding: "5px 12px", borderRadius: 100, border: "none", cursor: "pointer",
                                fontSize: 12, fontWeight: 700,
                                background: timeTab === t ? accentColor : "transparent",
                                color: timeTab === t ? "#fff" : "#666",
                                transition: "all 0.15s",
                            }, children: t }, t))) }), _jsx(NavArrow, { dir: "\u2192", disabled: finiIdx >= tokens.length - 1 || tokens.length === 0, onClick: next, size: 36 })] }), tokens.length > 0 && (_jsxs("div", { style: { textAlign: "center", paddingBottom: 8, fontSize: 11, color: "rgba(0,0,0,0.35)", fontWeight: 600 }, children: [finiIdx + 1, " / ", tokens.length, " shown \u00B7 ", clan.count, " in clan"] }))] }));
}
// ─── Nav Arrow ───────────────────────────────────────────────────────────────
function NavArrow({ dir, disabled, onClick, size = 32 }) {
    return (_jsx("button", { onClick: onClick, disabled: disabled, style: {
            width: size, height: size, borderRadius: "50%",
            border: "1.5px solid #e5e7eb", background: disabled ? "transparent" : "#fff",
            cursor: disabled ? "default" : "pointer",
            opacity: disabled ? 0.3 : 1,
            fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.12s",
        }, children: dir }));
}
