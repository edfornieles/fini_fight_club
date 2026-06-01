import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { FAMILY_COLOR } from "./familyColors";
/** Pick a mood from a health ratio (0..1) — the Finiliar way: buoyant
 * when healthy, sad/sick when low, fainted when gone. */
export function moodFromHp(ratio, fainted) {
    if (fainted || ratio <= 0)
        return "ko";
    if (ratio > 0.6)
        return "happy";
    if (ratio > 0.3)
        return "ok";
    return "sad";
}
/**
 * A cute Finiliar-style face: a soft round body in its coin-family
 * colour with big sparkly eyes, blush, and a mood-driven mouth.
 * Pure SVG so it scales crisply and animates cheaply.
 */
export function FiniAvatar(props) {
    const { family, size = 44, mood = "happy", wobble, className } = props;
    const hex = FAMILY_COLOR[family].hex;
    return (_jsxs("svg", { width: size, height: size, viewBox: "0 0 100 100", className: `${wobble ? "animate-wobble" : ""} ${className ?? ""}`, style: { overflow: "visible" }, "aria-hidden": true, children: [_jsx("defs", { children: _jsxs("radialGradient", { id: `body-${family}`, cx: "38%", cy: "30%", r: "80%", children: [_jsx("stop", { offset: "0%", stopColor: "#ffffff", stopOpacity: "0.65" }), _jsx("stop", { offset: "42%", stopColor: hex, stopOpacity: "1" }), _jsx("stop", { offset: "100%", stopColor: hex, stopOpacity: "1" })] }) }), _jsx("ellipse", { cx: "50", cy: "92", rx: "26", ry: "6", fill: "rgba(120,90,150,0.18)" }), _jsx("path", { d: "M50 8\n           C74 8 90 26 90 50\n           C90 76 74 92 50 92\n           C26 92 10 76 10 50\n           C10 26 26 8 50 8 Z", fill: `url(#body-${family})`, stroke: "rgba(70,40,90,0.18)", strokeWidth: "2" }), mood !== "ko" && (_jsxs(_Fragment, { children: [_jsx("ellipse", { cx: "28", cy: "60", rx: "8", ry: "5", fill: "#ff8fc7", opacity: "0.55" }), _jsx("ellipse", { cx: "72", cy: "60", rx: "8", ry: "5", fill: "#ff8fc7", opacity: "0.55" })] })), mood === "ko" ? (_jsxs("g", { stroke: "#3a2b48", strokeWidth: "4", strokeLinecap: "round", children: [_jsx("line", { x1: "30", y1: "42", x2: "40", y2: "52" }), _jsx("line", { x1: "40", y1: "42", x2: "30", y2: "52" }), _jsx("line", { x1: "60", y1: "42", x2: "70", y2: "52" }), _jsx("line", { x1: "70", y1: "42", x2: "60", y2: "52" })] })) : (_jsxs(_Fragment, { children: [_jsx("ellipse", { cx: "36", cy: "46", rx: "8.5", ry: "10", fill: "#fff" }), _jsx("ellipse", { cx: "64", cy: "46", rx: "8.5", ry: "10", fill: "#fff" }), _jsx("circle", { cx: mood === "sad" ? 36 : 37, cy: mood === "sad" ? 49 : 48, r: "4.6", fill: "#3a2b48" }), _jsx("circle", { cx: mood === "sad" ? 64 : 65, cy: mood === "sad" ? 49 : 48, r: "4.6", fill: "#3a2b48" }), _jsx("circle", { cx: mood === "sad" ? 34.5 : 35.3, cy: mood === "sad" ? 47 : 46, r: "1.7", fill: "#fff" }), _jsx("circle", { cx: mood === "sad" ? 62.5 : 63.3, cy: mood === "sad" ? 47 : 46, r: "1.7", fill: "#fff" })] })), mood === "happy" && (_jsx("path", { d: "M40 64 Q50 74 60 64", fill: "none", stroke: "#3a2b48", strokeWidth: "3.2", strokeLinecap: "round" })), mood === "ok" && (_jsx("path", { d: "M42 67 Q50 70 58 67", fill: "none", stroke: "#3a2b48", strokeWidth: "3.2", strokeLinecap: "round" })), mood === "sad" && (_jsx("path", { d: "M41 70 Q50 62 59 70", fill: "none", stroke: "#3a2b48", strokeWidth: "3.2", strokeLinecap: "round" })), mood === "ko" && (_jsx("path", { d: "M41 70 Q50 64 59 70", fill: "none", stroke: "#3a2b48", strokeWidth: "3", strokeLinecap: "round" }))] }));
}
