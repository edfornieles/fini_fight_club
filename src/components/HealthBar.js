import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
export function HealthBar(props) {
    const { current, max, colorHex, fainted, height = 11 } = props;
    const pct = Math.max(0, Math.min(100, (current / max) * 100));
    const [flash, setFlash] = useState(false);
    const prev = useRef(current);
    useEffect(() => {
        if (current < prev.current) {
            setFlash(true);
            const t = window.setTimeout(() => setFlash(false), 250);
            return () => clearTimeout(t);
        }
        prev.current = current;
    }, [current]);
    // Low HP reads as "sick" — drift toward coral when the bar gets low.
    const low = pct <= 30 && !fainted;
    const fill = fainted
        ? "#d9c7d6"
        : low
            ? "linear-gradient(90deg, #ff9d9d, #ff7d7d)"
            : `linear-gradient(90deg, ${colorHex}, ${colorHex})`;
    return (_jsx("div", { className: "w-full rounded-full overflow-hidden relative", style: {
            height,
            background: "#f0e6f3",
            boxShadow: "inset 0 1px 3px rgba(150,120,180,0.25)",
        }, children: _jsx("div", { className: "h-full rounded-full transition-all duration-300", style: {
                width: `${pct}%`,
                background: fill,
                boxShadow: flash
                    ? "0 0 10px rgba(255,255,255,0.9)"
                    : "inset 0 2px 2px rgba(255,255,255,0.45)",
                opacity: fainted ? 0.6 : 1,
            } }) }));
}
