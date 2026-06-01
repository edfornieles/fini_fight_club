import type { CoinFamily, MarketSignalMap } from "../game/types";
import { FAMILY_COLOR } from "./familyColors";

export function MarketSignalPanel(props: {
  signals: MarketSignalMap;
  highlight?: CoinFamily[];
  /** the player's pre-battle call, if any */
  predictedFamily?: CoinFamily | null;
  /** "LIVE" shows a real-data badge */
  source?: "MOCK" | "MANUAL" | "LIVE";
}) {
  const { signals, highlight, predictedFamily, source } = props;
  const families = (Object.keys(signals) as CoinFamily[]).sort((a, b) => {
    const aHi = highlight?.includes(a) ? 1 : 0;
    const bHi = highlight?.includes(b) ? 1 : 0;
    return bHi - aHi;
  });

  return (
    <div className="kcard p-4">
      <div className="flex items-center justify-between mb-2.5">
        <div className="label-soft">📈 Market Mood</div>
        {source === "LIVE" && (
          <span className="chip bg-mint/20 text-mintDark text-[10px]">
            <span className="w-1.5 h-1.5 rounded-full bg-mint animate-pulse" />
            live
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-1">
        {families.map((fam) => {
          const sig = signals[fam];
          const color = FAMILY_COLOR[fam];
          const up = sig.direction === "up";
          const down = sig.direction === "down";
          const dirColor = up ? "text-mintDark" : down ? "text-coral" : "text-inkSoft";
          const pct = sig.percentChange.toFixed(2);
          const sign = sig.percentChange > 0 ? "+" : "";
          const isHighlighted = highlight?.includes(fam);
          const isCalled = predictedFamily === fam;
          return (
            <div
              key={fam}
              className={`flex items-center justify-between gap-2 rounded-xl px-2 py-1.5 transition ${
                isCalled
                  ? "bg-bubble/10 ring-2 ring-bubble/50"
                  : isHighlighted
                    ? "bg-grape/10"
                    : ""
              }`}
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-display font-bold"
                style={{ background: color.hex, color: "#fff", textShadow: "0 1px 1px rgba(0,0,0,0.25)" }}
              >
                {fam}
              </div>
              <div className="flex-1 text-xs font-display font-semibold text-ink">
                {fam}
                {isCalled && <span className="ml-1 text-bubble" title="Your call">★</span>}
              </div>
              <div className={`text-xs font-display font-bold ${dirColor}`}>
                {up ? "▲" : down ? "▼" : "■"} {sign}
                {pct}%
              </div>
              <div className="w-10">
                <div className="h-1.5 rounded-full bg-cloud">
                  <div
                    className="h-1.5 rounded-full"
                    style={{
                      width: `${Math.round(sig.volatility * 100)}%`,
                      background: sig.volatility > 0.6 ? "#ff7d7d" : "#b98cff",
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="text-[10px] text-inkSoft font-semibold mt-2">
        Volatility bar shows the chaos pressure on each family. 🌊
      </div>
    </div>
  );
}
