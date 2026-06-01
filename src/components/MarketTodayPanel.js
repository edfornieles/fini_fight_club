import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useGameStore } from "../state/gameStore";
import { ALL_COIN_FAMILIES } from "../game/types";
import { FAMILY_COLOR } from "./familyColors";
const MOOD_EMOJI = {
    "Risk-on": "😻",
    "Risk-off": "😿",
    Volatile: "🌪️",
    Choppy: "😐",
};
const MOOD_TONE = {
    "Risk-on": "text-mintDark",
    "Risk-off": "text-coral",
    Volatile: "text-btc",
    Choppy: "text-inkSoft",
};
/**
 * The strategy layer made visible: today's market weather + the player's
 * pre-battle "call". Reading the regime and calling a family that pumps
 * is the skill that turns the market from luck into agency.
 */
export function MarketTodayPanel() {
    const regime = useGameStore((s) => s.dailyRegime);
    const marketMode = useGameStore((s) => s.marketMode);
    const setMarketMode = useGameStore((s) => s.setMarketMode);
    const marketLoading = useGameStore((s) => s.marketLoading);
    const marketError = useGameStore((s) => s.marketError);
    const marketRead = useGameStore((s) => s.marketRead);
    const setMarketRead = useGameStore((s) => s.setMarketRead);
    const hot = FAMILY_COLOR[regime.hotFamily];
    const cold = FAMILY_COLOR[regime.coldFamily];
    const moodTone = MOOD_TONE[regime.mood] ?? "text-inkSoft";
    const modes = ["MOCK", "LIVE"];
    return (_jsxs("div", { className: "kcard p-4 space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("div", { className: "label-soft", children: "\uD83D\uDD2E Today's Market" }), _jsx("div", { className: "flex items-center gap-1 bg-cloud/60 rounded-full p-0.5", children: modes.map((m) => (_jsx("button", { onClick: () => setMarketMode(m), className: `text-[10px] font-display font-bold rounded-full px-2.5 py-1 transition ${marketMode === m
                                ? "bg-grape text-white shadow-sm"
                                : "text-inkSoft hover:text-ink"}`, children: m === "LIVE" ? "Live" : "Sim" }, m))) })] }), _jsxs("div", { className: "lcd px-3 py-2 flex items-center justify-between", children: [_jsx("span", { className: "text-[11px] tracking-wide opacity-80", children: "MOOD" }), _jsxs("span", { className: `font-display font-bold ${moodTone} flex items-center gap-1`, children: [_jsx("span", { className: "text-base", children: MOOD_EMOJI[regime.mood] ?? "🪙" }), marketMode === "LIVE" && marketLoading ? "Loading…" : regime.mood, marketMode === "LIVE" && !marketError && !marketLoading && (_jsx("span", { className: "inline-block w-1.5 h-1.5 rounded-full bg-mint animate-pulse" }))] })] }), marketError && (_jsxs("div", { className: "text-[10px] text-coral font-semibold", children: ["Live feed napping (", marketError, "). Using simulated market."] })), _jsxs("div", { className: "grid grid-cols-2 gap-2 text-center", children: [_jsxs("div", { className: "kcard-soft py-2 !bg-mint/10 !border-mint/30", children: [_jsx("div", { className: "text-[9px] font-display font-bold tracking-wider text-inkSoft", children: "\uD83D\uDD25 running hot" }), _jsx("div", { className: "text-base font-display font-bold", style: { color: hot.hex }, children: regime.hotFamily })] }), _jsxs("div", { className: "kcard-soft py-2 !bg-coral/10 !border-coral/30", children: [_jsx("div", { className: "text-[9px] font-display font-bold tracking-wider text-inkSoft", children: "\uD83E\uDDCA running cold" }), _jsx("div", { className: "text-base font-display font-bold", style: { color: cold.hex }, children: regime.coldFamily })] })] }), _jsxs("div", { children: [_jsxs("div", { className: "text-[10px] font-display font-bold tracking-wide text-inkSoft mb-1.5", children: ["\uD83C\uDFAF Your call ", _jsx("span", { className: "text-bubble", children: "(+15% attack if it pumps)" })] }), _jsx("div", { className: "grid grid-cols-5 gap-1.5", children: ALL_COIN_FAMILIES.map((fam) => (_jsx(ReadButton, { family: fam, selected: marketRead === fam, onClick: () => setMarketRead(marketRead === fam ? null : fam) }, fam))) }), _jsx("div", { className: "text-[10px] text-inkSoft font-semibold mt-1.5 leading-relaxed", children: marketRead
                            ? `Calling ${marketRead} 💫 — if it's green at battle time, your whole team hits harder!`
                            : "Optional: call the family you think will pump. Read the weather above. 🌈" })] })] }));
}
function ReadButton(props) {
    const color = FAMILY_COLOR[props.family];
    return (_jsx("button", { onClick: props.onClick, className: `rounded-xl py-1.5 text-[10px] font-display font-bold transition-all ${props.selected
            ? "scale-110 ring-2 ring-bubble shadow-md"
            : "opacity-75 hover:opacity-100 hover:-translate-y-0.5"}`, style: { background: color.hex, color: "#fff", textShadow: "0 1px 1px rgba(0,0,0,0.25)" }, title: props.family, children: props.family }));
}
