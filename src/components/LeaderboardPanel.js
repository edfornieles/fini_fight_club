import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useGameStore } from "../state/gameStore";
import { leaderboard } from "../game/pvp";
export function LeaderboardPanel(props) {
    const pool = useGameStore((s) => s.pvpPool);
    const profile = useGameStore((s) => s.pvpProfile);
    const rivals = pool.filter((s) => s.origin === "seed");
    const rows = leaderboard(rivals, { id: "__you__", name: profile.name, rating: profile.rating }, props.limit ?? 10);
    const podium = rows.slice(0, 3);
    const rest = rows.slice(3);
    const podiumOrder = [podium[1], podium[0], podium[2]].filter(Boolean);
    const podiumHeights = ["h-16", "h-20", "h-14"];
    const podiumBg = [
        "bg-inkSoft/20",
        "bg-amber-400/20 ring-2 ring-amber-400/50",
        "bg-orange-300/20",
    ];
    const podiumLabels = ["🥈", "🥇", "🥉"];
    return (_jsxs("div", { className: "kcard p-4 space-y-4", children: [_jsx("div", { className: "label-soft", children: "\uD83C\uDFC5 Ladder" }), podium.length >= 2 && (_jsx("div", { className: "flex items-end justify-center gap-2 pt-1", children: podiumOrder.map((row, i) => {
                    if (!row)
                        return null;
                    const originalIndex = podium.indexOf(row);
                    return (_jsxs("div", { className: "flex flex-col items-center gap-1 flex-1", children: [_jsx("span", { className: "text-lg leading-none", children: podiumLabels[i] }), _jsx("span", { className: `text-[10px] font-display font-bold truncate max-w-full px-1 ${row.isPlayer ? "text-sky" : "text-ink"}`, children: row.isPlayer ? "You" : row.name }), _jsx("span", { className: "lcd text-[10px] px-1.5 py-0.5", children: row.rating }), _jsx("div", { className: `w-full rounded-t-lg ${podiumHeights[i]} ${podiumBg[i]} flex items-center justify-center`, children: _jsx("span", { className: "font-display font-bold text-lg text-ink/40", children: originalIndex + 1 }) })] }, row.id));
                }) })), rest.length > 0 && (_jsx("div", { className: "space-y-1 border-t border-inkSoft/10 pt-2", children: rest.map((row, i) => (_jsxs("div", { className: `flex items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-sm ${row.isPlayer ? "bg-sky/20 ring-2 ring-sky/50" : ""}`, children: [_jsxs("div", { className: "flex items-center gap-2 min-w-0", children: [_jsx("span", { className: "w-5 text-center text-xs font-display font-bold text-inkSoft", children: i + 4 }), _jsx("span", { className: `truncate font-display font-semibold ${row.isPlayer ? "text-sky" : "text-ink"}`, children: row.isPlayer ? "💙 You" : row.name })] }), _jsx("span", { className: "lcd px-2 py-0.5 text-xs", children: row.rating })] }, row.id))) }))] }));
}
