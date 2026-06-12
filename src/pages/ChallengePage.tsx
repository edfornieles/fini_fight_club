/**
 * /challenge?from=0x…&team=29,1376,1587&stake=100
 *
 * The recipient of a shared challenge link lands here. URL-encoded version:
 *  - No backend, no challenge table — everything is in the URL
 *  - Recipient sees the challenger's roster, can preview before accepting
 *  - On accept: redirects to Fight Club with this opponent pre-loaded
 *
 * When the backend ships, this same page will support /challenge/c/:id
 * (server-stored variant with escrow).
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { synthFini, shortenWallet, type GhostFini } from "../game/ghostOpponents";
import { FAMILY_ROLE, ROLE_META } from "../game/familyRoles";
import { useUIStore } from "../state/uiStore";

const S: React.CSSProperties = { fontFamily: "'Nunito', system-ui, sans-serif" };

export function ChallengePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const walletAddress = useUIStore(s => s.walletAddress);

  const from = (params.get("from") ?? "").toLowerCase();
  const teamStr = params.get("team") ?? "";
  // Clamp the URL stake to a positive integer; default 100. (?stake=abc/0/-5
  // previously rendered "NaN CUTE$".)
  const stakeRaw = Math.floor(Number(params.get("stake") ?? "100"));
  const stake = Number.isFinite(stakeRaw) && stakeRaw > 0 ? stakeRaw : 100;

  const tokenIds = useMemo(() =>
    teamStr.split(",").map(s => Number(s.trim())).filter(n => Number.isFinite(n) && n >= 0),
    [teamStr]
  );

  const [opponentTeam, setOpponentTeam] = useState<GhostFini[]>([]);
  const [valid, setValid] = useState(true);

  useEffect(() => {
    if (!/^0x[0-9a-f]{40}$/i.test(from) || tokenIds.length === 0) { setValid(false); return; }
    setOpponentTeam(tokenIds.slice(0, 3).map(id => synthFini(id)));
  }, [from, tokenIds]);

  function accept() {
    if (!walletAddress) {
      // Need wallet first — redirect to home with a return-to hint
      alert("Sign in with a wallet first — use the DEV pill (bottom-right) or connect MetaMask.");
      return;
    }
    if (walletAddress.toLowerCase() === from) {
      alert("You can't challenge yourself.");
      return;
    }
    // Stash the pending challenge in sessionStorage so Fight Club picks it up
    sessionStorage.setItem("pending-challenge", JSON.stringify({
      from, teamIds: tokenIds.slice(0, 3), stake, acceptedAt: Date.now(),
    }));
    navigate("/fight-club");
  }

  if (!valid) {
    return (
      <div style={{ ...S, padding: "80px 24px", textAlign: "center", background: "#f8f9fa", minHeight: "100vh" }}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>⚠️</div>
        <h2 style={{ fontSize: 22, fontWeight: 900, color: "#111", margin: "0 0 8px" }}>This challenge link is broken</h2>
        <p style={{ fontSize: 14, color: "#666", marginBottom: 24, fontWeight: 500 }}>
          The URL is missing a wallet or team. Ask the challenger for a fresh link.
        </p>
        <Link to="/leaderboard" style={{
          display: "inline-block", padding: "10px 22px", borderRadius: 100,
          background: "#f472b6", color: "#fff",
          fontSize: 13, fontWeight: 800, textDecoration: "none",
        }}>← Find players to challenge</Link>
      </div>
    );
  }

  const short = shortenWallet(from);

  return (
    <div style={{ ...S, background: "#f8f9fa", minHeight: "100vh" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px" }}>

        {/* Hero */}
        <div style={{
          background: "linear-gradient(135deg, #fce8f3, #fdf2f8)",
          borderRadius: 24, padding: "36px 32px", textAlign: "center",
          border: "2px solid #fbcfe8", marginBottom: 24,
        }}>
          <div style={{ fontSize: 56, marginBottom: 4 }}>⚔️</div>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#be185d", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
            You've been challenged
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: "#111", margin: 0 }}>
            <Link to={`/p/${from}`} style={{ fontFamily: "monospace", color: "#111", textDecoration: "underline" }}>{short}</Link> wants to fight
          </h1>
          <div style={{ fontSize: 14, color: "#666", marginTop: 10, fontWeight: 600 }}>
            Stake: <b style={{ color: "#854d0e" }}>{stake} CUTE$</b> · winner takes both
          </div>
        </div>

        {/* Opponent's team */}
        <div style={{ background: "#fff", borderRadius: 20, padding: "24px 28px", border: "1.5px solid #f0f0f0", marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>
            Their starting lineup
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            {opponentTeam.map(f => {
              const role = FAMILY_ROLE[f.family];
              const meta = role ? ROLE_META[role] : null;
              return (
                <div key={f.id} style={{
                  background: "#fff", border: "1.5px solid #f0f0f0", borderRadius: 14,
                  padding: "12px", display: "flex", flexDirection: "column", gap: 5,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, fontWeight: 900, color: "#111" }}>#{f.id}</span>
                    {meta && (
                      <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 100, background: meta.bgTint, color: meta.color }}>
                        {meta.icon} {meta.name}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#666" }}>{f.family} · {f.clan}</div>
                  <div style={{ fontSize: 10, color: "#888" }}>
                    HP {f.maxHp} · ATK {f.atk} · DEF {f.def} · SPD {f.speed}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Accept / decline */}
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button onClick={accept} style={{
            background: "linear-gradient(135deg, #f472b6, #ec4899)",
            color: "#fff", border: "none", borderRadius: 100,
            padding: "14px 32px", fontSize: 15, fontWeight: 900, cursor: "pointer",
            boxShadow: "0 4px 14px rgba(244,114,182,0.35)",
          }}>⚔️ Accept Challenge</button>
          <Link to="/crypto" style={{
            background: "#fff", color: "#666",
            border: "1.5px solid #e5e7eb", borderRadius: 100,
            padding: "14px 28px", fontSize: 14, fontWeight: 700,
            textDecoration: "none",
          }}>Decline</Link>
        </div>

        <div style={{ marginTop: 18, fontSize: 11, color: "#aaa", textAlign: "center", lineHeight: 1.5 }}>
          You'll pick your own 3 starters in the next screen. Both sides stake {stake} CUTE$ —
          winner takes the pot.
        </div>

      </div>
    </div>
  );
}
