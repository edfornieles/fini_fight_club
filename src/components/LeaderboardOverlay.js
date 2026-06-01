import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useUIStore } from "../state/uiStore";
import { LeaderboardPanel } from "./LeaderboardPanel";
export function LeaderboardOverlay() {
    const { leaderboardOpen, closeLeaderboard } = useUIStore();
    if (!leaderboardOpen)
        return null;
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-grape/25 backdrop-blur-sm p-3 sm:p-6", children: _jsxs("div", { className: "w-full max-w-2xl my-4 space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h2", { className: "font-display font-bold text-2xl text-ink drop-shadow-sm", children: "\uD83C\uDFC5 Leaderboard" }), _jsx("button", { onClick: closeLeaderboard, className: "kbtn kbtn-ghost px-3 py-1.5 text-sm", children: "\u2715 Close" })] }), _jsx(LeaderboardPanel, { limit: 20 })] }) }));
}
