import { FooterSection } from "../components/FooterSection";

const S = { fontFamily: "'Nunito', system-ui, sans-serif" };

export function LandingPage() {
  return (
    <div style={S}>
      {/* ── Original Hero ── */}
      <section style={{
        background: "#c7f6fb", minHeight: "calc(100vh - 64px)",
        display: "flex", alignItems: "center", padding: "0 48px",
        overflow: "hidden", position: "relative",
      }}>
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40,
          width: "100%", maxWidth: 1200, margin: "0 auto", alignItems: "center",
        }}>
          <div style={{ paddingBottom: 40 }}>
            <h1 style={{ fontSize: "clamp(40px, 5.5vw, 76px)", fontWeight: 900, color: "#0a0a0a", lineHeight: 1.08, letterSpacing: "-2px", margin: 0 }}>
              Digital cuties for{" "}
              <span style={{ position: "relative", display: "inline-block", whiteSpace: "nowrap" }}>
                <span style={{ position: "relative", zIndex: 1 }}>everything that</span>
                <svg aria-hidden style={{ position: "absolute", top: "-18%", left: "-4%", width: "108%", height: "136%", pointerEvents: "none" }} viewBox="0 0 340 80" preserveAspectRatio="none">
                  <ellipse cx="170" cy="40" rx="165" ry="36" fill="none" stroke="#60a5fa" strokeWidth="5" strokeLinecap="round" />
                </svg>
              </span>
              {" "}matters
            </h1>
            <p style={{ marginTop: 28, fontSize: 17, color: "#444", lineHeight: 1.6, maxWidth: 420, fontWeight: 500 }}>
              Finis are digital beings that embody the emotional ties between people and the world around them.
            </p>
            <div style={{ display: "flex", gap: 12, marginTop: 36 }}>
              <button style={{ background: "#0a0a0a", color: "#fff", border: "none", borderRadius: 100, padding: "14px 28px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
                Get your Fini
              </button>
              <button style={{ background: "transparent", color: "#0a0a0a", border: "2px solid #0a0a0a", borderRadius: 100, padding: "14px 28px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
                View collection
              </button>
            </div>
          </div>
          <div style={{ position: "relative", display: "flex", alignItems: "flex-end", justifyContent: "center", minHeight: 480 }}>
<video autoPlay loop muted playsInline style={{ height: "88%", maxHeight: 480, width: "auto", objectFit: "contain", position: "relative", zIndex: 1, marginRight: "5%" }}>
              <source src="/hero/sunflower.mp4" type="video/mp4" />
            </video>
          </div>
        </div>
      </section>

      {/* ── Fight Club Section ── */}
      <section style={{ position: "relative", minHeight: "100vh", background: "#fce8e8", overflow: "hidden", display: "flex", alignItems: "center" }}>
        <div style={{
          position: "relative", zIndex: 1, display: "grid", gridTemplateColumns: "1fr 1fr",
          width: "100%", maxWidth: 1200, margin: "0 auto", padding: "0 48px",
          alignItems: "center", minHeight: "100vh",
        }}>
          <div>
            <h2 style={{ fontSize: "clamp(40px, 5vw, 68px)", fontWeight: 900, color: "#0a0a0a", lineHeight: 1.1, letterSpacing: "-2px", margin: 0 }}>
              Fini{" "}
              <span style={{ position: "relative", display: "inline-block", whiteSpace: "nowrap" }}>
                <span style={{ position: "relative", zIndex: 1 }}>Crypto Arena</span>
                <svg aria-hidden style={{ position: "absolute", top: "-22%", left: "-6%", width: "112%", height: "148%", pointerEvents: "none" }} viewBox="0 0 300 80" preserveAspectRatio="none">
                  <ellipse cx="150" cy="40" rx="144" ry="34" fill="none" stroke="#60a5fa" strokeWidth="5" strokeLinecap="round" />
                </svg>
              </span>
            </h2>
            <p style={{ marginTop: 16, fontSize: 16, color: "#555", fontWeight: 600 }}>Build teams, battle, win rewards</p>
          </div>
          <div style={{ position: "relative", minHeight: 500 }}>
            <img src="/hero/fight_club.png" alt="Fini fight club characters" style={{ width: "110%", maxWidth: 680, objectFit: "contain", position: "absolute", bottom: 0, right: "-60px" }} />
          </div>
        </div>
      </section>

      {/* ExploreSection removed from the front page — moved to a dedicated route if/when needed */}
      <FooterSection />

      {/* Disclaimer */}
      <div style={{ background: "#f9fafb", borderTop: "1px solid #e5e7eb", padding: "16px 48px", fontSize: 11, color: "#9ca3af", lineHeight: 1.6 }}>
        Fini Coin is a non-transferable game currency. Fini Coin cannot be withdrawn or exchanged for money or crypto. This is a game, not financial advice. Crypto price data may be delayed or inaccurate. Do not use this site as a trading tool.
      </div>
    </div>
  );
}
