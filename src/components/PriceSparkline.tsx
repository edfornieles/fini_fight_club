/**
 * A price sparkline (area + line) sized to fill its relative parent. Drawn as
 * the backdrop behind the Explore Fini so you can read the coin's recent
 * performance across the card — green/up, red/down.
 */
export function PriceSparkline({ prices, up, opacity = 0.5 }: {
  prices: number[];
  up: boolean;
  opacity?: number;
}) {
  if (!prices || prices.length < 2) return null;
  const W = 100, H = 100;
  const min = Math.min(...prices), max = Math.max(...prices);
  const span = max - min || 1;
  const pts = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * W;
    const y = H - ((p - min) / span) * H * 0.8 - H * 0.1; // 10% padding top/bottom
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`).join(" ");
  const area = `${line} L${W} ${H} L0 ${H} Z`;
  const color = up ? "#16a34a" : "#dc2626";
  const gid = `spark-${up ? "u" : "d"}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity, pointerEvents: "none" }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.4} strokeOpacity={0.7}
        vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
