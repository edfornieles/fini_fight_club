import { useGameStore } from "../state/gameStore";
import type { Encounter, EncounterType } from "../game/encounters";

const TYPE_TONE: Record<
  EncounterType,
  { tint: string; ring: string; tag: string; chip: string; emoji: string }
> = {
  FIGHT: {
    tint: "rgba(124,200,255,0.12)",
    ring: "#7cc8ff",
    tag: "Fight",
    chip: "bg-sky/25 text-sky",
    emoji: "⚔️",
  },
  BOSS_FIGHT: {
    tint: "rgba(255,138,138,0.14)",
    ring: "#ff8a8a",
    tag: "Boss",
    chip: "bg-coral/25 text-coral",
    emoji: "👑",
  },
  FOUND_COINS: {
    tint: "rgba(255,215,107,0.16)",
    ring: "#ffcf5c",
    tag: "Coins",
    chip: "bg-lemon/40 text-ink",
    emoji: "🪙",
  },
  VISIT_SHOP: {
    tint: "rgba(95,214,164,0.14)",
    ring: "#5fd6a4",
    tag: "Shop",
    chip: "bg-mint/25 text-mintDark",
    emoji: "🛍️",
  },
  REST: {
    tint: "rgba(124,200,255,0.12)",
    ring: "#74e2b1",
    tag: "Rest",
    chip: "bg-mint/20 text-mintDark",
    emoji: "🛌",
  },
  TREASURE: {
    tint: "rgba(185,140,255,0.14)",
    ring: "#b98cff",
    tag: "Treasure",
    chip: "bg-grape/25 text-grape",
    emoji: "🎁",
  },
  DEATH_MATCH: {
    tint: "rgba(240,89,90,0.16)",
    ring: "#f0595a",
    tag: "Death Match",
    chip: "bg-coral/30 text-coral",
    emoji: "💀",
  },
};

export function EncounterScreen() {
  const stage = useGameStore((s) => s.stage);
  const options = useGameStore((s) => s.encounterOptions);
  const pick = useGameStore((s) => s.pickEncounter);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 py-8">
      <div className="text-center mb-6">
        <div className="chip bg-grape/15 text-grape mx-auto mb-2">✨ Stage {stage}</div>
        <h2 className="text-3xl sm:text-4xl font-display font-bold text-ink">
          Where to next? 🗺️
        </h2>
      </div>
      <div className="grid sm:grid-cols-3 gap-3 w-full max-w-3xl">
        {options.map((opt) => (
          <EncounterCard key={opt.id} encounter={opt} onPick={() => pick(opt.id)} />
        ))}
      </div>
      <div className="mt-6 text-[11px] text-inkSoft max-w-md text-center font-semibold leading-relaxed">
        💡 Death Match is simulated only in MVP — no real NFT transfer. Shop and Rest
        let you stretch your gold and hearts between fights.
      </div>
    </div>
  );
}

function EncounterCard(props: { encounter: Encounter; onPick: () => void }) {
  const tone = TYPE_TONE[props.encounter.type];
  return (
    <button
      onClick={props.onPick}
      className="kcard text-left p-4 h-full flex flex-col transition-all hover:-translate-y-1.5 hover:shadow-puff"
      style={{ background: tone.tint, boxShadow: `0 0 0 2px ${tone.ring}44` }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-3xl">{tone.emoji}</span>
        <span className={`chip text-[10px] ${tone.chip}`}>{tone.tag}</span>
      </div>
      <div className="font-display font-bold text-lg text-ink">{props.encounter.label}</div>
      <div className="text-ink/70 text-sm mt-1 leading-relaxed flex-1 font-semibold">
        {props.encounter.description}
      </div>
    </button>
  );
}
