import { useGameStore } from "../state/gameStore";

export function GameOverScreen() {
  const trophies = useGameStore((s) => s.trophies);
  const stage = useGameStore((s) => s.stage);
  const start = useGameStore((s) => s.startNewRun);
  const exit = useGameStore((s) => s.exitToTitle);

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="kcard max-w-md w-full text-center space-y-5 p-8">
        <div className="flex justify-center">
          {/* sad kawaii — the market took them */}
          <img
            src="/sprites/kawaii_cat.gif"
            alt=""
            width={90}
            style={{ imageRendering: "pixelated", filter: "grayscale(0.6) brightness(0.85)", transform: "scaleX(-1)" }}
            className="opacity-80"
          />
        </div>
        <div className="chip bg-coral/20 text-coral mx-auto">game over</div>
        <h2 className="text-3xl font-display font-bold text-ink">
          The market took everything 😵
        </h2>
        <div className="text-ink/70 text-sm leading-relaxed font-semibold">
          Reached Stage <span className="font-display font-bold text-grape">{stage}</span>.
          Earned <span className="font-display font-bold text-btc">{trophies} 🏆</span>.
        </div>
        <div className="flex gap-2 justify-center pt-2">
          <button onClick={exit} className="kbtn kbtn-ghost px-5 py-2.5">
            Title
          </button>
          <button onClick={start} className="kbtn kbtn-primary px-6 py-2.5">
            🎀 New Run
          </button>
        </div>
      </div>
    </div>
  );
}
