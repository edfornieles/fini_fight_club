import { useGameStore } from "../state/gameStore";
import { leaderboard } from "../game/pvp";

export function LeaderboardPanel(props: { limit?: number }) {
  const pool = useGameStore((s) => s.pvpPool);
  const profile = useGameStore((s) => s.pvpProfile);

  const rivals = pool.filter((s) => s.origin === "seed");
  const rows = leaderboard(
    rivals,
    { id: "__you__", name: profile.name, rating: profile.rating },
    props.limit ?? 10,
  );

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

  return (
    <div className="kcard p-4 space-y-4">
      <div className="label-soft">🏅 Ladder</div>

      {/* Podium top-3 */}
      {podium.length >= 2 && (
        <div className="flex items-end justify-center gap-2 pt-1">
          {podiumOrder.map((row, i) => {
            if (!row) return null;
            const originalIndex = podium.indexOf(row);
            return (
              <div key={row.id} className="flex flex-col items-center gap-1 flex-1">
                <span className="text-lg leading-none">{podiumLabels[i]}</span>
                <span
                  className={`text-[10px] font-display font-bold truncate max-w-full px-1 ${
                    row.isPlayer ? "text-sky" : "text-ink"
                  }`}
                >
                  {row.isPlayer ? "You" : row.name}
                </span>
                <span className="lcd text-[10px] px-1.5 py-0.5">{row.rating}</span>
                <div
                  className={`w-full rounded-t-lg ${podiumHeights[i]} ${podiumBg[i]} flex items-center justify-center`}
                >
                  <span className="font-display font-bold text-lg text-ink/40">
                    {originalIndex + 1}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Rest of the list */}
      {rest.length > 0 && (
        <div className="space-y-1 border-t border-inkSoft/10 pt-2">
          {rest.map((row, i) => (
            <div
              key={row.id}
              className={`flex items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-sm ${
                row.isPlayer ? "bg-sky/20 ring-2 ring-sky/50" : ""
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-5 text-center text-xs font-display font-bold text-inkSoft">
                  {i + 4}
                </span>
                <span className={`truncate font-display font-semibold ${row.isPlayer ? "text-sky" : "text-ink"}`}>
                  {row.isPlayer ? "💙 You" : row.name}
                </span>
              </div>
              <span className="lcd px-2 py-0.5 text-xs">{row.rating}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
