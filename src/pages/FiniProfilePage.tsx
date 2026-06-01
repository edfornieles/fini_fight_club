import { asset } from "../lib/assetUrl";
import { useParams, Link } from "react-router-dom";
import { useFiniRecords, computeFiniPower, tierFor, xpToNextLevel, fmtRestTime } from "../state/finiRecords";

const S = { fontFamily: "'Nunito', system-ui, sans-serif" };

const CLAN_TINTS: Record<string, string> = {
  "Arms of the State": "#b8c8d8", "Hourly": "#c8b4a0", "Townspeople": "#d4cfa0",
  "Artists": "#d4a4a0", "Soldiers": "#b0b0c8", "Twice Daily": "#a8c8d8",
  "Miners": "#b8a890", "Farmers": "#a8b8a0",
};

const FAMILY_INFO: Record<string, { name: string; color: string; emoji: string }> = {
  BTC:  { name: "Bitcoin",   color: "#f7931a", emoji: "👑" },
  ETH:  { name: "Ethereum",  color: "#627eea", emoji: "🔮" },
  SOL:  { name: "Solana",    color: "#9945ff", emoji: "⚡" },
  DOGE: { name: "Dogecoin",  color: "#c3a634", emoji: "🐕" },
  LINK: { name: "Chainlink", color: "#2a5ada", emoji: "🔗" },
  UNI:  { name: "Uniswap",   color: "#ff007a", emoji: "🦄" },
  AVAX: { name: "Avalanche", color: "#e84142", emoji: "🏔" },
  BNB:  { name: "BNB",       color: "#f3ba2f", emoji: "⭕" },
  MATIC:{ name: "Polygon",   color: "#8247e5", emoji: "🔷" },
  XTZ:  { name: "Tezos",     color: "#a6e000", emoji: "🧊" },
};

// Mock metadata — in production from /api/fini/[id] (chain + db join)
const MOCK_METADATA: Record<number, { family: string; clan: string; mintedAt: string }> = {
  4104: { family: "BTC", clan: "Arms of the State", mintedAt: "2023-03-14" },
  2847: { family: "ETH", clan: "Artists",           mintedAt: "2023-04-21" },
  3201: { family: "SOL", clan: "Soldiers",          mintedAt: "2023-05-09" },
  5102: { family: "DOGE",clan: "Miners",            mintedAt: "2023-06-17" },
  6010: { family: "LINK",clan: "Twice Daily",       mintedAt: "2023-07-02" },
  9100: { family: "XTZ", clan: "Farmers",           mintedAt: "2023-08-11" },
};

// Mock trade history (Transfer events). In production: scan ERC-721 Transfer logs.
const MOCK_TRADES: Record<number, { date: string; from: string; to: string; price: string; tx: string }[]> = {
  4104: [
    { date: "2023-03-14", from: "0x0000...mint",     to: "0x84a1...4ed5", price: "0.05 ETH", tx: "0xabc1...d3" },
    { date: "2024-01-22", from: "0x84a1...4ed5",     to: "0xbb2f...991e", price: "0.34 ETH", tx: "0xdef4...9a" },
    { date: "2025-09-08", from: "0xbb2f...991e",     to: "0xd275...C9dD", price: "0.81 ETH", tx: "0x102f...2b" },
  ],
  2847: [
    { date: "2023-04-21", from: "0x0000...mint",     to: "0xd275...C9dD", price: "0.05 ETH", tx: "0xaa7e...8c" },
  ],
  3201: [
    { date: "2023-05-09", from: "0x0000...mint",     to: "0x77ee...1234", price: "0.05 ETH", tx: "0xbb01...4f" },
    { date: "2024-11-30", from: "0x77ee...1234",     to: "0xd275...C9dD", price: "0.42 ETH", tx: "0xcc09...7a" },
  ],
};

// Mock battle history per Fini (last N battles)
const MOCK_BATTLE_HISTORY: { date: string; opponent: string; result: "win" | "loss" | "draw"; xp: number }[] = [
  { date: "2026-05-31 14:02", opponent: "market_mage",  result: "win",  xp: 30 },
  { date: "2026-05-30 21:14", opponent: "_dani_eth",    result: "win",  xp: 30 },
  { date: "2026-05-29 18:40", opponent: "_0xpresley",   result: "loss", xp:  6 },
  { date: "2026-05-28 12:11", opponent: "_shl0ms",      result: "win",  xp: 30 },
  { date: "2026-05-27 09:55", opponent: "_d0unbug",     result: "draw", xp: 12 },
];

const CONTRACT_ADDR = "0x5a0121a0a21232ec0d024dab9017314509026480"; // real Finiliar contract

function slugify(s: string) { return s.toLowerCase().replace(/'/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""); }

export function FiniProfilePage() {
  const { tokenId: idStr } = useParams<{ tokenId: string }>();
  const tokenId = parseInt(idStr ?? "0", 10);
  const record = useFiniRecords(s => s.records[tokenId]) ?? {
    tokenId, wins: 0, losses: 0, draws: 0, xp: 0, level: 1,
    lastBattleAt: null, restingUntil: null, traitsEarned: [],
  };
  const isResting = useFiniRecords(s => s.isResting(tokenId));
  const restMs    = useFiniRecords(s => s.restingMsLeft(tokenId));

  const meta = MOCK_METADATA[tokenId] ?? { family: "ETH", clan: "Artists", mintedAt: "2024-01-01" };
  const family = FAMILY_INFO[meta.family];
  const clanTint = CLAN_TINTS[meta.clan] ?? "#d4d4d4";
  const power = computeFiniPower(record);
  const tier = tierFor(power);
  const xpInfo = xpToNextLevel(record.xp);
  const totalBattles = record.wins + record.losses + record.draws;
  const winRate = totalBattles > 0 ? Math.round((record.wins / totalBattles) * 100) : 0;
  const trades = MOCK_TRADES[tokenId] ?? [{ date: meta.mintedAt, from: "0x0000...mint", to: "0xd275...C9dD", price: "0.05 ETH", tx: "0xaa00...01" }];
  const openseaUrl = `https://opensea.io/assets/ethereum/${CONTRACT_ADDR}/${tokenId}`;
  const etherscanUrl = `https://etherscan.io/token/${CONTRACT_ADDR}?a=${tokenId}`;

  return (
    <div style={{ ...S, background: "#f8f9fa", minHeight: "100vh" }}>
      {/* Hero */}
      <div style={{
        background: `linear-gradient(135deg, ${family.color}18 0%, ${family.color}06 100%)`,
        borderBottom: "1px solid #f0f0f0",
        padding: "32px 48px 28px",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <Link to="/account" style={{ fontSize: 13, color: "#888", textDecoration: "none", fontWeight: 600 }}>
            ← My Stable
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 24, marginTop: 14 }}>
            {/* Artwork */}
            <div style={{
              width: 156, height: 156, borderRadius: 24,
              background: clanTint, position: "relative",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
              flexShrink: 0,
            }}>
              <img src={asset(`/clan-art/${slugify(meta.clan)}.gif`)} alt={meta.clan} style={{ height: 130, width: "auto", objectFit: "contain", filter: isResting ? "grayscale(0.6)" : "none" }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
              {/* Level badge */}
              <div style={{
                position: "absolute", bottom: 8, left: 8,
                background: "linear-gradient(135deg, #fde047, #f59e0b)",
                color: "#854d0e", fontSize: 12, fontWeight: 900,
                padding: "3px 11px", borderRadius: 100,
                boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
              }}>
                LVL {record.level}
              </div>
              {isResting && (
                <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.55)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderRadius: 24 }}>
                  <div style={{ fontSize: 24 }}>💤</div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#666" }}>Resting</div>
                  <div style={{ fontSize: 10, color: "#888", fontFamily: "monospace" }}>{fmtRestTime(restMs)}</div>
                </div>
              )}
            </div>

            {/* Name + meta */}
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: 34, fontWeight: 900, color: "#111", margin: 0, display: "flex", alignItems: "center", gap: 14 }}>
                Fini #{tokenId}
                <span style={{ fontSize: 14, fontWeight: 700, padding: "4px 12px", borderRadius: 100, background: family.color + "22", color: family.color }}>
                  {family.emoji} {meta.family}
                </span>
              </h1>
              <div style={{ fontSize: 15, color: "#666", marginTop: 6, fontWeight: 600 }}>
                {meta.clan} · {family.name} family · minted {new Date(meta.mintedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </div>
              {record.traitsEarned.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
                  {record.traitsEarned.map(t => (
                    <span key={t} style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 100, background: "#fdf0f7", color: "#be185d" }}>✦ {t}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Power tier */}
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em" }}>Power Rating</div>
              <div style={{ fontSize: 32, fontWeight: 900, color: "#111", lineHeight: 1 }}>{power.toLocaleString()}</div>
              <div style={{ marginTop: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 800, padding: "4px 12px", borderRadius: 100, background: tier.color + "22", color: tier.color }}>
                  {tier.name}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 48px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>

        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Card title="Battle Record" subtitle="Lifetime stats for this Fini">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 14 }}>
              <Stat label="Wins"   value={record.wins}    color="#16a34a" />
              <Stat label="Losses" value={record.losses}  color="#dc2626" />
              <Stat label="Draws"  value={record.draws}   color="#888" />
            </div>
            <div style={{ background: "#f9fafb", borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#666", marginBottom: 6 }}>
                <span>Win rate</span><span style={{ fontWeight: 800, color: "#111" }}>{winRate}%</span>
              </div>
              <div style={{ height: 8, borderRadius: 100, background: "#e5e7eb", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${winRate}%`, background: "linear-gradient(90deg, #22c55e, #16a34a)" }} />
              </div>
              <div style={{ fontSize: 11, color: "#888", marginTop: 8 }}>{totalBattles} total battles</div>
            </div>
          </Card>

          <Card title="Experience" subtitle={`Level ${record.level} · ${record.xp.toLocaleString()} XP total`}>
            <div style={{ background: "linear-gradient(135deg, #fef3c7, #fde68a)", borderRadius: 12, padding: "16px 18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#854d0e", fontWeight: 700, marginBottom: 8 }}>
                <span>Level {record.level}</span>
                <span>{xpInfo.current} / {xpInfo.needed} XP</span>
              </div>
              <div style={{ height: 10, borderRadius: 100, background: "rgba(133,77,14,0.2)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${xpInfo.pct}%`, background: "linear-gradient(90deg, #f59e0b, #d97706)", borderRadius: 100 }} />
              </div>
              <div style={{ fontSize: 11, color: "#854d0e", marginTop: 6, fontWeight: 600 }}>
                {xpInfo.needed - xpInfo.current} XP to Level {record.level + 1}
              </div>
            </div>
            <div style={{ fontSize: 11, color: "#888", lineHeight: 1.6, marginTop: 10 }}>
              XP is earned through battle: <strong>+30</strong> for a win, <strong>+12</strong> for a draw, <strong>+6</strong> for a loss. Stats scale with level. <strong>XP follows the NFT</strong> through every sale.
            </div>
          </Card>

          <Card title="Battle History" subtitle="Last 5 battles">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {MOCK_BATTLE_HISTORY.map((b, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10, background: "#f9fafb" }}>
                  <span style={{
                    fontSize: 10, fontWeight: 800, padding: "3px 9px", borderRadius: 100,
                    background: b.result === "win" ? "#dcfce7" : b.result === "loss" ? "#fee2e2" : "#f3f4f6",
                    color:      b.result === "win" ? "#15803d" : b.result === "loss" ? "#dc2626" : "#666",
                  }}>{b.result.toUpperCase()}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>vs {b.opponent}</div>
                    <div style={{ fontSize: 11, color: "#aaa" }}>{b.date}</div>
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#854d0e" }}>+{b.xp} XP</div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Card title="Trade History" subtitle="On-chain transfers of this Fini">
            <div style={{ display: "flex", flexDirection: "column", gap: 0, borderLeft: "2px solid #e5e7eb", paddingLeft: 16 }}>
              {trades.map((t, i) => (
                <div key={i} style={{ paddingBottom: 14, position: "relative" }}>
                  <div style={{
                    position: "absolute", left: -22, top: 5,
                    width: 10, height: 10, borderRadius: "50%",
                    background: t.from.includes("mint") ? "#22c55e" : "#a78bfa",
                    border: "2px solid #fff",
                  }} />
                  <div style={{ fontSize: 11, color: "#aaa", fontFamily: "monospace" }}>{t.date}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#111", marginTop: 2 }}>
                    {t.from.includes("mint") ? "🌱 Minted to " : "🔄 Transfer to "}
                    <span style={{ fontFamily: "monospace", fontSize: 12 }}>{t.to}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#888", marginTop: 4 }}>
                    <span>from <span style={{ fontFamily: "monospace" }}>{t.from}</span></span>
                    <span style={{ fontWeight: 700, color: "#16a34a" }}>{t.price}</span>
                  </div>
                  <a href={`https://etherscan.io/tx/${t.tx}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: "#a78bfa", textDecoration: "none", fontFamily: "monospace" }}>
                    {t.tx} ↗
                  </a>
                </div>
              ))}
            </div>
          </Card>

          <Card title="External Links" subtitle="View this Fini on-chain">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <ExtLink href={openseaUrl}  icon="🌊" label="View on OpenSea"        sub="Marketplace listing & traits" />
              <ExtLink href={etherscanUrl} icon="⛓" label="View on Etherscan"      sub="Transaction history" />
              <ExtLink href={`https://looksrare.org/collections/${CONTRACT_ADDR}/${tokenId}`} icon="👁" label="View on LooksRare" sub="Alternative marketplace" />
            </div>
            <div style={{ fontSize: 10, color: "#bbb", marginTop: 12, fontFamily: "monospace", wordBreak: "break-all", padding: "8px 10px", background: "#f9fafb", borderRadius: 8 }}>
              Contract: {CONTRACT_ADDR}<br />Token ID: {tokenId}
            </div>
          </Card>

          <Card title="Rest Cooldown" subtitle="When this Fini can battle next">
            {isResting ? (
              <div style={{ background: "linear-gradient(135deg, #dbeafe, #bfdbfe)", borderRadius: 12, padding: "16px 18px", textAlign: "center" }}>
                <div style={{ fontSize: 24, marginBottom: 6 }}>💤</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#1e40af" }}>Resting</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: "#111", marginTop: 4, fontFamily: "monospace" }}>{fmtRestTime(restMs)}</div>
                <div style={{ fontSize: 11, color: "#1e40af", marginTop: 8, fontWeight: 600 }}>
                  Only losing Finis rest. Winners stay fresh and can battle again immediately.
                </div>
              </div>
            ) : (
              <div style={{ background: "#dcfce7", borderRadius: 12, padding: "16px 18px", textAlign: "center" }}>
                <div style={{ fontSize: 24, marginBottom: 6 }}>⚔️</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#15803d" }}>Ready for battle</div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", borderRadius: 20, border: "1.5px solid #f0f0f0", padding: "22px 24px" }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#111" }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: "#aaa", marginTop: 2 }}>{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: "#f9fafb", borderRadius: 12, padding: "12px", textAlign: "center" }}>
      <div style={{ fontSize: 10, color: "#aaa", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function ExtLink({ href, icon, label, sub }: { href: string; icon: string; label: string; sub: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "12px 14px", borderRadius: 12,
      background: "#f9fafb", border: "1.5px solid transparent",
      textDecoration: "none", transition: "all 0.12s",
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#fdf0f7"; (e.currentTarget as HTMLElement).style.borderColor = "#f472b6"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#f9fafb"; (e.currentTarget as HTMLElement).style.borderColor = "transparent"; }}
    >
      <span style={{ fontSize: 22 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#111" }}>{label}</div>
        <div style={{ fontSize: 11, color: "#888" }}>{sub}</div>
      </div>
      <span style={{ color: "#bbb" }}>↗</span>
    </a>
  );
}
