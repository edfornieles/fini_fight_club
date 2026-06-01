import type { CoinFamily } from "../game/types";
import { FAMILY_COLOR } from "./familyColors";
import { FiniAvatar } from "./FiniAvatar";

/**
 * The "diagonal split" match card — core visual unit from the Figma design.
 * Shows two clashing families on a colored split background with player info.
 */
export function MatchPreviewCard(props: {
  familyA: CoinFamily;
  familyB: CoinFamily;
  nameA: string;
  nameB: string;
  playerA?: string;
  playerB?: string;
  status?: "live" | "open" | "completed" | "upcoming";
  timer?: string;
  winner?: "A" | "B";
  onClick?: () => void;
}) {
  const { familyA, familyB, nameA, nameB, playerA, playerB, status, timer, winner, onClick } = props;
  const cA = FAMILY_COLOR[familyA];
  const cB = FAMILY_COLOR[familyB];

  return (
    <div
      className={`kcard overflow-hidden ${onClick ? "cursor-pointer hover:-translate-y-0.5 transition-transform" : ""}`}
      onClick={onClick}
    >
      {/* Split arena thumbnail */}
      <div
        className="relative w-full overflow-hidden"
        style={{
          height: "112px",
          background: `linear-gradient(108deg, ${cA.hex}44 0 47%, ${cB.hex}44 53% 100%)`,
        }}
      >
        {/* lightning bolt divider */}
        <div
          className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[6%]"
          style={{
            background: "rgba(255,255,255,0.9)",
            clipPath: "polygon(40% 0,60% 0,48% 35%,64% 35%,36% 100%,52% 55%,32% 55%)",
            filter: "drop-shadow(0 0 4px rgba(255,255,255,0.7))",
          }}
        />

        {/* Left Fini */}
        <div className="absolute bottom-2 left-[12%] flex flex-col items-center gap-0.5">
          <FiniAvatar family={familyA} size={56} mood={winner === "B" ? "sad" : "happy"} wobble={!winner} />
        </div>

        {/* Right Fini */}
        <div className="absolute bottom-2 right-[12%] flex flex-col items-center gap-0.5">
          <FiniAvatar family={familyB} size={56} mood={winner === "A" ? "sad" : "happy"} wobble={!winner} />
        </div>

        {/* Status badge */}
        {status && (
          <div className="absolute top-2 right-2">
            <StatusBadge status={status} timer={timer} />
          </div>
        )}

        {/* Winner crown */}
        {winner && (
          <div
            className="absolute top-2 left-2 text-xs font-display font-bold px-2 py-0.5 rounded-full"
            style={{
              background: winner === "A" ? `${cA.hex}cc` : `${cB.hex}cc`,
              color: "#fff",
            }}
          >
            🏆 {winner === "A" ? nameA : nameB}
          </div>
        )}
      </div>

      {/* Bottom info row */}
      <div className="flex items-center justify-between px-3 py-2 gap-2">
        {/* Left team */}
        <div className="flex flex-col min-w-0">
          <span
            className="text-[11px] font-display font-bold truncate"
            style={{ color: cA.hex }}
          >
            {familyA}
          </span>
          {playerA && (
            <span className="text-[10px] text-inkSoft font-semibold truncate">{playerA}</span>
          )}
        </div>

        <span className="text-inkSoft text-xs font-bold shrink-0">vs</span>

        {/* Right team */}
        <div className="flex flex-col items-end min-w-0">
          <span
            className="text-[11px] font-display font-bold truncate"
            style={{ color: cB.hex }}
          >
            {familyB}
          </span>
          {playerB && (
            <span className="text-[10px] text-inkSoft font-semibold truncate">{playerB}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status, timer }: { status: string; timer?: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    live:      { label: `● Live${timer ? ` · ${timer}` : ""}`, cls: "bg-coral text-white" },
    open:      { label: "Open Call",                            cls: "bg-grape/80 text-white" },
    completed: { label: "Completed",                            cls: "bg-inkSoft/30 text-inkSoft" },
    upcoming:  { label: "Upcoming",                             cls: "bg-sky/30 text-sky" },
  };
  const { label, cls } = map[status] ?? map.upcoming;
  return (
    <span className={`text-[9px] font-display font-bold px-2 py-0.5 rounded-full ${cls}`}>
      {label}
    </span>
  );
}
