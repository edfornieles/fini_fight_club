import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useRef, useState } from "react";
import { ALL_COIN_FAMILIES } from "../game/types";
import { loadTaxonomy, familyView } from "../game/taxonomy";
import { FAMILY_COLOR } from "./familyColors";
import CLAN_COLORS from "../clanColors.json";
import { fetchOwnedFini, loadOwnershipSnapshot, } from "../game/wallet";
import { traitsToStats, getFamilyArchetype, familyMatchup, SPECIAL_PERKS, MYTHICAL_PERKS, } from "../game/attributes";
import { getFiniRecord, winRate } from "../game/finiRecords";
import { FiniMedia } from "./FiniMedia";
const MAX_TOKEN = 9999;
const FAMILY_LABEL = {
    BTC: "Bitcoin", ETH: "Ethereum", SOL: "Solana", DOGE: "Dodge",
    LINK: "Chain link", UNI: "Uniswap", AVAX: "Avalanche",
    BNB: "Binance", MATIC: "Polygon", XTZ: "Tezos",
};
const PASSIVE_LABEL = {
    DIAMOND_BODY: "Diamond Body", COMPOUND: "Compound", HIGH_THROUGHPUT: "High Throughput",
    MEME_SPIKE: "Meme Spike", ORACLE: "Oracle", SWAP: "Swap", AVALANCHE: "Avalanche",
    FEE_BURN: "Fee Burn", SCALING: "Scaling", SELF_AMEND: "Self-Amend",
};
function slugify(n) { return n.toLowerCase().replace(/'/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""); }
function clanGifUrl(name) { return `/clan-art/${slugify(name)}.gif`; }
function finiVideoUrl(slug, id) { return `/clan-finis/${slug}/${id}.mp4`; }
function shortAddr(a) { return `${a.slice(0, 6)}...${a.slice(-4)}`; }
function moodFromDelta(delta) {
    if (delta > 0.02)
        return "happy";
    if (delta >= -0.02)
        return "ok";
    if (delta > -0.1)
        return "sad";
    return "ko";
}
const SPECIALS_PAL = { bg: "#1a1a2e", text: "#ffd700" };
const MYTHICALS_PAL = { bg: "#0d1b2a", text: "#c0a0ff" };
function clanPalette(slug, isSpecial, isMythical) {
    if (isSpecial)
        return SPECIALS_PAL;
    if (isMythical)
        return MYTHICALS_PAL;
    const bg = CLAN_COLORS[slug] ?? "#e8e0d0";
    const hex = bg.replace("#", "");
    const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return { bg, text: brightness < 128 ? "#f0e8d0" : "#2a1f10" };
}
function familyEdges(family) {
    const strong = [], weak = [];
    for (const other of ALL_COIN_FAMILIES) {
        if (other === family)
            continue;
        const m = familyMatchup(family, other);
        if (m > 1.001)
            strong.push(other);
        else if (m < 0.999)
            weak.push(other);
    }
    return { strong, weak };
}
const CLANS_PER_PAGE = 4;
const TIME_TABS = ["1D", "1H", "1W", "1M", "1Y"];
export function ExploreSection() {
    const [tab, setTab] = useState("browse");
    // Browse state
    const [dataset, setDataset] = useState(null);
    const [loaded, setLoaded] = useState(false);
    const [manifest, setManifest] = useState(null);
    const [selectedFamily, setSelectedFamily] = useState("BTC");
    const [selectedClanIdx, setSelectedClanIdx] = useState(0);
    const [page, setPage] = useState(0);
    const [finiIdx, setFiniIdx] = useState(0);
    const [timeTab, setTimeTab] = useState("1D");
    // Lookup state
    const [query, setQuery] = useState("");
    const [tokenId, setTokenId] = useState(null);
    const [fini, setFini] = useState(null);
    const [snapshot, setSnapshot] = useState(null);
    const [lookupStatus, setLookupStatus] = useState("idle");
    const [lookupError, setLookupError] = useState(null);
    useEffect(() => {
        if (loaded)
            return;
        Promise.all([
            loadTaxonomy(),
            fetch("/clan-finis/manifest.json").then(r => r.json()).catch(() => null),
        ]).then(([tax, man]) => { setDataset(tax); setManifest(man); setLoaded(true); });
    }, [loaded]);
    useEffect(() => {
        if (tab !== "lookup" || snapshot)
            return;
        loadOwnershipSnapshot().then(setSnapshot).catch(() => { });
    }, [tab, snapshot]);
    const handleFamily = (f) => { setSelectedFamily(f); setSelectedClanIdx(0); setPage(0); setFiniIdx(0); };
    const lookup = useCallback(async (id) => {
        if (!Number.isFinite(id) || id < 0 || id > MAX_TOKEN) {
            setLookupStatus("error");
            setLookupError(`Token must be 0-${MAX_TOKEN}.`);
            return;
        }
        setLookupStatus("loading");
        setLookupError(null);
        setTokenId(id);
        try {
            setFini(await fetchOwnedFini(id));
            setLookupStatus("idle");
        }
        catch (e) {
            setLookupStatus("error");
            setLookupError(e instanceof Error ? e.message : "Failed to load this Fini.");
        }
    }, []);
    const submitLookup = () => { const id = parseInt(query.trim(), 10); lookup(id); };
    const randomLookup = () => { const r = Math.floor(Math.random() * (MAX_TOKEN + 1)); setQuery(String(r)); lookup(r); };
    const view = familyView(selectedFamily, dataset ?? null);
    const allClans = [
        ...view.clans,
        ...(view.specials && view.specials > 0 ? [{ clan: "Specials", count: view.specials, isSpecial: true }] : []),
        ...(view.mythicals && view.mythicals > 0 ? [{ clan: "Mythicals", count: view.mythicals, isMythical: true }] : []),
    ];
    const totalPages = Math.ceil(allClans.length / CLANS_PER_PAGE);
    const paginated = allClans.slice(page * CLANS_PER_PAGE, (page + 1) * CLANS_PER_PAGE);
    const selectedClan = allClans[selectedClanIdx];
    const familyColor = FAMILY_COLOR[selectedFamily].hex;
    const isSpecialClan = selectedClan?.isSpecial;
    const isMythicalClan = selectedClan?.isMythical;
    const clanSlug = isSpecialClan || isMythicalClan ? "special" : selectedClan ? slugify(selectedClan.clan) : "";
    const tokens = manifest?.[clanSlug] ?? [];
    const S = { fontFamily: "'Nunito', system-ui, sans-serif" };
    return (_jsxs("section", { style: { ...S, background: "#fff", padding: "80px 56px 64px" }, children: [_jsxs("div", { style: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 36 }, children: [_jsxs("div", { children: [_jsxs("h2", { style: { fontSize: 42, fontWeight: 800, color: "#111", lineHeight: 1.15, letterSpacing: "-0.5px", margin: 0 }, children: ["Track your favorite", " ", _jsxs("span", { style: { position: "relative", display: "inline-block" }, children: [_jsx("span", { style: { position: "relative", zIndex: 1 }, children: "coins" }), _jsx("svg", { "aria-hidden": true, style: { position: "absolute", top: "-10px", left: "-12px", width: "calc(100% + 24px)", height: "calc(100% + 20px)", pointerEvents: "none" }, viewBox: "0 0 130 50", preserveAspectRatio: "none", children: _jsx("ellipse", { cx: "65", cy: "25", rx: "62", ry: "22", fill: "none", stroke: "#f472b6", strokeWidth: "3.5", strokeLinecap: "round" }) })] })] }), _jsx("p", { style: { fontSize: 15, color: "#777", marginTop: 10 }, children: "Finis are emotionally connected to the performance of financial assets." })] }), _jsx("a", { href: "https://opensea.io/collection/finiliar", target: "_blank", rel: "noopener noreferrer", style: { fontSize: 14, color: "#f472b6", fontWeight: 700, textDecoration: "none", paddingTop: 8 }, children: "Get a Fini \u2192 View on Opensea" })] }), _jsx("div", { style: { display: "flex", gap: 4, background: "#f3f4f6", borderRadius: 100, padding: 4, width: "fit-content", marginBottom: 40 }, children: ["browse", "lookup"].map(t => (_jsx("button", { onClick: () => setTab(t), style: {
                        padding: "8px 24px", borderRadius: 100, border: "none", cursor: "pointer",
                        fontSize: 14, fontWeight: 700,
                        background: tab === t ? "#fff" : "transparent",
                        color: tab === t ? "#111" : "#888",
                        boxShadow: tab === t ? "0 1px 4px rgba(0,0,0,0.10)" : "none",
                        transition: "all 0.15s",
                    }, children: t === "browse" ? "Browse clans" : "Look up a Fini" }, t))) }), tab === "browse" && (_jsxs("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, minHeight: 600 }, children: [_jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 28 }, children: [_jsxs("div", { children: [_jsx("p", { style: { fontSize: 12, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }, children: "Select a Family" }), _jsx("div", { style: { display: "flex", flexWrap: "wrap", gap: 8 }, children: ALL_COIN_FAMILIES.map(f => {
                                            const active = f === selectedFamily;
                                            return (_jsxs("button", { onClick: () => handleFamily(f), style: {
                                                    display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 100,
                                                    border: active ? "none" : "1.5px solid #e5e7eb",
                                                    background: active ? "#f472b6" : "#fff", color: active ? "#fff" : "#222",
                                                    fontWeight: 600, fontSize: 14, cursor: "pointer",
                                                    boxShadow: active ? "none" : "0 1px 3px rgba(0,0,0,0.06)", transition: "all 0.15s",
                                                }, children: [_jsx("span", { style: { width: 22, height: 22, borderRadius: "50%", background: active ? "rgba(0,0,0,0.18)" : "#111", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: "#fff", flexShrink: 0 }, children: f.slice(0, 2) }), FAMILY_LABEL[f]] }, f));
                                        }) })] }), _jsxs("div", { children: [_jsx("p", { style: { fontSize: 12, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }, children: "Select a Clan" }), !loaded ? _jsx("p", { style: { color: "#bbb", fontSize: 14 }, children: "Loading..." }) : (_jsxs(_Fragment, { children: [_jsx("div", { style: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }, children: paginated.map((clan, i) => {
                                                    const absIdx = page * CLANS_PER_PAGE + i;
                                                    const active = absIdx === selectedClanIdx;
                                                    const vc = clan;
                                                    const cSlug = vc.isSpecial || vc.isMythical ? "special" : slugify(clan.clan);
                                                    const pal = clanPalette(cSlug, vc.isSpecial, vc.isMythical);
                                                    return (_jsxs("button", { onClick: () => { setSelectedClanIdx(absIdx); setFiniIdx(0); }, style: {
                                                            display: "flex", flexDirection: "column", borderRadius: 16, overflow: "hidden",
                                                            border: "none", padding: 0, cursor: "pointer",
                                                            outline: active ? `3px solid ${vc.isSpecial ? "#ffd700" : vc.isMythical ? "#c0a0ff" : familyColor}` : "3px solid transparent",
                                                            outlineOffset: 2, transition: "all 0.12s", transform: active ? "scale(1.02)" : "scale(1)", background: "transparent",
                                                        }, children: [_jsx("div", { style: { background: pal.bg, height: 100, display: "flex", alignItems: "flex-end", justifyContent: "center", overflow: "hidden", paddingBottom: 4 }, children: vc.isSpecial || vc.isMythical
                                                                    ? _jsx("div", { style: { fontSize: 32, paddingBottom: 8 }, children: vc.isSpecial ? "S" : "M" })
                                                                    : _jsx("img", { src: clanGifUrl(clan.clan), alt: clan.clan, style: { height: 80, width: "auto", objectFit: "contain" }, onError: e => { e.target.style.display = "none"; } }) }), _jsxs("div", { style: { background: "#fff", padding: "6px 4px 8px", textAlign: "center" }, children: [_jsx("span", { style: { fontSize: 10, fontWeight: 700, color: active ? (vc.isSpecial ? "#b8860b" : vc.isMythical ? "#7c3aed" : familyColor) : "#333", display: "block", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }, children: clan.clan }), _jsxs("span", { style: { fontSize: 9, color: "#bbb", display: "block" }, children: [clan.count, " Finis"] })] })] }, clan.clan));
                                                }) }), _jsxs("div", { style: { display: "flex", alignItems: "center", gap: 10, marginTop: 16 }, children: [_jsx(NavBtn, { dir: "<", disabled: page === 0, onClick: () => setPage(p => Math.max(0, p - 1)) }), _jsx(NavBtn, { dir: ">", disabled: page >= totalPages - 1, onClick: () => setPage(p => Math.min(totalPages - 1, p + 1)) }), _jsxs("span", { style: { fontSize: 12, color: "#bbb" }, children: [page + 1, " / ", totalPages] })] }), _jsx("div", { style: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginTop: 20 }, children: ["Strength", "Health", "Speed", "Defense"].map((label, i) => {
                                                    const vals = [view.info.baseStats.strength, view.info.baseStats.maxHealth, view.info.baseStats.speed, view.info.baseStats.defense];
                                                    return (_jsxs("div", { style: { textAlign: "center", padding: "8px 4px", borderRadius: 12, border: "1.5px solid #eee" }, children: [_jsx("div", { style: { fontSize: 18, fontWeight: 800, color: "#222" }, children: vals[i] }), _jsx("div", { style: { fontSize: 10, color: "#aaa" }, children: label })] }, label));
                                                }) }), _jsx("div", { style: { display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }, children: [
                                                    { label: `Default passive: ${PASSIVE_LABEL[view.info.defaultPassive]}`, bg: "#fce7f3", color: "#be185d" },
                                                    { label: `Beats ${view.info.beats} (x1.1)`, bg: "#dcfce7", color: "#15803d" },
                                                    { label: `Loses to ${view.info.losesTo} (x0.9)`, bg: "#fff7ed", color: "#c2410c" },
                                                    { label: `Volatility ${Math.round(view.info.volatilityAffinity * 100)}%`, bg: "#f3e8ff", color: "#7c3aed" },
                                                    ...(view.specials != null ? [{ label: `${view.specials} specials / ${view.mythicals} mythicals`, bg: "#fefce8", color: "#854d0e" }] : []),
                                                ].map(c => (_jsx("span", { style: { fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 100, background: c.bg, color: c.color }, children: c.label }, c.label))) })] }))] })] }), _jsx("div", { children: selectedClan && loaded ? (_jsx(InlineFiniViewer, { clan: selectedClan, familyLabel: FAMILY_LABEL[selectedFamily], familyCode: selectedFamily, familyColor: familyColor, tokens: tokens, finiIdx: finiIdx, setFiniIdx: setFiniIdx, timeTab: timeTab, setTimeTab: setTimeTab, passiveLabel: selectedClan && !selectedClan.isSpecial && !selectedClan.isMythical
                                ? PASSIVE_LABEL[selectedClan.passive] : undefined })) : (_jsx("div", { style: { flex: 1, borderRadius: 24, background: `${familyColor}18`, height: 600, display: "flex", alignItems: "center", justifyContent: "center", color: "#ccc" }, children: loaded ? "Select a clan" : "Loading..." })) })] })), tab === "lookup" && (_jsxs("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, minHeight: 600, alignItems: "start" }, children: [_jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 20 }, children: [_jsxs("div", { children: [_jsxs("p", { style: { fontSize: 12, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }, children: ["Search by token ID (0-", MAX_TOKEN, ")"] }), _jsxs("div", { style: { display: "flex", gap: 8 }, children: [_jsx("input", { value: query, onChange: e => setQuery(e.target.value), onKeyDown: e => e.key === "Enter" && submitLookup(), inputMode: "numeric", placeholder: "e.g. 1024", style: {
                                                    flex: 1, borderRadius: 100, border: "1.5px solid #e5e7eb",
                                                    background: "#fff", padding: "10px 18px", fontSize: 15, fontFamily: "monospace",
                                                    color: "#111", outline: "none",
                                                } }), _jsx("button", { onClick: submitLookup, style: {
                                                    background: "#f472b6", color: "#fff", border: "none", borderRadius: 100,
                                                    padding: "10px 22px", fontSize: 14, fontWeight: 700, cursor: "pointer",
                                                }, children: "Search" }), _jsx("button", { onClick: randomLookup, style: {
                                                    background: "#f3f4f6", color: "#555", border: "none", borderRadius: 100,
                                                    padding: "10px 18px", fontSize: 20, cursor: "pointer",
                                                }, children: "\uD83C\uDFB2" })] }), lookupError && (_jsxs("p", { style: { marginTop: 10, fontSize: 13, color: "#e11d48", fontWeight: 600 }, children: ["Warning: ", lookupError] }))] }), !fini && lookupStatus === "idle" && (_jsxs("div", { style: { borderRadius: 20, background: "#f9f9f9", padding: "40px 32px", textAlign: "center", color: "#bbb" }, children: [_jsx("div", { style: { fontSize: 40, marginBottom: 12 }, children: "\uD83D\uDDC2\uFE0F" }), _jsx("div", { style: { fontSize: 15, fontWeight: 700, color: "#888" }, children: "Search any of the 10,000 Finis" }), _jsx("div", { style: { fontSize: 13, marginTop: 6 }, children: "See stats, matchups, owner, price, and battle record." })] })), lookupStatus === "loading" && (_jsxs("div", { style: { borderRadius: 20, background: "#f9f9f9", padding: "40px 32px", textAlign: "center", color: "#bbb" }, children: ["Summoning #", tokenId, "..."] })), fini && lookupStatus !== "loading" && (_jsx(CodexStats, { fini: fini, snapshot: snapshot, record: getFiniRecord(fini.tokenId), onNav: d => {
                                    const next = Math.min(MAX_TOKEN, Math.max(0, fini.tokenId + d));
                                    setQuery(String(next));
                                    lookup(next);
                                } }))] }), _jsx("div", { children: fini && lookupStatus !== "loading" ? (_jsx(CodexArtwork, { fini: fini })) : (_jsx("div", { style: { borderRadius: 24, background: "#f3f4f6", height: 520, display: "flex", alignItems: "center", justifyContent: "center", color: "#ddd" }, children: _jsx("span", { style: { fontSize: 48 }, children: "\uD83D\uDD0D" }) })) })] })), dataset && tab === "browse" && (_jsxs("p", { style: { fontSize: 11, color: "#bbb", marginTop: 32 }, children: [dataset.scanned.toLocaleString(), " Finis scanned \u00B7 families beat the one they counter (x1.1) and lose to the next (x0.9)."] }))] }));
}
function CodexStats({ fini, snapshot, record, onNav }) {
    const stats = traitsToStats(fini.traits);
    const archetype = getFamilyArchetype(fini.traits.family);
    const edges = familyEdges(fini.traits.family);
    const color = FAMILY_COLOR[fini.traits.family];
    const owner = snapshot?.tokenOwners?.[String(fini.tokenId)] ?? null;
    const ownerHoldings = owner ? snapshot?.byOwner?.[owner]?.length ?? 1 : null;
    const perk = stats.mythicalPerk
        ? { kind: "mythical", def: MYTHICAL_PERKS[stats.mythicalPerk] }
        : stats.specialPerk
            ? { kind: "special", def: SPECIAL_PERKS[stats.specialPerk] }
            : null;
    const up = fini.latestDelta > 0;
    const flat = Math.abs(fini.latestDelta) < 0.0001;
    const deltaPct = Math.abs(fini.latestDelta * 100).toFixed(2);
    const nbStyle = {
        width: 36, height: 36, borderRadius: "50%", border: "1.5px solid #e5e7eb",
        background: "#fff", cursor: "pointer", fontSize: 18, display: "flex",
        alignItems: "center", justifyContent: "center", flexShrink: 0,
    };
    return (_jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 16 }, children: [_jsxs("div", { style: { display: "flex", alignItems: "center", gap: 12 }, children: [_jsx("button", { onClick: () => onNav(-1), style: nbStyle, children: "\u2039" }), _jsxs("div", { style: { flex: 1 }, children: [_jsx("div", { style: { fontWeight: 800, fontSize: 20, color: "#111", lineHeight: 1 }, children: fini.name }), _jsxs("div", { style: { fontSize: 13, color: "#999", fontWeight: 600, marginTop: 2 }, children: ["#", fini.tokenId, " \u00B7 ", archetype, " \u00B7 ", fini.traits.clan] })] }), _jsx("button", { onClick: () => onNav(1), style: nbStyle, children: "\u203A" })] }), _jsxs("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" }, children: [_jsx("span", { style: { fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 100, background: color.bg, color: "#fff" }, children: fini.traits.family }), _jsx("span", { style: { fontSize: 12, fontWeight: 600, padding: "4px 12px", borderRadius: 100, background: "#f3f4f6", color: "#666" }, children: fini.traits.frequency }), perk && (_jsxs("span", { style: { fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 100, background: perk.kind === "mythical" ? "#fef9c3" : "#f3e8ff", color: perk.kind === "mythical" ? "#854d0e" : "#7c3aed" }, title: perk.def.description, children: [perk.kind === "mythical" ? "Star" : "Gem", " ", perk.def.displayName] }))] }), _jsx("div", { style: { display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }, children: [
                    ["STR", stats.strength], ["HP", stats.maxHealth], ["SPD", stats.speed],
                    ["DEF", stats.defense], ["VOL", Math.round(stats.volatilityAffinity * 100)], ["CUTE", stats.cuteness],
                ].map(([label, val]) => (_jsxs("div", { style: { textAlign: "center", padding: "8px 4px", borderRadius: 12, border: "1.5px solid #eee" }, children: [_jsx("div", { style: { fontSize: 9, color: "#aaa", textTransform: "uppercase" }, children: label }), _jsx("div", { style: { fontSize: 16, fontWeight: 800, color: "#222" }, children: val })] }, label))) }), _jsxs("div", { style: { fontSize: 11, color: "#aaa", fontWeight: 600 }, children: ["passive: ", stats.passiveAbility.replace(/_/g, " ").toLowerCase()] }), _jsxs("div", { style: { display: "flex", flexWrap: "wrap", gap: 8, fontSize: 12 }, children: [edges.strong.length > 0 && (_jsxs("span", { style: { color: "#15803d", fontWeight: 700 }, children: ["strong vs ", edges.strong.join(", ")] })), edges.weak.length > 0 && (_jsxs("span", { style: { color: "#c2410c", fontWeight: 700 }, children: ["weak vs ", edges.weak.join(", ")] }))] }), _jsxs("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }, children: [_jsxs(InfoPanel, { label: "Price", children: [_jsx("div", { style: { fontWeight: 800, fontSize: 17, color: "#111" }, children: fini.latestPrice ? `$${fini.latestPrice.toLocaleString()}` : "-" }), _jsxs("div", { style: { fontSize: 12, fontWeight: 700, color: flat ? "#aaa" : up ? "#15803d" : "#e11d48" }, children: [flat ? "flat" : up ? "up" : "down", " ", deltaPct, "%"] })] }), _jsx(InfoPanel, { label: "Owner", children: owner
                            ? _jsxs(_Fragment, { children: [_jsx("div", { style: { fontSize: 12, fontFamily: "monospace", color: "#333" }, children: shortAddr(owner) }), _jsxs("div", { style: { fontSize: 11, color: "#aaa" }, children: ["holds ", ownerHoldings, " Finis"] })] })
                            : _jsx("div", { style: { fontSize: 12, color: "#aaa" }, children: snapshot ? "unknown" : "loading..." }) }), _jsx(InfoPanel, { label: "Battles", children: record && record.battles > 0
                            ? _jsxs(_Fragment, { children: [_jsxs("div", { style: { fontWeight: 800, fontSize: 17, color: "#111" }, children: ["Lvl ", record.level] }), _jsxs("div", { style: { fontSize: 11, color: "#aaa" }, children: [record.wins, "W-", record.losses, "L \u00B7 ", Math.round(winRate(record) * 100), "%"] })] })
                            : _jsx("div", { style: { fontSize: 12, color: "#aaa" }, children: "No battles yet" }) })] })] }));
}
function CodexArtwork({ fini }) {
    const mood = moodFromDelta(fini.latestDelta);
    const color = FAMILY_COLOR[fini.traits.family];
    return (_jsxs("div", { style: {
            borderRadius: 24, overflow: "hidden", background: fini.artwork.background ?? "#fae3eb",
            height: 520, display: "flex", alignItems: "center", justifyContent: "center",
            position: "relative",
        }, children: [_jsx(FiniMedia, { artwork: fini.artwork, family: fini.traits.family, mood: mood, animate: true }), _jsxs("div", { style: {
                    position: "absolute", bottom: 0, left: 0, right: 0, padding: "16px 20px",
                    background: "rgba(255,255,255,0.75)", backdropFilter: "blur(8px)",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                }, children: [_jsx("span", { style: { fontSize: 14, fontWeight: 700, color: "#111" }, children: fini.name }), _jsx("span", { style: { fontSize: 12, fontWeight: 700, padding: "3px 12px", borderRadius: 100, background: color.bg, color: "#fff" }, children: fini.traits.family })] })] }));
}
function InfoPanel({ label, children }) {
    return (_jsxs("div", { style: { borderRadius: 14, background: "#f9f9f9", padding: "10px 12px" }, children: [_jsx("div", { style: { fontSize: 10, color: "#bbb", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }, children: label }), children] }));
}
function InlineFiniViewer({ clan, familyLabel, familyCode, familyColor, tokens, finiIdx, setFiniIdx, timeTab, setTimeTab, passiveLabel }) {
    const vc = clan;
    const isSpecial = vc.isSpecial;
    const isMythical = vc.isMythical;
    const clanSlug = isSpecial || isMythical ? "special" : slugify(clan.clan);
    const palette = clanPalette(clanSlug, isSpecial, isMythical);
    const token = tokens[finiIdx];
    const videoUrl = token ? finiVideoUrl(clanSlug, token) : null;
    const videoRef = useRef(null);
    const accentColor = isSpecial ? "#ffd700" : isMythical ? "#c0a0ff" : familyColor;
    const displayName = isSpecial ? "Specials" : isMythical ? "Mythicals" : clan.clan;
    useEffect(() => { videoRef.current?.load(); }, [videoUrl]);
    return (_jsxs("div", { style: { borderRadius: 24, overflow: "hidden", background: palette.bg, display: "flex", flexDirection: "column", height: 600 }, children: [_jsxs("div", { style: { padding: "18px 20px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }, children: [_jsxs("div", { style: { display: "flex", alignItems: "center", gap: 10 }, children: [_jsx("span", { style: { width: 28, height: 28, borderRadius: "50%", background: familyColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: "#fff" }, children: familyCode.slice(0, 2) }), _jsxs("span", { style: { fontSize: 15, fontWeight: 700, color: "#333" }, children: [familyLabel, ": ", displayName] })] }), token && (_jsxs("div", { style: { display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.85)", borderRadius: 12, padding: "6px 14px" }, children: [_jsxs("span", { style: { fontSize: 13, fontWeight: 700, color: "#333" }, children: ["Fini #", token] }), passiveLabel && _jsx("span", { style: { fontSize: 11, color: "#999" }, children: passiveLabel })] }))] }), _jsx("div", { style: { flex: 1, position: "relative", overflow: "hidden" }, children: videoUrl ? (_jsx("video", { ref: videoRef, autoPlay: true, loop: true, muted: true, playsInline: true, style: { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }, children: _jsx("source", { src: videoUrl, type: "video/mp4" }) }, videoUrl)) : (_jsx("div", { style: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }, children: _jsx("img", { src: `/clan-art/${clanSlug}.gif`, alt: clan.clan, style: { height: "80%", width: "auto", objectFit: "contain" } }) })) }), _jsxs("div", { style: { padding: "12px 20px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.6)", backdropFilter: "blur(8px)" }, children: [_jsx(NavBtn, { dir: "<", disabled: finiIdx === 0 || !tokens.length, onClick: () => setFiniIdx(Math.max(0, finiIdx - 1)), size: 36 }), _jsx("div", { style: { display: "flex", gap: 4, background: "rgba(0,0,0,0.08)", borderRadius: 100, padding: 3 }, children: TIME_TABS.map(t => (_jsx("button", { onClick: () => setTimeTab(t), style: {
                                padding: "5px 12px", borderRadius: 100, border: "none", cursor: "pointer",
                                fontSize: 12, fontWeight: 700,
                                background: timeTab === t ? accentColor : "transparent",
                                color: timeTab === t ? "#fff" : "#666", transition: "all 0.15s",
                            }, children: t }, t))) }), _jsx(NavBtn, { dir: ">", disabled: finiIdx >= tokens.length - 1 || !tokens.length, onClick: () => setFiniIdx(Math.min(tokens.length - 1, finiIdx + 1)), size: 36 })] }), tokens.length > 0 && (_jsxs("div", { style: { textAlign: "center", paddingBottom: 8, fontSize: 11, color: "rgba(0,0,0,0.35)", fontWeight: 600 }, children: [finiIdx + 1, " / ", tokens.length, " shown \u00B7 ", clan.count, " in clan"] }))] }));
}
function NavBtn({ dir, disabled, onClick, size = 32 }) {
    return (_jsx("button", { onClick: onClick, disabled: disabled, style: {
            width: size, height: size, borderRadius: "50%", border: "1.5px solid #e5e7eb",
            background: disabled ? "transparent" : "#fff", cursor: disabled ? "default" : "pointer",
            opacity: disabled ? 0.3 : 1, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center",
        }, children: dir }));
}
