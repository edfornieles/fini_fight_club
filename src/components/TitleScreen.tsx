import { useGameStore } from "../state/gameStore";
import { loadProfile } from "../game/pvpStorage";
import { FiniAvatar } from "./FiniAvatar";
import { MatchPreviewCard } from "./MatchPreviewCard";
import type { CoinFamily } from "../game/types";

const EXAMPLE_BATTLES = [
  { familyA: "ETH" as CoinFamily, familyB: "BTC" as CoinFamily, nameA: "Dodge", nameB: "Cyberpunk", playerA: "sam_spike", playerB: "uniswap_labs", status: "live" as const, timer: "01:45" },
  { familyA: "DOGE" as CoinFamily, familyB: "MATIC" as CoinFamily, nameA: "Meme Force", nameB: "Pastel Panic", playerA: "dani_eth", playerB: "0xPresley", status: "open" as const },
  { familyA: "SOL" as CoinFamily, familyB: "LINK" as CoinFamily, nameA: "Solar Flare", nameB: "Oracle Squad", playerA: "shl0ms", playerB: "d0unbug", status: "completed" as const, winner: "A" as const },
];

// Sprite floaters from the source library (pixel art kawaii blob creatures — Fini adjacent!)
const SPRITE_FLOATERS = [
  { src: "/sprites/kawaii_bear.gif",  top: "6%",  left: "5%",  size: 88,  delay: "0s",    flip: false },
  { src: "/sprites/kawaii_panda.gif", top: "8%",  left: "78%", size: 100, delay: "0.7s",  flip: false },
  { src: "/sprites/kawaii_cat.gif",   top: "66%", left: "7%",  size: 80,  delay: "1.3s",  flip: true  },
  { src: "/sprites/kawaii_skip.gif",  top: "72%", left: "80%", size: 74,  delay: "0.4s",  flip: false },
  { src: "/sprites/kawaii_char.gif",  top: "42%", left: "89%", size: 66,  delay: "1.0s",  flip: true  },
  { src: "/sprites/kawaii_cake.gif",  top: "50%", left: "2%",  size: 60,  delay: "1.6s",  flip: false },
];

const FAMILY_FLOATERS: { family: CoinFamily; top: string; left: string; size: number; delay: string }[] = [
  { family: "ETH",  top: "32%", left: "16%", size: 44, delay: "0.3s" },
  { family: "BTC",  top: "28%", left: "76%", size: 44, delay: "0.9s" },
  { family: "DOGE", top: "60%", left: "35%", size: 38, delay: "1.2s" },
];

export function TitleScreen() {
  const start = useGameStore((s) => s.startNewRun);
  const startRanked = useGameStore((s) => s.startRankedLadder);
  const profile = loadProfile();

  return (
    <div className="relative min-h-[84vh] flex flex-col items-center justify-center px-4 overflow-hidden gap-6">
      {/* pixel kawaii creature floaters */}
      {SPRITE_FLOATERS.map((f, i) => (
        <div
          key={i}
          className="absolute animate-floaty hidden sm:block pointer-events-none select-none"
          style={{ top: f.top, left: f.left, animationDelay: f.delay }}
        >
          <img
            src={f.src}
            alt=""
            width={f.size}
            style={{ transform: f.flip ? "scaleX(-1)" : undefined, imageRendering: "pixelated" }}
          />
        </div>
      ))}
      {/* SVG fini avatars at mid-ground */}
      {FAMILY_FLOATERS.map((f, i) => (
        <div
          key={`fam-${i}`}
          className="absolute animate-bobby hidden lg:block pointer-events-none select-none"
          style={{ top: f.top, left: f.left, animationDelay: f.delay }}
        >
          <FiniAvatar family={f.family} size={f.size} mood="happy" />
        </div>
      ))}

      <div className="kcard relative max-w-xl w-full text-center px-8 py-10 space-y-6">
        {/* pixel Fini mascot — the hero of the title */}
        <div className="flex justify-center -mt-2 mb-0">
          <img
            src="/sprites/kawaii_bear.gif"
            alt="Fini"
            width={110}
            className="animate-bobby"
            style={{ imageRendering: "pixelated" }}
          />
        </div>
        <div className="space-y-1">
          <div className="chip bg-bubble/20 text-bubbleDark mx-auto">
            ✨ a cute financial fever dream ✨
          </div>
          <h1 className="font-display font-bold text-6xl sm:text-7xl leading-none text-ink mt-3">
            Fini
            <span className="text-bubble">liar</span>
          </h1>
          <h2 className="font-display text-2xl text-grape -mt-1">Battler</h2>
          <p className="text-ink/70 text-sm leading-relaxed mt-3 font-semibold">
            Tiny market spirits, big feelings. Draft a team of 3,
            <br className="hidden sm:block" />
            read the market, and battle through the candy crypto-verse.
          </p>
        </div>

        {/* Stats bar — mirrors Figma "Your Stats" dashboard row */}
        <div className="flex justify-center gap-2 -mb-1">
          <div className="flex flex-col items-center px-4 py-2 rounded-2xl bg-amber-400/20 min-w-[64px]">
            <span className="font-display font-bold text-xl text-amber-500 leading-tight">
              {profile.wins + profile.losses === 0 ? "—" : Math.round((profile.wins / Math.max(1, profile.wins + profile.losses)) * 100) + "%"}
            </span>
            <span className="text-[9px] font-semibold text-inkSoft uppercase tracking-wider">Win rate</span>
          </div>
          <div className="flex flex-col items-center px-4 py-2 rounded-2xl bg-bubble/20 min-w-[64px]">
            <span className="font-display font-bold text-xl text-bubbleDark leading-tight">{profile.wins}</span>
            <span className="text-[9px] font-semibold text-inkSoft uppercase tracking-wider">Wins</span>
          </div>
          <div className="flex flex-col items-center px-4 py-2 rounded-2xl bg-grape/20 min-w-[64px]">
            <span className="font-display font-bold text-xl text-grape leading-tight">{profile.losses}</span>
            <span className="text-[9px] font-semibold text-inkSoft uppercase tracking-wider">Losses</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-1">
          <button onClick={start} className="kbtn kbtn-primary px-8 py-4 text-lg">
            🎀 Start Adventure
          </button>
          <button onClick={startRanked} className="kbtn kbtn-grape px-7 py-4 text-lg">
            🏅 Ranked Battle
            <span className="block text-[11px] font-semibold opacity-90 tracking-wide">
              {profile.rating} ELO
            </span>
          </button>
        </div>

        <div className="text-[11px] text-inkSoft leading-relaxed font-semibold">
          MVP build · no wallets connected · Death Mode is simulated only.
          <br />
          Your drafted teams become rivals in the Ranked pool.
        </div>
      </div>

      {/* Live battles feed — below the main card */}
      <div className="w-full max-w-2xl space-y-3 pb-6">
        <div className="flex items-center gap-2 px-1">
          <span className="text-[11px] font-display font-bold text-inkSoft uppercase tracking-widest">Live Battles</span>
          <span className="w-1.5 h-1.5 rounded-full bg-coral animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {EXAMPLE_BATTLES.map((b, i) => (
            <MatchPreviewCard key={i} {...b} />
          ))}
        </div>
      </div>
    </div>
  );
}
