import type { Fini } from "../game/types";
import { FAMILY_COLOR } from "./familyColors";
import { HealthBar } from "./HealthBar";
import { FiniAvatar, moodFromHp } from "./FiniAvatar";

export function FiniBattleCard(props: {
  fini: Fini;
  active?: boolean;
  staked?: boolean;
  compact?: boolean;
  onClick?: () => void;
  selected?: boolean;
}) {
  const { fini, active, staked, compact, onClick, selected } = props;
  const color = FAMILY_COLOR[fini.family];
  const mood = moodFromHp(fini.currentHealth / fini.maxHealth, fini.fainted);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`kcard text-left p-3 w-full transition-all relative overflow-hidden
        ${active ? "scale-[1.03]" : ""}
        ${fini.fainted ? "opacity-60 grayscale" : ""}
        ${onClick ? "hover:-translate-y-0.5 cursor-pointer" : "cursor-default"}
      `}
      style={{
        boxShadow: active
          ? `0 0 0 3px ${color.hex}, 0 12px 26px -10px ${color.glow}`
          : selected
            ? "0 0 0 3px #ff8fc7, 0 12px 26px -12px rgba(255,143,199,0.6)"
            : undefined,
      }}
    >
      {staked && (
        <div className="absolute top-1.5 right-2 chip bg-coral/20 text-coral animate-pulse text-[10px]">
          ♥ staked
        </div>
      )}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <FiniAvatar family={fini.family} mood={mood} size={38} wobble={active} />
          <div className="min-w-0">
            <div className="text-sm font-display font-semibold leading-tight truncate text-ink">
              {fini.name}
            </div>
            <div className="text-[10px] font-display font-semibold tracking-wide text-inkSoft">
              {fini.family} · Lv {fini.level}
            </div>
          </div>
        </div>
        <div className="text-right text-[11px] font-display font-semibold text-ink">
          <div>⚔ {fini.strength}</div>
          {!compact && <div className="text-inkSoft">🛡 {fini.defense}</div>}
        </div>
      </div>
      <HealthBar
        current={fini.currentHealth}
        max={fini.maxHealth}
        colorHex={color.hex}
        fainted={fini.fainted}
      />
      <div className="flex justify-between text-[10px] mt-1.5 text-inkSoft font-display font-semibold">
        <span>
          {fini.currentHealth} / {fini.maxHealth} HP
        </span>
        <span className="truncate ml-2">
          {fini.passiveAbility.replace(/_/g, " ").toLowerCase()}
        </span>
      </div>
    </button>
  );
}
