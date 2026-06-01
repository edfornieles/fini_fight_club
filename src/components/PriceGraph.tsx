/**
 * PriceGraph — live SVG line chart for one or two assets in a battle.
 *
 * Each asset's series is normalised to % change from the battle's opening
 * price, so a 1-asset Up/Down battle shows the line crossing the 0% baseline,
 * and a 2-asset Outperform battle overlays both lines on the same % axis —
 * you can literally watch one currency pull ahead of the other.
 *
 * Data comes from velocity.priceSeries (the rolling per-asset history fed by
 * useLivePrices) anchored to the battle's opening price from openingPrices.
 * Re-renders on a 1s tick passed down via the `tick` prop so it animates live.
 */
import { useEffect, useState } from "react";
import { priceSeries, latestPrice } from "../lib/velocity";
import { openingFor, intraWindowReturn, snapBattleOpening } from "../lib/openingPrices";

interface SeriesConfig {
  asset: string;
  color: string;
}

export function PriceGraph({
  battleId,
  series,
  windowMs,
  height = 180,
}: {
  battleId: string;
  series: SeriesConfig[];
  windowMs: number;
  height?: number;
}) {
  const W = 600; // viewBox width (scales responsively)
  const H = height;
  const padTop = 16, padBottom = 22, padX = 8;

  const now0 = Date.now();
  // Build normalised (% change from opening) point arrays for each asset.
  // We prepend a synthetic anchor at the window start (0% = opening price) so
  // the line is meaningful from the very first render, before enough live
  // samples have accumulated.
  const lines = series.map(({ asset, color }) => {
    const opening = openingFor(battleId, asset);
    const raw = priceSeries(asset, windowMs);
    const pts = raw.map(s => ({
      ts: s.ts,
      pct: opening && opening > 0 ? ((s.price - opening) / opening) * 100 : 0,
    }));
    // Prepend the opening anchor if we have an opening and the first real
    // sample is later than the window start.
    if (opening && opening > 0) {
      const anchorTs = now0 - windowMs;
      if (pts.length === 0 || pts[0].ts > anchorTs + 1000) {
        pts.unshift({ ts: anchorTs, pct: 0 });
      }
    }
    const lp = latestPrice(asset);
    const latestPct = opening && opening > 0 && lp ? ((lp - opening) / opening) * 100 : (pts.length ? pts[pts.length - 1].pct : 0);
    return { asset, color, pts, opening, latestPct };
  });

  // Time + value domain across all lines
  const allPts = lines.flatMap(l => l.pts);
  const hasData = allPts.length >= 2;

  // y-domain: symmetric around 0, min span ±0.5%
  const maxAbs = Math.max(0.5, ...allPts.map(p => Math.abs(p.pct)));
  const yMin = -maxAbs * 1.15, yMax = maxAbs * 1.15;

  // x-domain: window
  const now = Date.now();
  const tMin = now - windowMs, tMax = now;

  const xOf = (ts: number) => padX + ((ts - tMin) / (tMax - tMin)) * (W - 2 * padX);
  const yOf = (pct: number) => padTop + ((yMax - pct) / (yMax - yMin)) * (H - padTop - padBottom);
  const zeroY = yOf(0);

  return (
    <div style={{ width: "100%", fontFamily: "'Nunito', system-ui, sans-serif" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} preserveAspectRatio="none">
        {/* Zero baseline */}
        <line x1={padX} y1={zeroY} x2={W - padX} y2={zeroY} stroke="#e5e7eb" strokeWidth="1.5" strokeDasharray="4 4" />
        <text x={padX + 2} y={zeroY - 4} fontSize="10" fill="#aaa" fontWeight="700">open</text>

        {!hasData && (
          <text x={W / 2} y={H / 2} fontSize="13" fill="#bbb" textAnchor="middle" fontWeight="600">
            Gathering live price data…
          </text>
        )}

        {hasData && lines.map(line => {
          if (line.pts.length < 2) return null;
          const d = line.pts.map((p, i) => `${i === 0 ? "M" : "L"} ${xOf(p.ts).toFixed(1)} ${yOf(p.pct).toFixed(1)}`).join(" ");
          // Soft area fill under the line toward the zero baseline
          const areaD = `${d} L ${xOf(line.pts[line.pts.length - 1].ts).toFixed(1)} ${zeroY.toFixed(1)} L ${xOf(line.pts[0].ts).toFixed(1)} ${zeroY.toFixed(1)} Z`;
          return (
            <g key={line.asset}>
              <path d={areaD} fill={line.color} opacity={0.08} />
              <path d={d} fill="none" stroke={line.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
              {/* End dot + label */}
              {(() => {
                const last = line.pts[line.pts.length - 1];
                return (
                  <>
                    <circle cx={xOf(last.ts)} cy={yOf(last.pct)} r="3.5" fill={line.color} />
                  </>
                );
              })()}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div style={{ display: "flex", gap: 18, justifyContent: "center", marginTop: 6 }}>
        {lines.map(line => {
          const up = line.latestPct >= 0;
          return (
            <div key={line.asset} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: line.color, display: "inline-block" }} />
              <span style={{ color: "#111" }}>{line.asset}</span>
              <span style={{ color: up ? "#16a34a" : "#dc2626", fontFamily: "monospace" }}>
                {up ? "▲ +" : "▼ "}{line.latestPct.toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * LiveMarketCard — battle-page wrapper around PriceGraph.
 *
 * Self-contained: snaps the battle opening on mount, ticks every second to
 * animate the graph, and shows a big per-asset "% since open" readout above
 * the chart. Drop it on the battle page for any updown/outperform battle.
 */
export function LiveMarketCard({
  battleId,
  assets,
  colors,
  durationLabel,
}: {
  battleId: string;
  assets: string[];
  colors: Record<string, string>;
  durationLabel: string;
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    snapBattleOpening(battleId, assets);
    const t = setInterval(() => {
      snapBattleOpening(battleId, assets); // idempotent — catches late price warmup
      setTick(n => n + 1);
    }, 1000);
    return () => clearInterval(t);
  }, [battleId, assets]);

  const windowMs = parseDurationLabel(durationLabel);
  const series = assets.map(a => ({ asset: a, color: colors[a] ?? "#888" }));

  return (
    <div style={{ background: "#fff", borderRadius: 20, padding: "24px", border: "1.5px solid #f0f0f0", fontFamily: "'Nunito', system-ui, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Live Price · since battle open
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: "#16a34a" }}>
          <span style={{ width: 7, height: 7, borderRadius: 99, background: "#22c55e", display: "inline-block" }} />
          LIVE
        </div>
      </div>

      {/* Big per-asset % readouts */}
      <div style={{ display: "flex", gap: 24, marginBottom: 18 }}>
        {assets.map(a => {
          const ret = intraWindowReturn(battleId, a);
          const cur = latestPrice(a);
          const open = openingFor(battleId, a);
          const pct = ret != null ? ret * 100 : null;
          const up = (pct ?? 0) >= 0;
          const col = colors[a] ?? "#111";
          return (
            <div key={a} style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 2 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: col, display: "inline-block" }} />
                <span style={{ fontSize: 13, fontWeight: 800, color: "#111" }}>{a}</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: pct == null ? "#bbb" : up ? "#16a34a" : "#dc2626", lineHeight: 1.1, fontFamily: "monospace" }}>
                {pct == null ? "—" : `${up ? "▲ +" : "▼ "}${pct.toFixed(2)}%`}
              </div>
              <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>
                {open != null && cur != null
                  ? `${fmtUsd(open)} → ${fmtUsd(cur)}`
                  : "waiting for price feed…"}
              </div>
            </div>
          );
        })}
      </div>

      {/* Graph */}
      <PriceGraph battleId={battleId} series={series} windowMs={windowMs} height={180} />
    </div>
  );
}

function parseDurationLabel(label?: string): number {
  if (!label) return 60 * 60 * 1000;
  const m = /^(\d+)(m|h)$/.exec(label.trim());
  if (!m) return 60 * 60 * 1000;
  return Number(m[1]) * (m[2] === "h" ? 3_600_000 : 60_000);
}

function fmtUsd(n: number): string {
  if (n >= 1000) return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (n >= 1) return "$" + n.toFixed(2);
  return "$" + n.toFixed(4);
}
