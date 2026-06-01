import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { FAMILY_COLOR } from "./familyColors";
import { FiniAvatar, moodFromHp } from "./FiniAvatar";
/**
 * Battle stage — 2D, lightweight.
 *
 * Replaces the old React-Three-Fiber/Three.js stage. The 3D stack
 * (three + three-stdlib + @react-three/* + stats-gl) was ~5GB of node_modules
 * and the dominant bundle weight, all for one placeholder scene — while the
 * Finiliar product design is 2D. This renders the signature diagonal
 * "lightning-split" arena with the kawaii FiniAvatar faces instead.
 *
 * PUBLIC API is unchanged so BattleScreen needs no edits. When the polished
 * fini artwork is wired up, swap FiniAvatar for FiniMedia here.
 */
export function ThreeBattleStage(props) {
    const { teamA, teamB, animA, animB, activeAId, activeBId } = props;
    const a = pickActive(teamA, activeAId);
    const b = pickActive(teamB, activeBId);
    const colorA = a ? FAMILY_COLOR[a.family].hex : "#ff9bb0";
    const colorB = b ? FAMILY_COLOR[b.family].hex : "#7fd8c8";
    return (_jsxs("div", { className: "relative aspect-[16/9] w-full overflow-hidden rounded-3xl border-2 border-white shadow-puff", style: { background: `linear-gradient(110deg, ${tint(colorA)} 0 49%, ${tint(colorB)} 51% 100%)` }, children: [_jsx("div", { className: "absolute inset-y-0 left-1/2 -translate-x-1/2 w-[8%]", style: {
                    background: "#fff",
                    clipPath: "polygon(40% 0, 60% 0, 48% 32%, 66% 32%, 38% 100%, 50% 52%, 34% 52%)",
                    filter: "drop-shadow(0 0 6px rgba(255,255,255,0.8))",
                } }), _jsx(Fighter, { fini: a, anim: animA, side: "left" }), _jsx(Fighter, { fini: b, anim: animB, side: "right" })] }));
}
function Fighter({ fini, anim, side, }) {
    if (!fini)
        return null;
    const mood = moodFromHp(fini.maxHealth ? fini.currentHealth / fini.maxHealth : 1, fini.fainted);
    return (_jsxs("div", { className: `absolute bottom-[14%] flex flex-col items-center gap-1 ${side === "left" ? "left-[14%]" : "right-[14%]"}`, style: animStyle(anim, side), children: [_jsx(FiniAvatar, { family: fini.family, size: 120, mood: mood, wobble: anim === "idle" }), _jsx("span", { className: "chip bg-white/85 text-ink text-[11px] font-bold px-2 shadow-sm", children: fini.name })] }));
}
function pickActive(team, activeId) {
    if (!team)
        return undefined;
    return team.finis.find((f) => f.id === activeId) ?? team.finis.find((f) => !f.fainted);
}
/** Pale tint of a hex for the arena half-backgrounds. */
function tint(hex) {
    return `${hex}33`;
}
/** Map an animation state to a CSS transform — lunge, recoil, faint, pop. */
function animStyle(anim, side) {
    const toCenter = side === "left" ? 28 : -28;
    const base = { transition: "transform 0.22s cubic-bezier(0.34,1.56,0.64,1)" };
    switch (anim) {
        case "attack":
            return { ...base, transform: `translateX(${toCenter}px) scale(1.06)` };
        case "hit":
            return { ...base, transform: `translateX(${-toCenter / 3}px) rotate(${side === "left" ? -6 : 6}deg)` };
        case "faint":
            return { ...base, transform: "translateY(14px) rotate(12deg)", opacity: 0.5 };
        case "enter":
            return { ...base, transform: "scale(1.0)", animation: "rise 0.4s ease both" };
        case "celebrate":
            return { ...base, transform: "translateY(-8px) scale(1.05)" };
        default:
            return base;
    }
}
