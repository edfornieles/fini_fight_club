import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useMemo, useState } from "react";
import { normalizeAddress, resolveProvider } from "../game/wallet";
import { traitsToStats, SPECIAL_PERKS, MYTHICAL_PERKS } from "../game/attributes";
import { FiniMedia } from "./FiniMedia";
import { FAMILY_COLOR } from "./familyColors";
const EXAMPLE_WALLET = "0xff3dc70f41c60008ea17b03dcbad843abec43ea3";
function shortAddr(a) {
    return `${a.slice(0, 6)}…${a.slice(-4)}`;
}
function moodFromDelta(delta) {
    if (delta > 0.02)
        return "happy";
    if (delta >= -0.02)
        return "ok";
    if (delta > -0.1)
        return "sad";
    return "ko";
}
/**
 * Read-only wallet roster: paste an address, see the Finis it owns (pulled
 * keyless from the prebuilt ownership snapshot + live Finiliar metadata), and
 * pick up to 3. No signing, no transfers — just ownership-gated team building.
 */
export function WalletRosterPanel(props) {
    const [address, setAddress] = useState(EXAMPLE_WALLET);
    const [roster, setRoster] = useState(null);
    const [loadedAddr, setLoadedAddr] = useState(null);
    const [providerId, setProviderId] = useState(null);
    const [selected, setSelected] = useState([]);
    const [status, setStatus] = useState("idle");
    const [error, setError] = useState(null);
    const valid = useMemo(() => normalizeAddress(address) != null, [address]);
    const load = useCallback(async () => {
        const addr = normalizeAddress(address);
        if (!addr) {
            setStatus("error");
            setError("That doesn't look like a wallet address (0x + 40 hex).");
            return;
        }
        setStatus("loading");
        setError(null);
        setSelected([]);
        setRoster(null);
        try {
            const provider = await resolveProvider({ verifyOnChain: props.verifyOnChain });
            setProviderId(provider.id);
            const finis = await provider.getRoster(addr);
            setRoster(finis);
            setLoadedAddr(addr);
            if (finis.length === 0) {
                setError("No Finis found for this wallet in the current snapshot.");
            }
        }
        catch (e) {
            setStatus("error");
            setError(e instanceof Error ? e.message : "Failed to load roster.");
            return;
        }
        setStatus("idle");
    }, [address, props.verifyOnChain]);
    const toggle = useCallback((tokenId) => {
        setSelected((prev) => {
            if (prev.includes(tokenId))
                return prev.filter((t) => t !== tokenId);
            if (prev.length >= 3)
                return prev;
            return [...prev, tokenId];
        });
    }, []);
    const confirm = useCallback(() => {
        if (!roster || selected.length !== 3 || !loadedAddr)
            return;
        const picked = selected
            .map((id) => roster.find((f) => f.tokenId === id))
            .filter((f) => !!f);
        props.onConfirm?.(picked, loadedAddr);
    }, [roster, selected, loadedAddr, props]);
    return (_jsxs("div", { className: "kcard p-4 space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("div", { className: "label-soft", children: "\uD83D\uDC5B Your Finiliar Stable" }), providerId && (_jsx("span", { className: "chip bg-grape/15 text-grape text-[10px]", children: providerId === "snapshot"
                            ? "📸 snapshot"
                            : providerId === "live"
                                ? "⛓ live"
                                : "🎲 demo" }))] }), _jsxs("div", { className: "flex flex-col sm:flex-row gap-2", children: [_jsx("input", { value: address, onChange: (e) => setAddress(e.target.value), onKeyDown: (e) => e.key === "Enter" && load(), spellCheck: false, placeholder: "0x\u2026 wallet address", className: "flex-1 rounded-2xl border-2 border-cloud bg-white/80 px-3 py-2 text-sm font-mono text-ink outline-none focus:border-grape/60" }), _jsx("button", { onClick: load, disabled: !valid || status === "loading", className: "kbtn kbtn-primary px-4 py-2 text-sm disabled:opacity-50", children: status === "loading" ? "✨ Summoning…" : "Load roster" })] }), error && (_jsxs("div", { className: "chip bg-coral/15 text-coral", children: ["\u26A0\uFE0F ", error] })), roster && roster.length > 0 && loadedAddr && (_jsxs("div", { className: "flex items-center justify-between flex-wrap gap-2", children: [_jsxs("div", { className: "text-sm text-inkSoft font-semibold", children: [_jsx("span", { className: "font-mono text-ink", children: shortAddr(loadedAddr) }), " owns", " ", _jsx("span", { className: "text-bubbleDark font-display font-bold", children: roster.length }), " Fini", roster.length === 1 ? "" : "s"] }), _jsxs("span", { className: "lcd px-3 py-1 text-xs", children: [selected.length, " / 3 chosen"] })] })), roster && roster.length > 0 && (_jsx("div", { className: "flex flex-col gap-2 max-h-[52vh] overflow-y-auto -mx-1 px-1", children: roster.map((f) => (_jsx(FiniSelectRow, { fini: f, selected: selected.includes(f.tokenId), dimmed: selected.length >= 3 && !selected.includes(f.tokenId), onClick: () => toggle(f.tokenId) }, f.tokenId))) })), status === "loading" && (_jsx("div", { className: "flex flex-col gap-2", children: Array.from({ length: 6 }).map((_, i) => (_jsx("div", { className: "h-[78px] rounded-2xl bg-cloud/50 animate-pulse" }, i))) })), roster && roster.length > 0 && props.onConfirm && (_jsxs("div", { className: "flex items-center justify-between pt-1", children: [_jsx("div", { className: "text-xs text-inkSoft font-semibold", children: selected.length < 3
                            ? `Pick ${3 - selected.length} more to field a team`
                            : "Team ready! 🎀" }), _jsx("button", { onClick: confirm, disabled: selected.length !== 3, className: "kbtn kbtn-mint px-4 py-2 text-sm disabled:opacity-50", children: "Field these 3 \u2694\uFE0F" })] }))] }));
}
/**
 * The Finiliar "Select your fini" row: a split pill with the pastel family
 * tint + coin glyph + name + live delta on the left, and the 3D render in a
 * deeper family swatch on the right. Mirrors the product mockups.
 */
function FiniSelectRow(props) {
    const { fini, selected, dimmed } = props;
    const color = FAMILY_COLOR[fini.traits.family];
    const mood = moodFromDelta(fini.latestDelta);
    const deltaPct = Math.abs(fini.latestDelta * 100).toFixed(2);
    const up = fini.latestDelta > 0;
    const flat = Math.abs(fini.latestDelta) < 0.0001;
    // Resolve the scarce perk (if any) so we can badge it. Deterministic + cheap.
    const stats = traitsToStats(fini.traits);
    const perk = stats.mythicalPerk
        ? { kind: "mythical", def: MYTHICAL_PERKS[stats.mythicalPerk] }
        : stats.specialPerk
            ? { kind: "special", def: SPECIAL_PERKS[stats.specialPerk] }
            : null;
    const swatchBg = fini.artwork.background ?? color.swatch;
    return (_jsxs("button", { onClick: props.onClick, className: `w-full h-[80px] rounded-2xl overflow-hidden flex items-stretch text-left transition-all relative ${dimmed ? "opacity-45" : "hover:-translate-y-0.5"}`, style: {
            boxShadow: selected
                ? "0 0 0 3px #5fd6a4, 0 12px 26px -12px rgba(95,214,164,0.6)"
                : "0 8px 18px -14px rgba(0,0,0,0.35)",
        }, children: [_jsxs("div", { className: "flex-1 min-w-0 px-3.5 py-2 flex flex-col justify-center gap-1 leading-tight", style: { background: color.soft }, children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "w-7 h-7 rounded-full bg-ink text-white flex items-center justify-center text-[13px] font-bold shrink-0", children: color.glyph }), _jsx("span", { className: "font-display font-bold text-ink text-[15px] truncate", children: color.label }), perk && (_jsxs("span", { className: `chip text-[9px] px-1.5 font-bold shrink-0 ${perk.kind === "mythical" ? "bg-lemon/90 text-ink" : "bg-grape/85 text-white"}`, title: `${perk.def.displayName} — ${perk.def.description}`, children: [perk.kind === "mythical" ? "★" : "◆", " ", perk.def.displayName] }))] }), _jsxs("div", { className: "flex items-center gap-1.5 text-[11px] min-w-0", children: [_jsxs("span", { className: `font-display font-bold shrink-0 ${flat ? "text-inkSoft" : up ? "text-mintDark" : "text-coral"}`, children: [flat ? "■" : up ? "▲" : "▼", " ", deltaPct, "%"] }), _jsxs("span", { className: "text-inkSoft font-semibold truncate", title: fini.traits.clan, children: ["\u00B7 #", fini.tokenId, " \u00B7 ", fini.traits.clan] })] })] }), _jsxs("div", { className: "w-[104px] shrink-0 flex items-center justify-center overflow-hidden relative", style: { background: swatchBg }, children: [_jsx(FiniMedia, { artwork: fini.artwork, family: fini.traits.family, mood: mood, animate: !dimmed }), selected && (_jsx("div", { className: "absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-mint text-white flex items-center justify-center text-[11px] font-bold shadow", children: "\u2713" }))] })] }));
}
