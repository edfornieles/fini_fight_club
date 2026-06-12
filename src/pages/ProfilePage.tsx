import { useState } from "react";
import { useUIStore } from "../state/uiStore";
import { useCoinStore } from "../state/coinStore";
import { useMyEntries } from "../state/myEntriesStore";
import { Link } from "react-router-dom";
import { ConnectWalletButton } from "../components/ConnectWalletButton";
import { ActivityHub } from "../components/ActivityHub";
import { BetHistoryList } from "../components/BetHistory";
import { useBetHistory } from "../hooks/useBetHistory";

const S = { fontFamily: "'Nunito', system-ui, sans-serif" };

// Mock stats — in production from server
const MOCK_STATS = {
  finiCoinBalance: 30_000,
  finiCoinWon: 12_400,
  finiCoinSpent: 8_600,
  battlesPlayed: 47,
  battlesWon: 28,
  battlesLost: 19,
  winRate: 0.596,
  ranking: 142,
  totalPlayers: 4820,
  joinedDate: "2026-05-15",
  bestStreak: 7,
  finisOwned: 13,
  daysActive: 23,
};

export function ProfilePage() {
  const { walletAddress } = useUIStore();
  const balance = useCoinStore(s => s.balance);
  const entries = useMyEntries(s => s.entries);
  // Real server-backed bet history + record for this wallet.
  const { bets, stats, loading: histLoading } = useBetHistory(walletAddress);
  // Economy figures: prefer the real settled totals; fall back to local entries
  // (offline/dev) when the server history is empty.
  const finiCoinSpent = stats.staked || entries.reduce((sum, e) => sum + e.stake, 0);
  const finiCoinWon = stats.returned || entries.reduce((sum, e) => sum + (e.status === "won" ? (e.result?.payout ?? 0) : 0), 0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  function saveProfile() {
    setSavedAt(new Date());
    setTimeout(() => setSavedAt(null), 2500);
  }

  function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert("Image must be under 2MB"); return; }
    const reader = new FileReader();
    reader.onload = ev => setAvatar(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  if (!walletAddress) {
    return (
      <div style={{ ...S, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, background: "#f8f9fa" }}>
        <div style={{ fontSize: 48 }}>👤</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#111" }}>Connect wallet to view your Profile</div>
        <ConnectWalletButton />
      </div>
    );
  }

  const winRatePct = stats.won + stats.lost > 0 ? stats.winRatePct : Math.round(MOCK_STATS.winRate * 100);

  return (
    <div style={{ ...S, background: "#f8f9fa", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #f0f0f0", padding: "32px 48px 28px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: "#111", margin: 0 }}>👤 Profile</h1>
          <div style={{ fontSize: 13, color: "#888", marginTop: 4, fontFamily: "monospace" }}>
            {walletAddress.slice(0, 10)}...{walletAddress.slice(-4)}
            {stats.firstAt && <span> · first played {new Date(stats.firstAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>}
          </div>
        </div>
      </div>

      {/* Primary content: forecast track record — the player's own activity */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 48px 0", display: "flex", flexDirection: "column", gap: 24 }}>
        <ActivityHub />
        <BetHistoryList bets={bets} loading={histLoading} />
      </div>

      {/* Secondary: account settings + avatar etc. */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 48px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>

        {/* Left: editable profile info */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Card title="Player Info" subtitle="Your name and contact details">
            {/* Avatar upload */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 18 }}>
              <label style={{ position: "relative", cursor: "pointer" }}>
                <div style={{
                  width: 88, height: 88, borderRadius: "50%",
                  background: avatar ? `url(${avatar}) center/cover` : "linear-gradient(135deg, #fce7f3, #fbcfe8)",
                  border: "3px solid #f472b6",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 36, color: "#f472b6", overflow: "hidden",
                }}>
                  {!avatar && "👤"}
                </div>
                {/* Edit overlay */}
                <div style={{
                  position: "absolute", bottom: 0, right: 0,
                  width: 28, height: 28, borderRadius: "50%",
                  background: "#f472b6", color: "#fff",
                  border: "2px solid #fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, fontWeight: 800,
                }}>📷</div>
                <input type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: "none" }} />
              </label>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#111" }}>{name || "Your profile picture"}</div>
                <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>Click the avatar to upload an image (max 2MB)</div>
                {avatar && (
                  <button onClick={() => setAvatar(null)} style={{ marginTop: 8, fontSize: 11, color: "#dc2626", background: "none", border: "none", padding: 0, cursor: "pointer", fontWeight: 700 }}>
                    Remove image
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Field label="Display Name">
                <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. sam_spike" style={inputStyle} />
              </Field>
              <Field label="Email">
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" style={inputStyle} />
                <div style={{ fontSize: 11, color: "#bbb", marginTop: 4 }}>Used for battle notifications and account recovery</div>
              </Field>
              <Field label="Bio (optional)">
                <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell other players about your battle style..." rows={3} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
              </Field>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 18, alignItems: "center" }}>
              <button onClick={saveProfile} style={{ background: "#f472b6", color: "#fff", border: "none", borderRadius: 100, padding: "11px 26px", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>
                Save Profile
              </button>
              {savedAt && <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 700 }}>✓ Saved at {savedAt.toLocaleTimeString()}</span>}
            </div>
          </Card>

          <Card title="Connected Wallet" subtitle="Wallet linked to this Fini account">
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "#f9fafb", borderRadius: 12 }}>
              <span style={{ fontSize: 20 }}>👛</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontFamily: "monospace", fontWeight: 700, color: "#111" }}>{walletAddress}</div>
                <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>Ethereum mainnet</div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 100, background: "#dcfce7", color: "#15803d" }}>✓ Connected</span>
            </div>
          </Card>

          <Card title="Notifications" subtitle="Choose when we ping you">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { label: "Battle wins", default: true },
                { label: "Daily CUTE$ grant", default: true },
                { label: "Tournament invites", default: false },
                { label: "Newsletter", default: false },
              ].map(opt => (
                <label key={opt.label} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#333", fontWeight: 600, cursor: "pointer" }}>
                  <input type="checkbox" defaultChecked={opt.default} style={{ accentColor: "#f472b6", width: 16, height: 16 }} />
                  {opt.label}
                </label>
              ))}
            </div>
          </Card>
        </div>

        {/* Right: stats */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* CUTE$ Balance */}
          <Card title="🪙 CUTE$" subtitle="Your in-game currency balance">
            <div style={{ background: "linear-gradient(135deg, #fef3c7, #fde047)", borderRadius: 14, padding: "18px 20px", marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#854d0e", textTransform: "uppercase", letterSpacing: "0.06em" }}>Current Balance</div>
              <div style={{ fontSize: 32, fontWeight: 900, color: "#111" }}>{balance.toLocaleString()} <span style={{ fontSize: 18, color: "#854d0e" }}>CUTE$</span></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Stat label="Won" value={`${finiCoinWon.toLocaleString()}`} sub="CUTE$ from battles" color="#16a34a" />
              <Stat label="Spent" value={`${finiCoinSpent.toLocaleString()}`} sub="CUTE$ on predictions" color="#dc2626" />
            </div>
          </Card>

          {/* Battle stats */}
          <Card title="⚔️ Battle Record" subtitle="Your win/loss tally">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 12 }}>
              <Stat label="Played" value={String(stats.played)} sub="settled" />
              <Stat label="Won"    value={String(stats.won)}    sub="victories" color="#16a34a" />
              <Stat label="Lost"   value={String(stats.lost)}   sub="defeats"   color="#dc2626" />
            </div>
            <div style={{ background: "#f9fafb", borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#666", marginBottom: 6 }}>
                <span>Win rate</span><span style={{ fontWeight: 800, color: "#111" }}>{winRatePct}%</span>
              </div>
              <div style={{ height: 8, borderRadius: 100, background: "#e5e7eb", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${winRatePct}%`, background: "linear-gradient(90deg, #22c55e, #16a34a)" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#888", marginTop: 8 }}>
                <span>Best streak</span><span style={{ fontWeight: 700, color: "#333" }}>{stats.bestStreak} {stats.bestStreak === 1 ? "win" : "wins"}</span>
              </div>
            </div>
          </Card>

          {/* Net result — real, from settled bets */}
          <Card title="📊 Net result" subtitle="Across settled battles">
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ fontSize: 34, fontWeight: 900, lineHeight: 1, color: stats.net > 0 ? "#16a34a" : stats.net < 0 ? "#dc2626" : "#111" }}>
                {stats.net >= 0 ? "+" : ""}{stats.net.toLocaleString()}
                <span style={{ fontSize: 15, color: "#854d0e", marginLeft: 6 }}>CUTE$</span>
              </div>
              <Link to="/leaderboard" style={{ fontSize: 13, fontWeight: 700, color: "#f472b6", textDecoration: "none" }}>Leaderboard →</Link>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#888" }}>
              <span>Returned <b style={{ color: "#16a34a" }}>{stats.returned.toLocaleString()}</b></span>
              <span>Staked <b style={{ color: "#dc2626" }}>{stats.staked.toLocaleString()}</b></span>
              <span><b style={{ color: "#333" }}>{stats.played}</b> settled</span>
            </div>
            {stats.open > 0 && <div style={{ fontSize: 11, color: "#bbb", marginTop: 8 }}>{stats.open} prediction{stats.open === 1 ? "" : "s"} still open (not counted)</div>}
          </Card>

          {/* Quick links */}
          <Card title="Quick Links" subtitle="">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <QuickLink to="/account" icon="🐾" label="My Stable" />
              <QuickLink to="/claim"   icon="🪙" label="Claim CUTE$"  />
              <QuickLink to="/crypto"  icon="⚔️" label="Crypto Arena" />
              <QuickLink to="/"        icon="🏠" label="Home"     />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 14px", borderRadius: 10,
  border: "1.5px solid #e5e7eb", fontSize: 14, color: "#111",
  outline: "none", background: "#fff", boxSizing: "border-box",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{label}</div>
      {children}
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

function Stat({ label, value, sub, color }: { label: string; value: string; sub: string; color?: string }) {
  return (
    <div style={{ background: "#f9fafb", borderRadius: 12, padding: "10px 12px", textAlign: "center" }}>
      <div style={{ fontSize: 10, color: "#aaa", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 900, color: color ?? "#111", marginTop: 2 }}>{value}</div>
      <div style={{ fontSize: 10, color: "#888" }}>{sub}</div>
    </div>
  );
}

function QuickLink({ to, icon, label }: { to: string; icon: string; label: string }) {
  return (
    <Link to={to} style={{
      display: "flex", alignItems: "center", gap: 8, padding: "10px 12px",
      borderRadius: 12, background: "#f9fafb", color: "#111",
      textDecoration: "none", fontSize: 13, fontWeight: 700,
      border: "1.5px solid transparent", transition: "all 0.12s",
    }}>
      <span style={{ fontSize: 18 }}>{icon}</span>{label}
    </Link>
  );
}
