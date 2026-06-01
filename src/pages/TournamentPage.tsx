/**
 * /tournament — bracket mode (placeholder).
 *
 * Single-elimination tournaments built on top of challenge links. 8 players
 * each generate a challenge link, bracket pairs them, winners advance, finals.
 *
 * MVP path:
 *  1. Player creates a tournament → gets a shareable URL `/tournament/:id`
 *  2. 8 players sign up by visiting the URL + accepting (stake locked in escrow)
 *  3. Bracket auto-generates
 *  4. Each round → players battle via existing challenge flow
 *  5. Winners' bracket advances; losers' bracket settles
 *  6. Final champion takes 60% of pot, 2nd 25%, 3rd-4th 7.5% each
 *
 * Coming soon — for now this page is a teaser + signup-interest form.
 */
import { Link } from "react-router-dom";

const S: React.CSSProperties = { fontFamily: "'Nunito', system-ui, sans-serif" };

export function TournamentPage() {
  return (
    <div style={{ ...S, background: "#f8f9fa", minHeight: "100vh" }}>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "60px 24px" }}>
        <div style={{
          background: "linear-gradient(135deg, #fef3c7, #fde68a)",
          borderRadius: 24, padding: "40px 36px", textAlign: "center",
          border: "2px solid #fbbf24",
        }}>
          <div style={{ fontSize: 64, marginBottom: 8 }}>🏆</div>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#854d0e", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
            Coming soon
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 900, color: "#111", margin: "0 0 12px" }}>Tournament Bracket</h1>
          <p style={{ fontSize: 14, color: "#666", lineHeight: 1.6, fontWeight: 500, margin: "0 0 24px", maxWidth: 520, marginInline: "auto" }}>
            Single-elimination 8-player brackets. Generate a tournament link, share it with friends,
            lock in stakes, fight through the rounds. Winner takes 60% of the pot, 2nd takes 25%,
            3rd-4th split 15%.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <Link to="/fight-club" style={{
              background: "linear-gradient(135deg, #f472b6, #ec4899)",
              color: "#fff", border: "none", borderRadius: 100,
              padding: "12px 24px", fontSize: 14, fontWeight: 800,
              textDecoration: "none", boxShadow: "0 4px 14px rgba(244,114,182,0.35)",
            }}>← Back to Fight Club</Link>
            <Link to="/leaderboard" style={{
              background: "#fff", color: "#666",
              border: "1.5px solid #e5e7eb", borderRadius: 100,
              padding: "12px 22px", fontSize: 13, fontWeight: 700,
              textDecoration: "none",
            }}>See top players</Link>
          </div>
        </div>

        <div style={{ marginTop: 32, padding: "20px 24px", background: "#fff", borderRadius: 16, border: "1.5px solid #f0f0f0" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#111", marginBottom: 8 }}>What this will look like</div>
          <ul style={{ fontSize: 13, color: "#666", lineHeight: 1.8, paddingLeft: 18, margin: 0 }}>
            <li>Quarterfinal: 4 matches in parallel (8 players → 4 advance)</li>
            <li>Semifinal: 2 matches (4 → 2)</li>
            <li>Final: champion crowned</li>
            <li>Each match uses the existing challenge-link flow — no new battle code</li>
            <li>Tournaments expire after 48 hours of inactivity</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
