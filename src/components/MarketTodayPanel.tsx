import { useGameStore, type MarketMode } from "../state/gameStore";
import { ALL_COIN_FAMILIES, type CoinFamily } from "../game/types";
import { FAMILY_COLOR } from "./familyColors";

const MOOD_EMOJI: Record<string, string> = {
  "Risk-on": "😻",
  "Risk-off": "😿",
  Volatile: "🌪️",
  Choppy: "😐",
};
const MOOD_TONE: Record<string, string> = {
  "Risk-on": "text-mintDark",
  "Risk-off": "text-coral",
  Volatile: "text-btc",
  Choppy: "text-inkSoft",
};

/**
 * The strategy layer made visible: today's market weather + the player's
 * pre-battle "call". Reading the regime and calling a family that pumps
 * is the skill that turns the market from luck into agency.
 */
export function MarketTodayPanel() {
  const regime = useGameStore((s) => s.dailyRegime);
  const marketMode = useGameStore((s) => s.marketMode);
  const setMarketMode = useGameStore((s) => s.setMarketMode);
  const marketLoading = useGameStore((s) => s.marketLoading);
  const marketError = useGameStore((s) => s.marketError);
  const marketRead = useGameStore((s) => s.marketRead);
  const setMarketRead = useGameStore((s) => s.setMarketRead);

  const hot = FAMILY_COLOR[regime.hotFamily];
  const cold = FAMILY_COLOR[regime.coldFamily];
  const moodTone = MOOD_TONE[regime.mood] ?? "text-inkSoft";

  const modes: MarketMode[] = ["MOCK", "LIVE"];

  return (
    <div className="kcard p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="label-soft">🔮 Today's Market</div>
        <div className="flex items-center gap-1 bg-cloud/60 rounded-full p-0.5">
          {modes.map((m) => (
            <button
              key={m}
              onClick={() => setMarketMode(m)}
              className={`text-[10px] font-display font-bold rounded-full px-2.5 py-1 transition ${
                marketMode === m
                  ? "bg-grape text-white shadow-sm"
                  : "text-inkSoft hover:text-ink"
              }`}
            >
              {m === "LIVE" ? "Live" : "Sim"}
            </button>
          ))}
        </div>
      </div>

      {/* mood LCD readout — Tamagotchi nod */}
      <div className="lcd px-3 py-2 flex items-center justify-between">
        <span className="text-[11px] tracking-wide opacity-80">MOOD</span>
        <span className={`font-display font-bold ${moodTone} flex items-center gap-1`}>
          <span className="text-base">{MOOD_EMOJI[regime.mood] ?? "🪙"}</span>
          {marketMode === "LIVE" && marketLoading ? "Loading…" : regime.mood}
          {marketMode === "LIVE" && !marketError && !marketLoading && (
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-mint animate-pulse" />
          )}
        </span>
      </div>

      {marketError && (
        <div className="text-[10px] text-coral font-semibold">
          Live feed napping ({marketError}). Using simulated market.
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="kcard-soft py-2 !bg-mint/10 !border-mint/30">
          <div className="text-[9px] font-display font-bold tracking-wider text-inkSoft">
            🔥 running hot
          </div>
          <div className="text-base font-display font-bold" style={{ color: hot.hex }}>
            {regime.hotFamily}
          </div>
        </div>
        <div className="kcard-soft py-2 !bg-coral/10 !border-coral/30">
          <div className="text-[9px] font-display font-bold tracking-wider text-inkSoft">
            🧊 running cold
          </div>
          <div className="text-base font-display font-bold" style={{ color: cold.hex }}>
            {regime.coldFamily}
          </div>
        </div>
      </div>

      <div>
        <div className="text-[10px] font-display font-bold tracking-wide text-inkSoft mb-1.5">
          🎯 Your call <span className="text-bubble">(+15% attack if it pumps)</span>
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {ALL_COIN_FAMILIES.map((fam) => (
            <ReadButton
              key={fam}
              family={fam}
              selected={marketRead === fam}
              onClick={() => setMarketRead(marketRead === fam ? null : fam)}
            />
          ))}
        </div>
        <div className="text-[10px] text-inkSoft font-semibold mt-1.5 leading-relaxed">
          {marketRead
            ? `Calling ${marketRead} 💫 — if it's green at battle time, your whole team hits harder!`
            : "Optional: call the family you think will pump. Read the weather above. 🌈"}
        </div>
      </div>
    </div>
  );
}

function ReadButton(props: {
  family: CoinFamily;
  selected: boolean;
  onClick: () => void;
}) {
  const color = FAMILY_COLOR[props.family];
  return (
    <button
      onClick={props.onClick}
      className={`rounded-xl py-1.5 text-[10px] font-display font-bold transition-all ${
        props.selected
          ? "scale-110 ring-2 ring-bubble shadow-md"
          : "opacity-75 hover:opacity-100 hover:-translate-y-0.5"
      }`}
      style={{ background: color.hex, color: "#fff", textShadow: "0 1px 1px rgba(0,0,0,0.25)" }}
      title={props.family}
    >
      {props.family}
    </button>
  );
}
