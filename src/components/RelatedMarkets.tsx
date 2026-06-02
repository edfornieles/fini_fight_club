/**
 * RelatedMarkets — sidebar on the battle page showing equivalent or
 * adjacent rounds. One click hops the player to another asset's version
 * of the same template, or a different duration of the same asset.
 *
 * Selection logic (in priority order):
 *   1. SAME template on different assets — e.g. on btc-vs-uni-2h, show
 *      other "*-vs-*-2h" outperform battles. Or on btc-updown-5m, show
 *      eth-updown-5m, sol-updown-5m, etc.
 *   2. SAME asset on different durations — e.g. on btc-updown-5m, show
 *      btc-updown-15m, btc-updown-1h. Helps players move along the
 *      timeline without leaving the asset they care about.
 *   3. Capped at 8 rows so the sidebar stays compact.
 */
import { Link } from "react-router-dom";
import { useSimBattles } from "../data/cryptoSim";

type BattleLite = {
  id: string;
  title: string;
  type: string;
  assets: string[];
  durationLabel: string;
  sideA: { label: string; pct: number };
  sideB: { label: string; pct: number };
  status: string;
};

/** Strip slot suffix (`btc-updown-5m:2026-…` → `btc-updown-5m`). */
function templateOf(id: string): string {
  const i = id.indexOf(":");
  return i === -1 ? id : id.slice(0, i);
}

/** "updown" / "outperform" / "abovebelow" / "clanwar" / "volatility". */
function familyOf(template: string): string {
  // Template ids look like "btc-updown-5m", "btc-vs-eth-15m", "link-volatility-2h".
  if (template.includes("-vs-")) return "outperform";
  if (template.includes("-updown-")) return "updown";
  if (template.includes("-volatility-")) return "volatility";
  return "other";
}

/** "5m" / "15m" / "1h" / "2h" — the duration suffix on the template. */
function durationOf(template: string): string {
  const m = /-(\d+(?:m|h))$/.exec(template);
  return m ? m[1] : "";
}

export function RelatedMarkets({ currentBattleId }: { currentBattleId: string }) {
  const battles = useSimBattles() as BattleLite[];
  const currentTemplate = templateOf(currentBattleId);
  const currentFamily = familyOf(currentTemplate);
  const currentDuration = durationOf(currentTemplate);
  const current = battles.find(b => b.id === currentBattleId);
  const currentAssets = new Set(current?.assets ?? []);

  // Score each candidate by relevance and take the best 8.
  const scored: { battle: BattleLite; score: number; reason: string }[] = [];
  for (const b of battles) {
    if (b.id === currentBattleId) continue;
    if (b.status !== "live") continue;
    const t = templateOf(b.id);
    if (t === currentTemplate) continue; // same template = same battle, skip
    const fam = familyOf(t);
    const dur = durationOf(t);
    let score = 0;
    let reason = "";
    if (fam === currentFamily && dur === currentDuration) {
      // Same battle type and duration, different asset → strongest match
      score = 100;
      reason = "Same battle, different asset";
    } else if (fam === currentFamily && b.assets.some(a => currentAssets.has(a))) {
      // Same battle type, same asset, different duration → next best
      score = 80;
      reason = `${dur} version`;
    } else if (fam === currentFamily) {
      score = 50;
      reason = "Same battle type";
    } else if (b.assets.some(a => currentAssets.has(a))) {
      score = 30;
      reason = "Same asset";
    } else {
      continue; // not related enough
    }
    scored.push({ battle: b, score, reason });
  }
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 8);

  if (top.length === 0) return null;

  return (
    <div style={{
      background: "#fff", borderRadius: 20, border: "1.5px solid #f0f0f0", padding: "16px 18px",
      fontFamily: "'Nunito', system-ui, sans-serif",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#111" }}>Related markets</div>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: 0.5 }}>
          {top.length} live
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {top.map(({ battle, reason }) => (
          <Link
            key={battle.id}
            to={`/battle/${battle.id}`}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "8px 10px", borderRadius: 10, background: "#fafafa",
              border: "1px solid #f0f0f0",
              textDecoration: "none", color: "#111",
              gap: 8,
              transition: "background 0.12s",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "#f3f4f6")}
            onMouseLeave={e => (e.currentTarget.style.background = "#fafafa")}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#111", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {battle.title}
              </div>
              <div style={{ fontSize: 10, color: "#888", marginTop: 1 }}>
                {reason} · ⏱ {battle.durationLabel}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: "#16a34a" }}>{battle.sideA.pct}%</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: "#aaa", maxWidth: 80, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {battle.sideA.label}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
