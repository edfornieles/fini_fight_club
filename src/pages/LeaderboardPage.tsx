import { Link } from "react-router-dom";
import { useLivePrices, fmtChange } from "../hooks/useLivePrices";

const S = { fontFamily: "'Nunito', system-ui, sans-serif" };

// ─── Mock data ────────────────────────────────────────────────────────────────
// In production these come from server views. Today they're seeded so the page
// has visible content; structure mirrors what the real queries will return.

// 1. Crypto Arena — top players ranked by net FINI$ won across prediction battles.
const CRYPTO_ARENA_TOP_PLAYERS = [
  { rank: 1, name: "samspike",     wallet: "0x18ce6cd5c283dca2f50c8347420607a4e59716a6", netFini: 84_230, totalPredictions: 412, winRate: 0.62 },
  { rank: 2, name: "jorgelopez",   wallet: "0x6266dbb2d202d4e246ee86d76bb2fbb9a71eafcd", netFini: 61_540, totalPredictions: 328, winRate: 0.59 },
  { rank: 3, name: "presley",      wallet: "0x28d2d8d8780ff95d94689ce59f031cf829a41d40", netFini: 47_900, totalPredictions: 286, winRate: 0.58 },
  { rank: 4, name: "llovd",        wallet: "0xcbbea7ec33d60db283ab79bdac9ffbfa46a83134", netFini: 32_180, totalPredictions: 241, winRate: 0.55 },
  { rank: 5, name: "dollar.monopoly", wallet: "0x5c47c9ab05716d26d6e339eb19d2be3a0b0b097e", netFini: 28_640, totalPredictions: 218, winRate: 0.54 },
  { rank: 6, name: "market.mage",  wallet: "0x742baddef042d6d829de8d40dc04ffbe7c5a4532", netFini: 21_410, totalPredictions: 186, winRate: 0.53 },
  { rank: 7, name: "baker.council",wallet: "0xd3ccafe9c823b04c7d10ce6b3c1fcd0ddf3ec1fb", netFini: 16_820, totalPredictions: 154, winRate: 0.52 },
  { rank: 8, name: "jakeyewan",    wallet: "0x57a4231d7c4f4e2c69e1ea0a8e7e9e3edf2c8e12", netFini: 12_960, totalPredictions: 138, winRate: 0.51 },
];

// 2. Fight Club — best 3v3 teams by win count
const FIGHT_CLUB_TOP_TEAMS = [
  { rank: 1, teamName: "Volatility Cult",     owner: "samspike",       wins: 142, members: 3, family: "ETH" },
  { rank: 2, teamName: "BTC Mountain",        owner: "dani",           wins: 118, members: 3, family: "BTC" },
  { rank: 3, teamName: "Solar Flare Squad",   owner: "presley",        wins: 94,  members: 3, family: "SOL" },
  { rank: 4, teamName: "Diamond Pawed Dogs",  owner: "dollar.monopoly",wins: 81,  members: 3, family: "DOGE" },
  { rank: 5, teamName: "Oracle Whisperers",   owner: "llovd",          wins: 72,  members: 3, family: "LINK" },
  { rank: 6, teamName: "Pastel Panic",        owner: "market.mage",    wins: 68,  members: 3, family: "MATIC" },
];

// 2b. Fight Club — individual Finis ranked by total damage dealt across battles
const FIGHT_CLUB_TOP_DAMAGE = [
  { rank: 1, tokenId: 4104, family: "BTC",  clan: "Arms of the State", totalDamage: 124_810, kos: 312, owner: "samspike" },
  { rank: 2, tokenId: 2847, family: "ETH",  clan: "Artists",           totalDamage:  98_220, kos: 256, owner: "jorgelopez" },
  { rank: 3, tokenId: 7291, family: "SOL",  clan: "Soldiers",          totalDamage:  88_410, kos: 241, owner: "llovd" },
  { rank: 4, tokenId: 1062, family: "DOGE", clan: "Townspeople",       totalDamage:  71_530, kos: 189, owner: "edfornieles" },
  { rank: 5, tokenId: 4103, family: "BTC",  clan: "Miners",            totalDamage:  64_280, kos: 174, owner: "dollar.monopoly" },
  { rank: 6, tokenId: 8801, family: "LINK", clan: "Hourly",            totalDamage:  58_910, kos: 161, owner: "jakeyewan" },
];

// 3. The 10 asset families — change24h is filled from live prices when available
const FAMILY_META: Record<string, { name: string; emoji: string; color: string }> = {
  BTC:   { name: "BTC",   emoji: "₿", color: "#f7931a" },
  ETH:   { name: "ETH",   emoji: "Ξ", color: "#627eea" },
  SOL:   { name: "SOL",   emoji: "◎", color: "#9945ff" },
  DOGE:  { name: "DOGE",  emoji: "🐕", color: "#c3a634" },
  BNB:   { name: "BNB",   emoji: "⬡", color: "#f3ba2f" },
  LINK:  { name: "LINK",  emoji: "🔗", color: "#2a5ada" },
  AVAX:  { name: "AVAX",  emoji: "🏔", color: "#e84142" },
  UNI:   { name: "UNI",   emoji: "🦄", color: "#ff007a" },
  MATIC: { name: "MATIC", emoji: "🔷", color: "#8247e5" },
  XTZ:   { name: "XTZ",   emoji: "🧊", color: "#a6e000" },
};

const CLAN_TINTS: Record<string, string> = {
  "Arms of the State": "#b8c8d8", "Hourly": "#c8b4a0", "Townspeople": "#d4cfa0",
  "Artists": "#d4a4a0", "Soldiers": "#b0b0c8", "Twice Daily": "#a8c8d8",
  "Miners": "#b8a890", "Farmers": "#a8b8a0",
};

export function LeaderboardPage() {
  const { prices } = useLivePrices();

  // Build the 24h family ranking from live prices, sorted by % change desc.
  const familyRanking = Object.entries(FAMILY_META)
    .map(([sym, meta]) => ({
      sym,
      ...meta,
      change24h: prices[sym]?.usd_24h_change ?? 0,
      price: prices[sym]?.usd ?? 0,
    }))
    .sort((a, b) => b.change24h - a.change24h);

  return (
    <div style={{ ...S, background: "#f8f9fa", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #f0f0f0", padding: "36px 48px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <h1 style={{ fontSize: 30, fontWeight: 900, color: "#111", margin: 0 }}>🏅 Leaderboard</h1>
          <p style={{ fontSize: 14, color: "#888", marginTop: 6, marginBottom: 0, fontWeight: 500 }}>
            Top performers across the Fini universe — battle-tested.
          </p>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 48px", display: "flex", flexDirection: "column", gap: 40 }}>

        {/* ─── Section 1 — Crypto Arena ───────────────────────────────────── */}
        <Section
          number={1}
          icon="🎯"
          title="Crypto Arena Champions"
          subtitle="Players with the highest net FINI$ won across prediction battles"
          accent="#f472b6"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {CRYPTO_ARENA_TOP_PLAYERS.map(p => (
              <PlayerRow key={p.rank} player={p} />
            ))}
          </div>
        </Section>

        {/* ─── Section 2 — Fight Club ─────────────────────────────────────── */}
        <Section
          number={2}
          icon="⚔️"
          title="Fight Club"
          subtitle="Top auto-battler teams and the Finis dealing the most damage"
          accent="#a78bfa"
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {/* Best teams */}
            <SubCard title="Top Teams" subtitle="3v3 lineups with the most wins">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {FIGHT_CLUB_TOP_TEAMS.map(t => <TeamRow key={t.rank} team={t} />)}
              </div>
            </SubCard>

            {/* Top damage dealers */}
            <SubCard title="Top Damage Dealers" subtitle="Single Finis by total damage across all battles">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {FIGHT_CLUB_TOP_DAMAGE.map(d => <DamageRow key={d.rank} fini={d} />)}
              </div>
            </SubCard>
          </div>
        </Section>

        {/* ─── Section 3 — Most Successful Family (24h) ───────────────────── */}
        <Section
          number={3}
          icon="📈"
          title="Most Successful Family · 24h"
          subtitle="Live ranking by 24-hour price change — pulled from CoinGecko + Coinbase + Binance"
          accent="#22c55e"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Champion banner — top mover */}
            {familyRanking[0] && <FamilyChampionBanner family={familyRanking[0]} />}

            {/* Full ranking list */}
            <div style={{ background: "#fff", borderRadius: 16, border: "1.5px solid #f0f0f0", padding: 16 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {familyRanking.map((f, i) => <FamilyRow key={f.sym} rank={i + 1} family={f} />)}
              </div>
            </div>
          </div>
        </Section>

      </div>
    </div>
  );
}

// ─── Row components ─────────────────────────────────────────────────────────

function PlayerRow({ player }: { player: typeof CRYPTO_ARENA_TOP_PLAYERS[number] }) {
  const short = `${player.wallet.slice(0, 6)}…${player.wallet.slice(-4)}`;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: "12px 16px", borderRadius: 12,
      background: "#fff", border: "1.5px solid #f0f0f0",
    }}>
      <RankBadge rank={player.rank} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#111" }}>{player.name}</div>
        <div style={{ fontSize: 11, color: "#888", fontFamily: "monospace" }}>{short}</div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 900, color: "#854d0e" }}>
          +{player.netFini.toLocaleString()} <span style={{ fontSize: 10, color: "#888", fontWeight: 600 }}>FINI$</span>
        </div>
        <div style={{ fontSize: 10, color: "#aaa" }}>
          {player.totalPredictions} predictions · {Math.round(player.winRate * 100)}% win rate
        </div>
      </div>
    </div>
  );
}

function TeamRow({ team }: { team: typeof FIGHT_CLUB_TOP_TEAMS[number] }) {
  const color = FAMILY_META[team.family]?.color ?? "#888";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "10px 12px", borderRadius: 10,
      background: "#fff", border: "1.5px solid #f0f0f0",
    }}>
      <RankBadge rank={team.rank} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#111" }}>{team.teamName}</div>
        <div style={{ fontSize: 10, color: "#888" }}>by {team.owner}</div>
      </div>
      <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 100, background: color + "20", color }}>
        {team.family}
      </span>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 900, color: "#111" }}>{team.wins}</div>
        <div style={{ fontSize: 9, color: "#888", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>wins</div>
      </div>
    </div>
  );
}

function DamageRow({ fini }: { fini: typeof FIGHT_CLUB_TOP_DAMAGE[number] }) {
  return (
    <Link to={`/fini/${fini.tokenId}`} style={{ textDecoration: "none", color: "inherit" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "10px 12px", borderRadius: 10,
        background: "#fff", border: "1.5px solid #f0f0f0",
        cursor: "pointer", transition: "background 0.12s",
      }}
        onMouseEnter={e => (e.currentTarget.style.background = "#fafafa")}
        onMouseLeave={e => (e.currentTarget.style.background = "#fff")}
      >
        <RankBadge rank={fini.rank} />
        <div style={{
          width: 30, height: 30, borderRadius: "50%",
          background: CLAN_TINTS[fini.clan] ?? "#ddd",
          overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <img src={`/clan-art/${slugify(fini.clan)}.gif`} alt="" style={{ height: 26 }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#111" }}>
            #{fini.tokenId} <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 100, background: "#f3f4f6", color: "#666" }}>{fini.family}</span>
          </div>
          <div style={{ fontSize: 10, color: "#888" }}>{fini.clan}</div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: "#dc2626" }}>
            {fini.totalDamage.toLocaleString()} <span style={{ fontSize: 9, color: "#888", fontWeight: 600 }}>DMG</span>
          </div>
          <div style={{ fontSize: 10, color: "#aaa" }}>{fini.kos} KOs</div>
        </div>
      </div>
    </Link>
  );
}

// ─── 24h family champion banner + row ──────────────────────────────────────

interface FamilyRanked { sym: string; name: string; emoji: string; color: string; change24h: number; price: number }

function FamilyChampionBanner({ family }: { family: FamilyRanked }) {
  const positive = family.change24h >= 0;
  return (
    <div style={{
      background: `linear-gradient(135deg, ${family.color}22, ${family.color}08)`,
      borderRadius: 20, padding: "24px 28px",
      border: `1.5px solid ${family.color}40`,
      display: "flex", alignItems: "center", gap: 20,
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: "50%",
        background: family.color + "30", border: `3px solid ${family.color}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 32, flexShrink: 0,
      }}>
        {family.emoji}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: family.color, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>
          👑 Today's biggest mover
        </div>
        <div style={{ fontSize: 24, fontWeight: 900, color: "#111" }}>{family.name}</div>
        <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>
          ${family.price > 1 ? family.price.toLocaleString("en-US", { maximumFractionDigits: 2 }) : family.price.toFixed(4)}
          <span style={{ color: positive ? "#16a34a" : "#dc2626", fontWeight: 800, marginLeft: 10 }}>
            {positive ? "▲" : "▼"} {fmtChange(family.change24h)}
          </span>
        </div>
      </div>
      <Link to={`/crypto/${family.sym.toLowerCase()}`} style={{
        padding: "10px 18px", borderRadius: 100,
        background: family.color, color: "#fff",
        fontSize: 13, fontWeight: 800, textDecoration: "none",
        flexShrink: 0,
      }}>
        View battles →
      </Link>
    </div>
  );
}

function FamilyRow({ rank, family }: { rank: number; family: FamilyRanked }) {
  const positive = family.change24h >= 0;
  return (
    <Link to={`/crypto/${family.sym.toLowerCase()}`} style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "8px 12px", borderRadius: 8,
      textDecoration: "none", color: "inherit",
      transition: "background 0.12s",
    }}
      onMouseEnter={e => (e.currentTarget.style.background = "#fafafa")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
    >
      <RankBadge rank={rank} />
      <div style={{
        width: 28, height: 28, borderRadius: "50%",
        background: family.color + "20", border: `1.5px solid ${family.color}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 13, flexShrink: 0,
      }}>{family.emoji}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#111" }}>{family.name}</div>
      </div>
      <div style={{ fontSize: 12, color: "#666", fontFamily: "monospace", textAlign: "right", minWidth: 80 }}>
        ${family.price > 1 ? family.price.toLocaleString("en-US", { maximumFractionDigits: 2 }) : family.price.toFixed(4)}
      </div>
      <div style={{ fontSize: 13, color: positive ? "#16a34a" : "#dc2626", fontWeight: 800, textAlign: "right", minWidth: 70 }}>
        {positive ? "▲" : "▼"} {fmtChange(family.change24h)}
      </div>
    </Link>
  );
}

// ─── Layout helpers ────────────────────────────────────────────────────────

function Section({ number, icon, title, subtitle, accent, children }: {
  number: number; icon: string; title: string; subtitle: string; accent: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          background: accent + "20", color: accent,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, fontWeight: 900, flexShrink: 0,
        }}>
          {number}
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#111" }}>{icon} {title}</div>
          <div style={{ fontSize: 12, color: "#888", fontWeight: 500, marginTop: 2 }}>{subtitle}</div>
        </div>
      </div>
      {children}
    </section>
  );
}

function SubCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", borderRadius: 16, border: "1.5px solid #f0f0f0", padding: "18px 20px" }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#111" }}>{title}</div>
        <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>{subtitle}</div>
      </div>
      {children}
    </div>
  );
}

function RankBadge({ rank, size = 22 }: { rank: number; size?: number }) {
  const top3 = rank <= 3;
  const bg = rank === 1 ? "#fde047" : rank === 2 ? "#d1d5db" : rank === 3 ? "#fdba74" : "#f3f4f6";
  const color = rank === 1 ? "#854d0e" : rank === 2 ? "#374151" : rank === 3 ? "#7c2d12" : "#888";
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: bg, color, fontSize: size * 0.5, fontWeight: 800,
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0,
      boxShadow: top3 ? `0 0 0 1.5px ${color}30` : "none",
    }}>
      {rank}
    </div>
  );
}

function slugify(s: string) {
  return s.toLowerCase().replace(/'/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}
