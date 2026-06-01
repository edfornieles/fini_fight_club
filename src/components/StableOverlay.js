import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { useUIStore } from "../state/uiStore";
import { WalletRosterPanel } from "./WalletRosterPanel";
import { ownedFinisToBattleFinis } from "../game/wallet";
import { traitsToStats, getFamilyArchetype, countSpecialFinis, SPECIAL_PERKS, MYTHICAL_PERKS, } from "../game/attributes";
import { useGameStore } from "../state/gameStore";
import { FAMILY_COLOR } from "./familyColors";
/**
 * Self-contained entry point for the wallet-ownership roster. A floating button
 * opens an overlay with the read-only stable. Kept separate from the run/phase
 * screens so the ownership work doesn't collide with the in-flux UI + store.
 *
 * When the player confirms 3 owned Finis, we currently just surface them; wiring
 * the chosen roster into a real ranked team is the next integration step (after
 * the attributes stream's `traitsToStats()` lands).
 */
export function StableOverlay() {
    const { stableOpen, closeStable } = useUIStore();
    const [open, setOpen] = useState(false);
    // sync with uiStore
    useEffect(() => { if (stableOpen)
        setOpen(true); }, [stableOpen]);
    const handleClose = () => { setOpen(false); closeStable(); };
    const [picked, setPicked] = useState(null);
    const [wallet, setWallet] = useState("");
    const [error, setError] = useState(null);
    const fieldOwnedTeam = useGameStore((s) => s.fieldOwnedTeam);
    const clearOwnedTeam = useGameStore((s) => s.clearOwnedTeam);
    const savedTeam = useGameStore((s) => s.savedOwnedTeam);
    const battleFinis = picked ? ownedFinisToBattleFinis(picked) : [];
    const specialCount = countSpecialFinis(battleFinis);
    const tooManySpecials = specialCount > 1;
    const enterRanked = () => {
        if (!picked || picked.length === 0)
            return;
        const err = fieldOwnedTeam(battleFinis, wallet || undefined);
        if (err) {
            setError(err);
            return;
        }
        setError(null);
        setOpen(false);
        setPicked(null);
    };
    const reEnterSaved = () => {
        if (!savedTeam)
            return;
        // Re-field the already-built battle Finis directly — no wallet reload.
        fieldOwnedTeam(savedTeam.finis, savedTeam.wallet || undefined);
        setOpen(false);
    };
    return (_jsx(_Fragment, { children: open && (_jsx("div", { className: "fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-grape/25 backdrop-blur-sm p-3 sm:p-6", children: _jsxs("div", { className: "w-full max-w-4xl my-4 space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h2", { className: "font-display font-bold text-2xl text-ink drop-shadow-sm", children: "The Stable" }), _jsx("button", { onClick: handleClose, className: "kbtn kbtn-ghost px-3 py-1.5 text-sm", children: "\u2715 Close" })] }), savedTeam && savedTeam.finis.length > 0 && (_jsxs("div", { className: "kcard p-4 space-y-2.5", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("div", { className: "label-soft", children: "\uD83C\uDFC6 Your fielded team" }), savedTeam.wallet && (_jsxs("span", { className: "chip bg-grape/15 text-grape text-[10px] font-mono", children: [savedTeam.wallet.slice(0, 6), "\u2026", savedTeam.wallet.slice(-4)] }))] }), _jsx("div", { className: "flex flex-wrap gap-1.5", children: savedTeam.finis.map((f) => (_jsxs("span", { className: "chip bg-bubble/15 text-bubbleDark text-[11px]", children: [f.name, " \u00B7 ", f.family, " #", f.tokenId] }, f.id))) }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: reEnterSaved, className: "kbtn kbtn-primary flex-1 py-2 text-sm", children: "\u2694\uFE0F Re-enter Ranked" }), _jsx("button", { onClick: clearOwnedTeam, className: "kbtn kbtn-ghost px-3 py-2 text-sm", title: "Forget this team", children: "\uD83D\uDDD1 Forget" })] })] })), _jsx(WalletRosterPanel, { onConfirm: (finis, addr) => {
                            setPicked(finis);
                            setWallet(addr);
                            setError(null);
                        } }), picked && picked.length > 0 && (_jsxs("div", { className: "kcard p-4 space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("div", { className: "label-soft", children: "\uD83C\uDF80 Your battle team" }), _jsx("span", { className: "chip bg-grape/15 text-grape text-[10px]", children: "stats from on-chain traits" })] }), _jsx("div", { className: "grid sm:grid-cols-3 gap-2", children: picked.map((f) => (_jsx(StatCard, { fini: f }, f.tokenId))) }), (tooManySpecials || error) && (_jsxs("div", { className: "chip bg-coral/15 text-coral w-full justify-center py-1.5", children: ["\u26A0\uFE0F ", error ?? "Only one Special or Mythical Fini per team."] })), _jsx("button", { onClick: enterRanked, disabled: tooManySpecials, className: "kbtn kbtn-primary w-full py-2.5 text-sm disabled:opacity-50", children: "\u2694\uFE0F Enter Ranked Battle" })] }))] }) })) }));
}
function StatCard(props) {
    const { fini } = props;
    const stats = traitsToStats(fini.traits);
    const color = FAMILY_COLOR[fini.traits.family];
    const archetype = getFamilyArchetype(fini.traits.family);
    const perk = stats.mythicalPerk
        ? MYTHICAL_PERKS[stats.mythicalPerk]
        : stats.specialPerk
            ? SPECIAL_PERKS[stats.specialPerk]
            : null;
    return (_jsxs("div", { className: "kcard-soft p-2.5 space-y-1.5", children: [_jsxs("div", { className: "flex items-center justify-between gap-1", children: [_jsx("span", { className: `chip ${color.bg} text-white text-[10px] px-1.5`, children: fini.traits.family }), _jsx("span", { className: "text-[10px] text-inkSoft font-semibold", children: archetype })] }), _jsxs("div", { className: "grid grid-cols-4 gap-1 text-center", children: [_jsx(Stat, { label: "STR", value: stats.strength }), _jsx(Stat, { label: "HP", value: stats.maxHealth }), _jsx(Stat, { label: "SPD", value: stats.speed }), _jsx(Stat, { label: "DEF", value: stats.defense })] }), _jsxs("div", { className: "text-[10px] text-inkSoft font-semibold truncate", title: stats.passiveAbility, children: ["\u2726 ", stats.passiveAbility.replace(/_/g, " ").toLowerCase()] }), perk && (_jsxs("div", { className: `chip text-[10px] ${stats.mythicalPerk ? "bg-lemon/30 text-ink" : "bg-bubble/15 text-bubbleDark"}`, title: perk.description, children: [stats.mythicalPerk ? "★ " : "◆ ", perk.displayName] }))] }));
}
function Stat(props) {
    return (_jsxs("div", { className: "lcd px-1 py-1 leading-none", children: [_jsx("div", { className: "text-[8px] text-inkSoft", children: props.label }), _jsx("div", { className: "text-sm font-display font-bold text-ink", children: props.value })] }));
}
