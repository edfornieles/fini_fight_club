import { useState } from "react";
import { useUIStore } from "../state/uiStore";
import { Link } from "react-router-dom";
import { ConnectWalletButton } from "../components/ConnectWalletButton";

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

  const winRatePct = Math.round(MOCK_STATS.winRate * 100);

  return (
    <div style={{ ...S, background: "#f8f9fa", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #f0f0f0", padding: "32px 48px 28px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: "#111", margin: 0 }}>👤 Profile</h1>
          <div style={{ fontSize: 13, color: "#888", marginTop: 4, fontFamily: "monospace" }}>
            {walletAddress.slice(0, 10)}...{walletAddress.slice(-4)} · joined {new Date(MOCK_STATS.joinedDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </div>
        </div>
      </div>

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
                <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>Ethereum mainnet · {MOCK_STATS.finisOwned} Finis owned</div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 100, background: "#dcfce7", color: "#15803d" }}>✓ Connected</span>
            </div>
          </Card>

          <Card title="Notifications" subtitle="Choose when we ping you">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { label: "Battle wins", default: true },
                { label: "Daily Fini Coin grant", default: true },
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
          {/* FINI$ Balance */}
          <Card title="🪙 FINI$" subtitle="Your in-game currency balance">
            <div style={{ background: "linear-gradient(135deg, #fef3c7, #fde047)", borderRadius: 14, padding: "18px 20px", marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#854d0e", textTransform: "uppercase", letterSpacing: "0.06em" }}>Current Balance</div>
              <div style={{ fontSize: 32, fontWeight: 900, color: "#111" }}>{MOCK_STATS.finiCoinBalance.toLocaleString()} <span style={{ fontSize: 18, color: "#854d0e" }}>FINI$</span></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Stat label="Won" value={`${MOCK_STATS.finiCoinWon.toLocaleString()}`} sub="FINI$ from battles" color="#16a34a" />
              <Stat label="Spent" value={`${MOCK_STATS.finiCoinSpent.toLocaleString()}`} sub="FINI$ on predictions" color="#dc2626" />
            </div>
          </Card>

          {/* Battle stats */}
          <Card title="⚔️ Battle Record" subtitle="Your win/loss tally">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 12 }}>
              <Stat label="Played" value={String(MOCK_STATS.battlesPlayed)} sub="battles" />
              <Stat label="Won"    value={String(MOCK_STATS.battlesWon)}    sub="victories" color="#16a34a" />
              <Stat label="Lost"   value={String(MOCK_STATS.battlesLost)}   sub="defeats"   color="#dc2626" />
            </div>
            <div style={{ background: "#f9fafb", borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#666", marginBottom: 6 }}>
                <span>Win rate</span><span style={{ fontWeight: 800, color: "#111" }}>{winRatePct}%</span>
              </div>
              <div style={{ height: 8, borderRadius: 100, background: "#e5e7eb", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${winRatePct}%`, background: "linear-gradient(90deg, #22c55e, #16a34a)" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#888", marginTop: 8 }}>
                <span>Best streak</span><span style={{ fontWeight: 700, color: "#333" }}>{MOCK_STATS.bestStreak} wins</span>
              </div>
            </div>
          </Card>

          {/* Ranking */}
          <Card title="🏅 Ranking" subtitle="Where you stand">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 32, fontWeight: 900, color: "#111", lineHeight: 1 }}>#{MOCK_STATS.ranking}</div>
                <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>of {MOCK_STATS.totalPlayers.toLocaleString()} players</div>
              </div>
              <Link to="/leaderboard" style={{ fontSize: 13, fontWeight: 700, color: "#f472b6", textDecoration: "none" }}>View leaderboard →</Link>
            </div>
            <div style={{ height: 6, borderRadius: 100, background: "#e5e7eb", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${(1 - MOCK_STATS.ranking / MOCK_STATS.totalPlayers) * 100}%`, background: "linear-gradient(90deg, #f472b6, #ec4899)" }} />
            </div>
            <div style={{ fontSize: 11, color: "#bbb", marginTop: 6 }}>Top {Math.ceil((MOCK_STATS.ranking / MOCK_STATS.totalPlayers) * 100)}%</div>
          </Card>

          {/* Quick links */}
          <Card title="Quick Links" subtitle="">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <QuickLink to="/account" icon="🐾" label="My Stable" />
              <QuickLink to="/claim"   icon="🪙" label="Claim FINI$"  />
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
