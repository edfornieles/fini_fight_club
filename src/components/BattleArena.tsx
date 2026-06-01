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
    return (
      <div className="min-h-screen p-3 sm:p-5 max-w-[1400px] mx-auto">
        <GameOverScreen />
      </div>
    );
  }

  if (phase === "victory") {
    return (
      <div className="min-h-screen p-3 sm:p-5 max-w-[1400px] mx-auto">
        <VictoryScreen />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-3 sm:p-5 max-w-[1400px] mx-auto">
      <RunHUD />
      {phase === "shop" && <ShopScreen />}
      {phase === "encounter" && <EncounterScreen />}
      {phase === "battle" && <BattleScreen />}
      {phase === "result" && (isRanked ? <RankedResultScreen /> : <RunResultScreen />)}
    </div>
  );
}
