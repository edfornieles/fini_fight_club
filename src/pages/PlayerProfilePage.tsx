/**
 * /p/:wallet — public profile for any holder. Shareable permalink.
 *
 * Anyone can land here and see:
 *  - That wallet's starting team (loaded from ghostTeams.json + ownership.json)
 *  - A big "⚔️ Challenge me" button that mints a /challenge link prefilled
 *    with the wallet's roster
 *  - A small bio strip: shortened wallet, owned-count, last-seen estimate
 *
 * No auth required to view — it's a public page that doubles as a marketing
 * surface. Every wallet has one. Each one is an open invite to fight.
 */
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { loadGhostTeams, synthFini, shortenWallet, type GhostFini } from "../game/ghostOpponents";
import { FAMILY_ROLE, ROLE_META } from "../game/familyRoles";

const S: React.CSSProperties = { fontFamily: "'Nunito', system-ui, sans-serif" };

export function PlayerProfilePage() {
  const { wallet = "" } = useParams<{ wallet: string }>();
  const [roster, setRoster] = useState<GhostFini[] | null>(null);
  const [ownedCount, setOwnedCount] = useState(0);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);

  const normalizedWallet = wallet.toLowerCase();

  useEffect(() => {
    setRoster(null); setNotFound(false);
    if (!/^0x[0-9a-f]{40}$/i.test(normalizedWallet)) { setNotFound(true); return; }
    loadGhostTeams().then(file => {
      const mine = file.teams.find(t => t.wallet.toLowerCase() === normalizedWallet);
      if (!mine) { setNotFound(true); return; }
      setOwnedCount(mine.ownedCount);
      setRoster(mine.tokenIds.map(id => synthFini(id)));
    }).catch(() => setNotFound(true));
  }, [normalizedWallet]);

  const short = shortenWallet(normalizedWallet);
  const challengeUrl = roster
    ? `${window.location.origin}/challenge?from=${normalizedWallet}&team=${roster.map(f => f.id).join(",")}&stake=100`
    : "";

  function copyChallengeLink() {
    if (!challengeUrl) return;
    navigator.clipboard.writeText(challengeUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function tweetChallenge() {
    if (!challengeUrl) return;
    const text = `⚔️ I'm in Fini Fight Club. Take a shot at my team:\n${challengeUrl}`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank");
  }

  if (notFound) {
    return (
      <div style={{ ...S, padding: "80px 48px", textAlign: "center", background: "#f8f9fa", minHeight: "100vh" }}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>👻</div>
        <h2 style={{ fontSize: 22, fontWeight: 900, color: "#111", margin: "0 0 8px" }}>Wallet not found in the Fini snapshot</h2>
        <p style={{ fontSize: 14, color: "#666", marginBottom: 24, fontWeight: 500 }}>
          The wallet <code style={{ fontFamily: "monospace", background: "#f3f4f6", padding: "2px 6px", borderRadius: 4 }}>{short}</code> doesn't own any Finis in the May 2026 snapshot.
        </p>
        <Link to="/leaderboard" style={{
          display: "inline-block", padding: "10px 22px", borderRadius: 100,
          background: "#f472b6", color: "#fff",
          fontSize: 13, fontWeight: 800, textDecoration: "none",
        }}>← Browse top players</Link>
      </div>
    );
  }

  return (
    <div style={{ ...S, background: "#f8f9fa", minHeight: "100vh" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px" }}>

        {/* Identity hero */}
        <div style={{
          background: "linear-gradient(135deg, #fce8f3, #fdf2f8)",
          borderRadius: 24, padding: "32px 36px",
          border: "1.5px solid #fbcfe8",
          marginBottom: 24,
        }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#be185d", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
            Fini Fight Club Player
          </div>
          <h1 style={{ fontSize: 34, fontWeight: 900, color: "#111", margin: 0, fontFamily: "monospace" }}>{short}</h1>
          <div style={{ fontSize: 13, color: "#666", marginTop: 6, fontWeight: 600 }}>
            Holds <b style={{ color: "#111" }}>{ownedCount}</b> Finis · Public profile
          </div>
        </div>

        {/* Challenge CTAs */}
        {roster && (
          <div style={{
            background: "#fff", borderRadius: 20, padding: "24px 28px",
            border: "1.5px solid #f0f0f0", marginBottom: 24,
          }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#111", marginBottom: 4 }}>⚔️ Challenge this player</div>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 16, fontWeight: 500, lineHeight: 1.5 }}>
              Send them a battle invite. Their starting team is pre-loaded — pick your own, click accept, fight.
              No backend required.
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link to={`/challenge?from=${normalizedWallet}&team=${roster.map(f => f.id).join(",")}&stake=100`} style={{
                background: "linear-gradient(135deg, #f472b6, #ec4899)",
                color: "#fff", border: "none", borderRadius: 100,
                padding: "12px 24px", fontSize: 14, fontWeight: 800,
                textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8,
                boxShadow: "0 4px 14px rgba(244,114,182,0.35)",
              }}>
                ⚔️ Battle now (100 FINI$)
              </Link>
              <button onClick={copyChallengeLink} style={{
                background: "#fff", color: "#111",
                border: "1.5px solid #e5e7eb", borderRadius: 100,
                padding: "12px 22px", fontSize: 13, fontWeight: 700, cursor: "pointer",
              }}>
                {copied ? "✓ Copied!" : "📋 Copy challenge link"}
              </button>
              <button onClick={tweetChallenge} style={{
                background: "#fff", color: "#1d9bf0",
                border: "1.5px solid #1d9bf0", borderRadius: 100,
                padding: "12px 22px", fontSize: 13, fontWeight: 700, cursor: "pointer",
              }}>
                🐦 Tweet challenge
              </button>
            </div>
          </div>
        )}

        {/* Their starting team */}
        {roster && (
          <div style={{ background: "#fff", borderRadius: 20, padding: "24px 28px", border: "1.5px solid #f0f0f0" }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#111", marginBottom: 4 }}>Starting Lineup</div>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 16, fontWeight: 500 }}>
              The 3 Finis you'll face if you accept the challenge.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
              {roster.map(f => {
                const role = FAMILY_ROLE[f.family];
                const meta = role ? ROLE_META[role] : null;
                return (
                  <Link key={f.id} to={`/fini/${f.id}`} style={{
                    background: "#fff", border: "1.5px solid #f0f0f0", borderRadius: 14,
                    padding: "14px", textDecoration: "none", color: "inherit",
                    display: "flex", flexDirection: "column", gap: 6,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 13, fontWeight: 900, color: "#111" }}>#{f.id}</span>
                      {meta && (
                        <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 100, background: meta.bgTint, color: meta.color }}>
                          {meta.icon} {meta.name}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#666" }}>{f.family} · {f.clan}</div>
                    <div style={{ fontSize: 10, color: "#888" }}>
                      HP {f.maxHp} · ATK {f.atk} · DEF {f.def} · SPD {f.speed}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
