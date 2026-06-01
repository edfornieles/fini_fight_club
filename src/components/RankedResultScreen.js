import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useGameStore } from "../state/gameStore";
import { BattleResultScreen } from "./BattleResultScreen";
import { LeaderboardPanel } from "./LeaderboardPanel";
import { MatchPreviewCard } from "./MatchPreviewCard";
export function RankedResultScreen() {
    const result = useGameStore((s) => s.battleResult);
    const liveA = useGameStore((s) => s.liveTeamA);
    const enemy = useGameStore((s) => s.enemyTeam);
    const onContinue = useGameStore((s) => s.continueAfterResult);
    const profile = useGameStore((s) => s.pvpProfile);
    const delta = useGameStore((s) => s.rankedDelta);
    const opponent = useGameStore((s) => s.currentOpponent);
    if (!result || !liveA || !enemy) {
        return _jsx("div", { className: "kcard p-4 text-inkSoft font-semibold", children: "Loading result\u2026" });
    }
    const playerWon = result.winner === "teamA";
    const deltaText = delta === null ? "" : delta >= 0 ? `+${delta}` : `${delta}`;
    // Pick a representative family from each team for the match card
    const familyA = (liveA.finis[0]?.family ?? "ETH");
    const familyB = (enemy.finis[0]?.family ?? "BTC");
    return (_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "grid sm:grid-cols-[200px_1fr] gap-4 items-center", children: [_jsx(MatchPreviewCard, { familyA: familyA, familyB: familyB, nameA: liveA.name, nameB: enemy.name, playerA: "You", playerB: opponent?.name ?? "rival", status: "completed", winner: playerWon ? "A" : "B" }), _jsxs("div", { className: "kcard p-5", style: {
                            boxShadow: playerWon
                                ? "0 0 0 3px rgba(95,214,164,0.5), 0 12px 28px -12px rgba(95,214,164,0.5)"
                                : "0 0 0 3px rgba(255,138,138,0.5), 0 12px 28px -12px rgba(255,138,138,0.5)",
                        }, children: [_jsxs("div", { className: "chip bg-grape/15 text-grape mb-1.5 w-fit", children: ["vs ", opponent?.name ?? "rival", opponent ? ` · ${opponent.rating} ELO` : ""] }), _jsx("h2", { className: "text-2xl font-display font-bold text-ink", children: playerWon ? "📈 You climb the ladder!" : "📉 You slip down the ladder." }), _jsxs("p", { className: "text-ink/70 text-sm mt-1 font-display font-semibold", children: ["Rating", " ", _jsx("span", { className: delta !== null && delta >= 0 ? "text-mintDark" : "text-coral", children: deltaText }), " ", "\u2192 ", _jsx("span", { className: "text-ink font-bold", children: profile.rating }), " ELO"] }), _jsx("button", { onClick: onContinue, className: `kbtn px-6 py-3 text-base mt-3 ${playerWon ? "kbtn-mint" : "kbtn-primary"}`, children: "Next match \u2192" })] })] }), _jsxs("div", { className: "grid lg:grid-cols-[1fr_280px] gap-3", children: [_jsx(BattleResultScreen, { result: result, playerTeam: liveA, opponentTeam: enemy, onPlayAgain: onContinue }), _jsx(LeaderboardPanel, {})] })] }));
}
