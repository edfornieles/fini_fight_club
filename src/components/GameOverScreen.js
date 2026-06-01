import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useGameStore } from "../state/gameStore";
export function GameOverScreen() {
    const trophies = useGameStore((s) => s.trophies);
    const stage = useGameStore((s) => s.stage);
    const start = useGameStore((s) => s.startNewRun);
    const exit = useGameStore((s) => s.exitToTitle);
    return (_jsx("div", { className: "min-h-[80vh] flex items-center justify-center px-4", children: _jsxs("div", { className: "kcard max-w-md w-full text-center space-y-5 p-8", children: [_jsx("div", { className: "flex justify-center", children: _jsx("img", { src: "/sprites/kawaii_cat.gif", alt: "", width: 90, style: { imageRendering: "pixelated", filter: "grayscale(0.6) brightness(0.85)", transform: "scaleX(-1)" }, className: "opacity-80" }) }), _jsx("div", { className: "chip bg-coral/20 text-coral mx-auto", children: "game over" }), _jsx("h2", { className: "text-3xl font-display font-bold text-ink", children: "The market took everything \uD83D\uDE35" }), _jsxs("div", { className: "text-ink/70 text-sm leading-relaxed font-semibold", children: ["Reached Stage ", _jsx("span", { className: "font-display font-bold text-grape", children: stage }), ". Earned ", _jsxs("span", { className: "font-display font-bold text-btc", children: [trophies, " \uD83C\uDFC6"] }), "."] }), _jsxs("div", { className: "flex gap-2 justify-center pt-2", children: [_jsx("button", { onClick: exit, className: "kbtn kbtn-ghost px-5 py-2.5", children: "Title" }), _jsx("button", { onClick: start, className: "kbtn kbtn-primary px-6 py-2.5", children: "\uD83C\uDF80 New Run" })] })] }) }));
}
