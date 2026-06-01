import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useGameStore } from "../state/gameStore";
import { BattleResultScreen } from "./BattleResultScreen";
import { GOLD_REWARD_PER_BOSS_WIN, GOLD_REWARD_PER_FIGHT_WIN, } from "../game/runConstants";
export function RunResultScreen() {
    const result = useGameStore((s) => s.battleResult);
    const liveA = useGameStore((s) => s.liveTeamA);
    const enemy = useGameStore((s) => s.enemyTeam);
    const onContinue = useGameStore((s) => s.continueAfterResult);
    const currentEncounter = useGameStore((s) => s.currentEncounter);
    const lives = useGameStore((s) => s.lives);
    if (!result || !liveA || !enemy) {
        return (_jsx("div", { className: "kcard p-4 text-inkSoft font-semibold", children: "Loading result\u2026" }));
    }
    const playerWon = result.winner === "teamA";
    const isBoss = currentEncounter?.type === "BOSS_FIGHT";
    const goldDelta = playerWon
        ? isBoss
            ? GOLD_REWARD_PER_BOSS_WIN
            : GOLD_REWARD_PER_FIGHT_WIN
        : 0;
    return (_jsxs("div", { className: "space-y-3", children: [_jsx("div", { className: "kcard p-5", style: {
                    boxShadow: playerWon
                        ? "0 0 0 3px rgba(95,214,164,0.5), 0 12px 28px -12px rgba(95,214,164,0.5)"
                        : "0 0 0 3px rgba(255,138,138,0.5), 0 12px 28px -12px rgba(255,138,138,0.5)",
                }, children: _jsxs("div", { className: "flex items-center justify-between flex-wrap gap-3", children: [_jsxs("div", { children: [_jsx("div", { className: "chip bg-grape/15 text-grape mb-1.5", children: currentEncounter?.label ?? "Encounter" }), _jsx("h2", { className: "text-3xl font-display font-bold text-ink", children: playerWon ? "💚 You hold the line!" : "💔 You lose a heart." }), _jsx("p", { className: "text-ink/70 text-sm mt-1 font-display font-semibold", children: playerWon
                                        ? `+${goldDelta}🪙 gold${isBoss ? " · +1 🏆 trophy" : ""}`
                                        : `Hearts left: ${"💖".repeat(Math.max(0, lives))} (${lives})` })] }), _jsx("button", { onClick: onContinue, className: `kbtn px-6 py-3 text-base ${playerWon ? "kbtn-mint" : "kbtn-primary"}`, children: "Continue \u2192" })] }) }), _jsx(BattleResultScreen, { result: result, playerTeam: liveA, opponentTeam: enemy, onPlayAgain: onContinue })] }));
}
