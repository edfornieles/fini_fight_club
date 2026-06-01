import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useGameStore } from "../state/gameStore";
import { ENCOUNTERS_PER_STAGE, FINAL_STAGE } from "../game/runConstants";
function Stat(props) {
    return (_jsxs("span", { className: "chip", style: { background: props.tint }, children: [_jsx("span", { children: props.icon }), _jsx("span", { className: "text-ink", children: props.value })] }));
}
export function RunHUD() {
    const lives = useGameStore((s) => s.lives);
    const gold = useGameStore((s) => s.gold);
    const trophies = useGameStore((s) => s.trophies);
    const stage = useGameStore((s) => s.stage);
    const stageProgress = useGameStore((s) => s.stageProgress);
    const exitToTitle = useGameStore((s) => s.exitToTitle);
    const isRanked = useGameStore((s) => s.isRanked);
    const profile = useGameStore((s) => s.pvpProfile);
    return (_jsxs("div", { className: "kcard px-4 py-2.5 flex items-center justify-between gap-3 mb-3", children: [_jsx("div", { className: "flex flex-wrap items-center gap-2 text-sm", children: isRanked ? (_jsxs(_Fragment, { children: [_jsxs("span", { className: "lcd px-3 py-1 text-sm", children: ["\u25C6 ", profile.rating] }), _jsx(Stat, { icon: "\uD83E\uDE99", value: gold, tint: "rgba(255,215,107,0.3)" }), _jsx(Stat, { icon: "\uD83C\uDFC5", value: `${profile.wins}W ${profile.losses}L`, tint: "rgba(124,200,255,0.25)" }), profile.streak !== 0 && (_jsx("span", { className: "chip", style: {
                                background: profile.streak > 0
                                    ? "rgba(95,214,164,0.3)"
                                    : "rgba(255,138,138,0.28)",
                            }, children: profile.streak > 0
                                ? `🔥 ${profile.streak}`
                                : `💧 ${-profile.streak}` }))] })) : (_jsxs(_Fragment, { children: [_jsx(Stat, { icon: "\uD83D\uDC96", value: lives, tint: "rgba(255,143,199,0.28)" }), _jsx(Stat, { icon: "\uD83E\uDE99", value: gold, tint: "rgba(255,215,107,0.32)" }), _jsx(Stat, { icon: "\uD83C\uDFC6", value: trophies, tint: "rgba(255,215,107,0.22)" }), _jsxs("span", { className: "chip bg-grape/15 text-ink", children: ["\u2728 Stage ", stage, "/", FINAL_STAGE, _jsxs("span", { className: "text-inkSoft", children: ["(", stageProgress, "/", ENCOUNTERS_PER_STAGE, ")"] })] })] })) }), _jsx("button", { onClick: exitToTitle, className: "kbtn kbtn-ghost text-xs px-3 py-1.5", children: "Exit" })] }));
}
