import { useEffect, useRef } from "react";
import type { BattleEvent } from "../game/types";

const TYPE_TONE: Record<BattleEvent["type"], string> = {
  BATTLE_START: "text-ink italic font-semibold",
  BATTLE_END: "text-mintDark font-display font-bold",
  ROUND_START: "text-inkSoft uppercase tracking-widest text-[11px] font-display font-bold",
  ATTACK: "text-ink",
  DAMAGE: "text-coral font-semibold",
  PASSIVE_TRIGGER: "text-grape font-semibold",
  FAINT: "text-coral italic font-semibold",
  FAMILY_MARKET_SIGNAL: "text-sky font-semibold",
  MARKET_READ: "text-bubbleDark font-display font-bold",
  MARKET_TICK: "font-display font-bold",
  LEVEL_UP: "text-mintDark font-display font-bold",
  DEATH_MODE_STAKE: "text-coral uppercase tracking-widest text-[11px] font-bold",
  DEATH_MODE_TRANSFER: "text-coral font-display font-bold",
};

export function BattleLog(props: {
  events: BattleEvent[];
  visibleCount: number;
}) {
  const { events, visibleCount } = props;
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [visibleCount]);

  const visible = events.slice(0, visibleCount);

  return (
    <div className="kcard p-4 flex flex-col min-h-0">
      <div className="label-soft mb-2">📜 Battle Log</div>
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto scrollbar-thin space-y-1 pr-1 min-h-[200px] max-h-[40vh]"
      >
        {visible.map((ev, i) => {
          if (ev.type === "MARKET_TICK") {
            const pumping = ev.delta > 0;
            return (
              <div
                key={i}
                className={`text-sm leading-relaxed font-display font-bold rounded-lg px-2 py-1 my-0.5 border-l-4 ${
                  pumping
                    ? "bg-mint/15 border-mint text-mintDark"
                    : "bg-coral/15 border-coral text-coral"
                }`}
              >
                {ev.message}
              </div>
            );
          }
          return (
            <div key={i} className={`text-sm leading-relaxed ${TYPE_TONE[ev.type] ?? ""}`}>
              {ev.message}
            </div>
          );
        })}
        {visible.length === 0 && (
          <div className="text-inkSoft text-sm italic font-semibold">
            The arena waits. The market opens its mouth. 🌙
          </div>
        )}
      </div>
    </div>
  );
}
