import { useUIStore } from "../state/uiStore";
import { LeaderboardPanel } from "./LeaderboardPanel";

export function LeaderboardOverlay() {
  const { leaderboardOpen, closeLeaderboard } = useUIStore();

  if (!leaderboardOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-grape/25 backdrop-blur-sm p-3 sm:p-6">
      <div className="w-full max-w-2xl my-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-2xl text-ink drop-shadow-sm">🏅 Leaderboard</h2>
          <button onClick={closeLeaderboard} className="kbtn kbtn-ghost px-3 py-1.5 text-sm">✕ Close</button>
        </div>
        <LeaderboardPanel limit={20} />
      </div>
    </div>
  );
}
