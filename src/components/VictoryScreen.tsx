import { useGameStore } from "../state/gameStore";

export function VictoryScreen() {
  const trophies = useGameStore((s) => s.trophies);
  const lives = useGameStore((s) => s.lives);
  const start = useGameStore((s) => s.startNewRun);
  const exit = useGameStore((s) => s.exitToTitle);

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="kcard max-w-md w-full text-center space-y-5 p-8">
        <div className="flex justify-center gap-3">
          {/* pixel kawaii celebration parade */}
          {["/sprites/kawaii_bear.gif", "/sprites/kawaii_panda.gif", "/sprites/kawaii_skip.gif"].map((src, i) => (
            <div key={src} className="animate-bobby" style={{ animationDelay: `${i * 0.2}s` }}>
              <img
                src={src}
                alt=""
                width={68}
                style={{ imageRendering: "pixelated" }}
              />
            </div>
          ))}
        </div>
        <div className="chip bg-mint/20 text-mintDark mx-auto">🎉 victory 🎉</div>
        <h2 className="text-3xl font-display font-bold text-ink">
          You survived the market!
        </h2>
        <div className="text-ink/70 text-sm leading-relaxed font-semibold">
          Finished with <span className="font-display font-bold text-bubble">{lives} 💖</span> and{" "}
          <span className="font-display font-bold text-btc">{trophies} 🏆</span>.
        </div>
        <div className="text-inkSoft text-xs italic font-semibold">
          Your Finis remember the green candles. The market remembers them too. 🌈
        </div>
        <div className="flex gap-2 justify-center pt-2">
          <button onClick={exit} className="kbtn kbtn-ghost px-5 py-2.5">
            Title
          </button>
          <button onClick={start} className="kbtn kbtn-mint px-6 py-2.5">
            ✨ New Run
          </button>
        </div>
      </div>
    </div>
  );
}
