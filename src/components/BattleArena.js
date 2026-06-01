import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useGameStore } from "../state/gameStore";
import { ShopScreen } from "./ShopScreen";
import { EncounterScreen } from "./EncounterScreen";
import { BattleScreen } from "./BattleScreen";
import { RunResultScreen } from "./RunResultScreen";
import { RankedResultScreen } from "./RankedResultScreen";
import { GameOverScreen } from "./GameOverScreen";
import { VictoryScreen } from "./VictoryScreen";
import { RunHUD } from "./RunHUD";
/**
 * Top-level phase router. Each phase mounts its own screen.
 *
 *   title    -> TitleScreen
 *   shop     -> ShopScreen
 *   encounter-> EncounterScreen
 *   battle   -> BattleScreen (auto-starts the battle; Death Mode modal
 *               opens when mode==="DEATH")
 *   result   -> RunResultScreen (Continue advances stage)
 *   gameOver -> GameOverScreen
 *   victory  -> VictoryScreen
 */
export function BattleArena() {
    const phase = useGameStore((s) => s.phase);
    const isRanked = useGameStore((s) => s.isRanked);
    if (phase === "title") {
        return null;
    }
    if (phase === "gameOver") {
        return (_jsx("div", { className: "min-h-screen p-3 sm:p-5 max-w-[1400px] mx-auto", children: _jsx(GameOverScreen, {}) }));
    }
    if (phase === "victory") {
        return (_jsx("div", { className: "min-h-screen p-3 sm:p-5 max-w-[1400px] mx-auto", children: _jsx(VictoryScreen, {}) }));
    }
    return (_jsxs("div", { className: "min-h-screen p-3 sm:p-5 max-w-[1400px] mx-auto", children: [_jsx(RunHUD, {}), phase === "shop" && _jsx(ShopScreen, {}), phase === "encounter" && _jsx(EncounterScreen, {}), phase === "battle" && _jsx(BattleScreen, {}), phase === "result" && (isRanked ? _jsx(RankedResultScreen, {}) : _jsx(RunResultScreen, {}))] }));
}
