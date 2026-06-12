/** First-run disclaimer. Shown once until accepted (localStorage), so every
 *  player sees the play-only / not-gambling framing before they play. */
import { useState } from "react";
import { Link } from "react-router-dom";

const KEY = "cute_tos_accepted_v1";

export function TermsGate() {
  const [accepted, setAccepted] = useState(() => {
    try { return localStorage.getItem(KEY) === "1"; } catch { return true; }
  });
  if (accepted) return null;

  function accept() {
    try { localStorage.setItem(KEY, "1"); } catch { /* ignore */ }
    setAccepted(true);
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999, background: "rgba(17,17,17,0.55)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      fontFamily: "'Nunito', system-ui, sans-serif",
    }}>
      <div style={{ background: "#fff", borderRadius: 20, maxWidth: 460, width: "100%", padding: "28px 28px 24px", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ fontSize: 40, textAlign: "center" }}>🎮</div>
        <h2 style={{ fontSize: 22, fontWeight: 900, color: "#111", textAlign: "center", margin: "8px 0 6px" }}>Welcome — quick heads up</h2>
        <p style={{ fontSize: 14, color: "#444", lineHeight: 1.6, textAlign: "center", margin: "0 0 16px" }}>
          This is a <b>free-to-play game</b>, not gambling. You play with <b>CUTE$</b>,
          an in-game score with <b>no cash value</b> — it can't be bought, withdrawn,
          or exchanged for money. Crypto prices are for fun, not trading. Beta on testnet.
        </p>
        <button onClick={accept} style={{
          width: "100%", padding: "13px 0", borderRadius: 100, border: "none",
          background: "#f472b6", color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer",
        }}>
          Got it — let's play
        </button>
        <div style={{ textAlign: "center", marginTop: 12 }}>
          <Link to="/terms" onClick={accept} style={{ fontSize: 12, color: "#888", fontWeight: 700 }}>Read the full terms →</Link>
        </div>
      </div>
    </div>
  );
}
