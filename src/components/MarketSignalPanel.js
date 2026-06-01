import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { FAMILY_COLOR } from "./familyColors";
export function MarketSignalPanel(props) {
    const { signals, highlight, predictedFamily, source } = props;
    const families = Object.keys(signals).sort((a, b) => {
        const aHi = highlight?.includes(a) ? 1 : 0;
        const bHi = highlight?.includes(b) ? 1 : 0;
        return bHi - aHi;
    });
    return (_jsxs("div", { className: "kcard p-4", children: [_jsxs("div", { className: "flex items-center justify-between mb-2.5", children: [_jsx("div", { className: "label-soft", children: "\uD83D\uDCC8 Market Mood" }), source === "LIVE" && (_jsxs("span", { className: "chip bg-mint/20 text-mintDark text-[10px]", children: [_jsx("span", { className: "w-1.5 h-1.5 rounded-full bg-mint animate-pulse" }), "live"] }))] }), _jsx("div", { className: "grid grid-cols-2 gap-1.5 sm:grid-cols-1", children: families.map((fam) => {
                    const sig = signals[fam];
                    const color = FAMILY_COLOR[fam];
                    const up = sig.direction === "up";
                    const down = sig.direction === "down";
                    const dirColor = up ? "text-mintDark" : down ? "text-coral" : "text-inkSoft";
                    const pct = sig.percentChange.toFixed(2);
                    const sign = sig.percentChange > 0 ? "+" : "";
                    const isHighlighted = highlight?.includes(fam);
                    const isCalled = predictedFamily === fam;
                    return (_jsxs("div", { className: `flex items-center justify-between gap-2 rounded-xl px-2 py-1.5 transition ${isCalled
                            ? "bg-bubble/10 ring-2 ring-bubble/50"
                            : isHighlighted
                                ? "bg-grape/10"
                                : ""}`, children: [_jsx("div", { className: "w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-display font-bold", style: { background: color.hex, color: "#fff", textShadow: "0 1px 1px rgba(0,0,0,0.25)" }, children: fam }), _jsxs("div", { className: "flex-1 text-xs font-display font-semibold text-ink", children: [fam, isCalled && _jsx("span", { className: "ml-1 text-bubble", title: "Your call", children: "\u2605" })] }), _jsxs("div", { className: `text-xs font-display font-bold ${dirColor}`, children: [up ? "▲" : down ? "▼" : "■", " ", sign, pct, "%"] }), _jsx("div", { className: "w-10", children: _jsx("div", { className: "h-1.5 rounded-full bg-cloud", children: _jsx("div", { className: "h-1.5 rounded-full", style: {
                                            width: `${Math.round(sig.volatility * 100)}%`,
                                            background: sig.volatility > 0.6 ? "#ff7d7d" : "#b98cff",
                                        } }) }) })] }, fam));
                }) }), _jsx("div", { className: "text-[10px] text-inkSoft font-semibold mt-2", children: "Volatility bar shows the chaos pressure on each family. \uD83C\uDF0A" })] }));
}
