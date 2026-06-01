import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from "react";
import { fetchOwnedFini, loadOwnershipSnapshot, } from "../game/wallet";
import { traitsToStats, getFamilyArchetype, familyMatchup, SPECIAL_PERKS, MYTHICAL_PERKS, } from "../game/attributes";
import { ALL_COIN_FAMILIES } from "../game/types";
import { getFiniRecord, winRate } from "../game/finiRecords";
import { FiniMedia } from "./FiniMedia";
import { FAMILY_COLOR } from "./familyColors";
const MAX_TOKEN = 9999;
function moodFromDelta(delta) {
    if (delta > 0.02)
        return "happy";
    if (delta >= -0.02)
        return "ok";
    if (delta > -0.1)
        return "sad";
    return "ko";
}
function shortAddr(a) {
    return `${a.slice(0, 6)}…${a.slice(-4)}`;
}
/** Families this family beats (matchup > 1) / loses to (< 1) when attacking. */
function familyEdges(family) {
    const strong = [];
    const weak = [];
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
/**
 * Collection Codex — search the full 10,000-Fini collection and inspect any
 * one: its trait-derived battle stats, family matchups, owner, live price, and
 * its battle record + level (accumulated locally as Finis fight). Read-only.
 */
export function CollectionCodex() {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [tokenId, setTokenId] = useState(null);
    const [fini, setFini] = useState(null);
    const [snapshot, setSnapshot] = useState(null);
    const [status, setStatus] = useState("idle");
    const [error, setError] = useState(null);
    useEffect(() => {
        if (!open || snapshot)
            return;
        loadOwnershipSnapshot()
            .then(setSnapshot)
            .catch(() => {
            /* owner column degrades gracefully */
        });
    }, [open, snapshot]);
    const lookup = useCallback(async (id) => {
        if (!Number.isFinite(id) || id < 0 || id > MAX_TOKEN) {
            setStatus("error");
            setError(`Token must be 0–${MAX_TOKEN}.`);
            return;
        }
        setStatus("loading");
        setError(null);
        setTokenId(id);
        try {
            const owned = await fetchOwnedFini(id);
            setFini(owned);
            setStatus("idle");
        }
        catch (e) {
            setStatus("error");
            setError(e instanceof Error ? e.message : "Failed to load this Fini.");
        }
    }, []);
    const submit = () => {
        const id = parseInt(query.trim(), 10);
        lookup(id);
    };
    return (_jsxs(_Fragment, { children: [_jsx("button", { onClick: () => setOpen(true), className: "fixed bottom-[4.25rem] right-4 z-40 kbtn kbtn-primary px-4 py-2.5 text-sm shadow-puff", title: "Browse the full Finiliar collection", children: "\uD83D\uDCD6 Codex" }), open && (_jsx("div", { className: "fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-grape/25 backdrop-blur-sm p-3 sm:p-6", children: _jsxs("div", { className: "w-full max-w-3xl my-4 space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between flex-wrap gap-2", children: [_jsx("h2", { className: "font-display font-bold text-2xl text-ink drop-shadow-sm", children: "\uD83D\uDCD6 Collection Codex" }), _jsx("button", { onClick: () => setOpen(false), className: "kbtn kbtn-ghost px-3 py-1.5 text-sm", children: "\u2715 Close" })] }), _jsxs("div", { className: "kcard p-4 space-y-2", children: [_jsxs("div", { className: "label-soft", children: ["\uD83D\uDD0D Look up a Fini (#0\u2013", MAX_TOKEN, ")"] }), _jsxs("div", { className: "flex flex-col sm:flex-row gap-2", children: [_jsx("input", { value: query, onChange: (e) => setQuery(e.target.value), onKeyDown: (e) => e.key === "Enter" && submit(), inputMode: "numeric", placeholder: "token id, e.g. 1024", className: "flex-1 rounded-2xl border-2 border-cloud bg-white/80 px-3 py-2 text-sm font-mono text-ink outline-none focus:border-grape/60" }), _jsx("button", { onClick: submit, className: "kbtn kbtn-primary px-4 py-2 text-sm", children: "Search" }), _jsx("button", { onClick: () => {
                                                const r = Math.floor(Math.random() * (MAX_TOKEN + 1));
                                                setQuery(String(r));
                                                lookup(r);
                                            }, className: "kbtn kbtn-grape px-4 py-2 text-sm", children: "\uD83C\uDFB2 Random" })] }), error && _jsxs("div", { className: "chip bg-coral/15 text-coral", children: ["\u26A0\uFE0F ", error] })] }), status === "loading" && (_jsxs("div", { className: "kcard p-8 text-center text-inkSoft", children: ["\u2728 Summoning #", tokenId, "\u2026"] })), fini && status !== "loading" && (_jsx(CodexDetail, { fini: fini, snapshot: snapshot, record: getFiniRecord(fini.tokenId), onNav: (d) => {
                                const next = Math.min(MAX_TOKEN, Math.max(0, fini.tokenId + d));
                                setQuery(String(next));
                                lookup(next);
                            } })), !fini && status === "idle" && (_jsxs("div", { className: "kcard p-8 text-center text-inkSoft space-y-1", children: [_jsx("div", { className: "text-4xl", children: "\uD83D\uDDC2\uFE0F" }), _jsx("div", { className: "font-semibold text-ink", children: "Search any of the 10,000 Finis" }), _jsx("div", { className: "text-[12px]", children: "See stats, family matchups, owner, live price, and battle record." })] }))] }) }))] }));
}
function CodexDetail(props) {
    const { fini, snapshot, record } = props;
    const stats = traitsToStats(fini.traits);
    const color = FAMILY_COLOR[fini.traits.family];
    const archetype = getFamilyArchetype(fini.traits.family);
    const mood = moodFromDelta(fini.latestDelta);
    const edges = familyEdges(fini.traits.family);
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
    return (_jsxs("div", { className: "kcard p-4 space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("button", { onClick: () => props.onNav(-1), className: "kbtn kbtn-ghost px-3 py-1.5 text-xs", children: ["\u2039 #", Math.max(0, fini.tokenId - 1)] }), _jsxs("span", { className: "lcd px-3 py-1 text-sm", children: ["#", fini.tokenId] }), _jsxs("button", { onClick: () => props.onNav(1), className: "kbtn kbtn-ghost px-3 py-1.5 text-xs", children: ["#", Math.min(MAX_TOKEN, fini.tokenId + 1), " \u203A"] })] }), _jsxs("div", { className: "grid sm:grid-cols-[160px_1fr] gap-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx("div", { className: "aspect-square rounded-2xl overflow-hidden flex items-center justify-center", style: { background: fini.artwork.background ?? "#fae3eb" }, children: _jsx(FiniMedia, { artwork: fini.artwork, family: fini.traits.family, mood: mood, animate: true }) }), _jsxs("div", { className: "flex flex-wrap gap-1 justify-center", children: [_jsx("span", { className: `chip ${color.bg} text-white text-[10px]`, children: fini.traits.family }), _jsx("span", { className: "chip bg-cloud/70 text-inkSoft text-[10px]", children: fini.traits.frequency })] })] }), _jsxs("div", { className: "space-y-2.5 min-w-0", children: [_jsxs("div", { children: [_jsx("div", { className: "font-display font-bold text-xl text-ink truncate", children: fini.name }), _jsxs("div", { className: "text-[12px] text-inkSoft font-semibold", children: [archetype, " \u00B7 ", fini.traits.clan] })] }), perk && (_jsxs("div", { className: `chip text-[11px] ${perk.kind === "mythical" ? "bg-lemon/40 text-ink" : "bg-grape/15 text-grape"}`, title: perk.def.description, children: [perk.kind === "mythical" ? "★" : "◆", " ", perk.def.displayName, " \u2014 ", perk.def.description] })), _jsxs("div", { className: "grid grid-cols-3 sm:grid-cols-6 gap-1.5", children: [_jsx(StatCell, { label: "STR", value: stats.strength }), _jsx(StatCell, { label: "HP", value: stats.maxHealth }), _jsx(StatCell, { label: "SPD", value: stats.speed }), _jsx(StatCell, { label: "DEF", value: stats.defense }), _jsx(StatCell, { label: "VOL", value: Math.round(stats.volatilityAffinity * 100) }), _jsx(StatCell, { label: "CUTE", value: stats.cuteness })] }), _jsxs("div", { className: "text-[11px] text-inkSoft font-semibold", children: ["\u2726 passive: ", stats.passiveAbility.replace(/_/g, " ").toLowerCase()] }), _jsxs("div", { className: "flex flex-wrap gap-x-3 gap-y-1 text-[11px]", children: [edges.strong.length > 0 && (_jsxs("span", { className: "text-mintDark font-semibold", children: ["\u2694\uFE0F strong vs ", edges.strong.join(", ")] })), edges.weak.length > 0 && (_jsxs("span", { className: "text-coral font-semibold", children: ["\uD83D\uDEE1 weak vs ", edges.weak.join(", ")] }))] })] })] }), _jsxs("div", { className: "grid sm:grid-cols-3 gap-2", children: [_jsxs(Panel, { label: "\uD83D\uDCB9 Live price", children: [_jsx("div", { className: "font-display font-bold text-lg text-ink", children: fini.latestPrice ? `$${fini.latestPrice.toLocaleString()}` : "—" }), _jsxs("div", { className: `text-[12px] font-bold ${flat ? "text-inkSoft" : up ? "text-mintDark" : "text-coral"}`, children: [flat ? "■" : up ? "▲" : "▼", " ", deltaPct, "%"] })] }), _jsx(Panel, { label: "\uD83D\uDC5B Owner", children: owner ? (_jsxs(_Fragment, { children: [_jsx("div", { className: "font-mono text-[12px] text-ink truncate", title: owner, children: shortAddr(owner) }), _jsxs("div", { className: "text-[11px] text-inkSoft", children: ["holds ", ownerHoldings, " Fini", ownerHoldings === 1 ? "" : "s"] })] })) : (_jsx("div", { className: "text-[12px] text-inkSoft", children: snapshot ? "unheld / unknown" : "loading…" })) }), _jsx(Panel, { label: "\uD83C\uDFC5 Battle record", children: record && record.battles > 0 ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "font-display font-bold text-lg text-ink", children: ["Lvl ", record.level] }), _jsxs("div", { className: "text-[11px] text-inkSoft", children: [record.wins, "W\u2013", record.losses, "L \u00B7 ", Math.round(winRate(record) * 100), "% over", " ", record.battles, " battle", record.battles === 1 ? "" : "s"] })] })) : (_jsx("div", { className: "text-[12px] text-inkSoft", children: "Unbattled \u2014 no record yet." })) })] })] }));
}
function StatCell(props) {
    return (_jsxs("div", { className: "lcd px-1 py-1 text-center leading-none", children: [_jsx("div", { className: "text-[8px] text-inkSoft", children: props.label }), _jsx("div", { className: "text-sm font-display font-bold text-ink", children: props.value })] }));
}
function Panel(props) {
    return (_jsxs("div", { className: "kcard-soft p-2.5 space-y-0.5", children: [_jsx("div", { className: "text-[10px] text-inkSoft font-semibold uppercase tracking-wide", children: props.label }), props.children] }));
}
