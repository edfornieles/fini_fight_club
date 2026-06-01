import { useGameStore } from "../state/gameStore";
import { ENCOUNTERS_PER_STAGE, FINAL_STAGE } from "../game/runConstants";

function Stat(props: { icon: string; value: React.ReactNode; tint: string }) {
  return (
    <span
      className="chip"
      style={{ background: props.tint }}
    >
      <span>{props.icon}</span>
      <span className="text-ink">{props.value}</span>
    </span>
  );
}

export function RunHUD() {
  const lives = useGameStore((s) => s.lives);
  const gold = useGameStore((s) => s.gold);
  const trophies = useGameStore((s) => s.trophies);
  const stage = useGameStore((s) => s.stage);
  const stageProgress = useGameStore((s) => s.stageProgress);
  const exitToTitle = useGameStore((s) => s.exitToTitle);
  const isRanked = useGameStore((s) => s.isRanked);
  const profile = useGameStore((s) => s.pvpProfile);

  return (
    <div className="kcard px-4 py-2.5 flex items-center justify-between gap-3 mb-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {isRanked ? (
          <>
            <span className="lcd px-3 py-1 text-sm">◆ {profile.rating}</span>
            <Stat icon="🪙" value={gold} tint="rgba(255,215,107,0.3)" />
            <Stat icon="🏅" value={`${profile.wins}W ${profile.losses}L`} tint="rgba(124,200,255,0.25)" />
            {profile.streak !== 0 && (
              <span
                className="chip"
                style={{
                  background:
                    profile.streak > 0
                      ? "rgba(95,214,164,0.3)"
                      : "rgba(255,138,138,0.28)",
                }}
              >
                {profile.streak > 0
                  ? `🔥 ${profile.streak}`
                  : `💧 ${-profile.streak}`}
              </span>
            )}
          </>
        ) : (
          <>
            <Stat icon="💖" value={lives} tint="rgba(255,143,199,0.28)" />
            <Stat icon="🪙" value={gold} tint="rgba(255,215,107,0.32)" />
            <Stat icon="🏆" value={trophies} tint="rgba(255,215,107,0.22)" />
            <span className="chip bg-grape/15 text-ink">
              ✨ Stage {stage}/{FINAL_STAGE}
              <span className="text-inkSoft">
                ({stageProgress}/{ENCOUNTERS_PER_STAGE})
              </span>
            </span>
          </>
        )}
      </div>
      <button onClick={exitToTitle} className="kbtn kbtn-ghost text-xs px-3 py-1.5">
        Exit
      </button>
    </div>
  );
}
