import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useGameStore } from "../state/gameStore";
const TYPE_TONE = {
    FIGHT: {
        tint: "rgba(124,200,255,0.12)",
        ring: "#7cc8ff",
        tag: "Fight",
        chip: "bg-sky/25 text-sky",
        emoji: "⚔️",
    },
    BOSS_FIGHT: {
        tint: "rgba(255,138,138,0.14)",
        ring: "#ff8a8a",
        tag: "Boss",
        chip: "bg-coral/25 text-coral",
        emoji: "👑",
    },
    FOUND_COINS: {
        tint: "rgba(255,215,107,0.16)",
        ring: "#ffcf5c",
        tag: "Coins",
        chip: "bg-lemon/40 text-ink",
        emoji: "🪙",
    },
    VISIT_SHOP: {
        tint: "rgba(95,214,164,0.14)",
        ring: "#5fd6a4",
        tag: "Shop",
        chip: "bg-mint/25 text-mintDark",
        emoji: "🛍️",
    },
    REST: {
        tint: "rgba(124,200,255,0.12)",
        ring: "#74e2b1",
        tag: "Rest",
        chip: "bg-mint/20 text-mintDark",
        emoji: "🛌",
    },
    TREASURE: {
        tint: "rgba(185,140,255,0.14)",
        ring: "#b98cff",
        tag: "Treasure",
        chip: "bg-grape/25 text-grape",
        emoji: "🎁",
    },
    DEATH_MATCH: {
        tint: "rgba(240,89,90,0.16)",
        ring: "#f0595a",
        tag: "Death Match",
        chip: "bg-coral/30 text-coral",
        emoji: "💀",
    },
};
export function EncounterScreen() {
    const stage = useGameStore((s) => s.stage);
    const options = useGameStore((s) => s.encounterOptions);
    const pick = useGameStore((s) => s.pickEncounter);
    return (_jsxs("div", { className: "min-h-[60vh] flex flex-col items-center justify-center px-4 py-8", children: [_jsxs("div", { className: "text-center mb-6", children: [_jsxs("div", { className: "chip bg-grape/15 text-grape mx-auto mb-2", children: ["\u2728 Stage ", stage] }), _jsx("h2", { className: "text-3xl sm:text-4xl font-display font-bold text-ink", children: "Where to next? \uD83D\uDDFA\uFE0F" })] }), _jsx("div", { className: "grid sm:grid-cols-3 gap-3 w-full max-w-3xl", children: options.map((opt) => (_jsx(EncounterCard, { encounter: opt, onPick: () => pick(opt.id) }, opt.id))) }), _jsx("div", { className: "mt-6 text-[11px] text-inkSoft max-w-md text-center font-semibold leading-relaxed", children: "\uD83D\uDCA1 Death Match is simulated only in MVP \u2014 no real NFT transfer. Shop and Rest let you stretch your gold and hearts between fights." })] }));
}
function EncounterCard(props) {
    const tone = TYPE_TONE[props.encounter.type];
    return (_jsxs("button", { onClick: props.onPick, className: "kcard text-left p-4 h-full flex flex-col transition-all hover:-translate-y-1.5 hover:shadow-puff", style: { background: tone.tint, boxShadow: `0 0 0 2px ${tone.ring}44` }, children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("span", { className: "text-3xl", children: tone.emoji }), _jsx("span", { className: `chip text-[10px] ${tone.chip}`, children: tone.tag })] }), _jsx("div", { className: "font-display font-bold text-lg text-ink", children: props.encounter.label }), _jsx("div", { className: "text-ink/70 text-sm mt-1 leading-relaxed flex-1 font-semibold", children: props.encounter.description })] }));
}
