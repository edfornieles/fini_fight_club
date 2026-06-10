/**
 * WinnerBanner — Polymarket-style "race finished + next race starting" UX.
 *
 * Renders only when the current battle has settled. Declares the winner with
 * a clear final-price audit, then drives the player to the next instance of
 * the same template via findNextBattle. There's always a next round.
 */
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { findNextBattle } from "../lib/nextBattle";
import { intraWindowReturn, openingFor } from "../lib/openingPrices";
import { getCachedPrices } from "../lib/priceProviders";

type BattleLite = {
  id: string;
  type: string;
  assets: string[];
  sideA: { label: string; pct: number };
  sideB: { label: string; pct: number };
  durationLabel?: string;
  officialStartPrice?: number | null;
  officialEndPrice?: number | null;
};

function fmtUsd(n: number): string {
  if (n >= 1000) return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (n >= 1)    return "$" + n.toFixed(2);
  return "$" + n.toFixed(4);
}

function determineWinner(battle: BattleLite): { winner: "A" | "B"; reasoning: string; movePct: number | null } {
  if (battle.type === "updown" && battle.assets.length === 1) {
    const sym = battle.assets[0];
    // Prefer the server's official prices — they're immutable. Only fall back
    // to the live feed for battles still in progress (no official end price yet).
    const opening = battle.officialStartPrice ?? openingFor(battle.id, sym);
    const close = battle.officialEndPrice ?? getCachedPrices()?.[sym]?.usd ?? null;
    if (opening != null && close != null) {
      const movePct = ((close - opening) / opening) * 100;
      const winner: "A" | "B" = close > opening ? "A" : "B";
      const reasoning = `${sym} ${close > opening ? "closed higher" : close < opening ? "closed lower" : "closed flat"} — ${fmtUsd(opening)} → ${fmtUsd(close)} (${movePct >= 0 ? "+" : ""}${movePct.toFixed(2)}%)`;
      return { winner, reasoning, movePct };
    }
  }
  if (battle.type === "outperform" && battle.assets.length === 2) {
    const [a, b] = battle.assets;
    const aRet = intraWindowReturn(battle.id, a);
    const bRet = intraWindowReturn(battle.id, b);
    if (aRet != null && bRet != null) {
      const winner: "A" | "B" = aRet >= bRet ? "A" : "B";
      const reasoning = `${a} returned ${(aRet * 100).toFixed(2)}%, ${b} returned ${(bRet * 100).toFixed(2)}% — ${winner === "A" ? a : b} outperformed`;
      return { winner, reasoning, movePct: (winner === "A" ? aRet : bRet) * 100 };
    }
  }
  // Fallback: market % majority
  const winner: "A" | "B" = battle.sideA.pct >= battle.sideB.pct ? "A" : "B";
  return { winner, reasoning: "Resolved by final market consensus", movePct: null };
}

export function WinnerBanner({
  battle,
  userBetSide,
  userPayout,
  /**
   * If the server's resolution audit is anything OTHER than a clean settle
   * (e.g. manual_review, pending, voided), we don't pretend we know the
   * winner — the ResolutionAuditPanel below is the authoritative voice.
   */
  resolutionStatus,
}: {
  battle: BattleLite;
  userBetSide?: "A" | "B" | null;
  userPayout?: number | null;
  resolutionStatus?: "open" | "pending" | "locked" | "resolving" | "manual_review" | "voided" | "resolved" | null;
}) {
  // When the server says manual_review / pending / voided / resolving, or
  // hasn't yet committed an official end price, suppress the banner — the
  // Resolution Audit panel covers those states authoritatively, and showing
  // a tentative "X wins" based on the live feed would cause blinking.
  if (
    resolutionStatus === "manual_review" ||
    resolutionStatus === "pending" ||
    resolutionStatus === "voided" ||
    resolutionStatus === "resolving"
  ) {
    return null;
  }
  // If the battle came from the server and has no official end price yet,
  // the outcome isn't committed — hide the banner until it is.
  if (battle.officialStartPrice !== undefined && battle.officialEndPrice == null) {
    return null;
  }
  const [nextId, setNextId] = useState<string | null>(null);
  const [loadingNext, setLoadingNext] = useState(true);
  const [autoSeconds, setAutoSeconds] = useState(8); // auto-jump countdown
  const [paused, setPaused] = useState(false);
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let alive = true;
    setLoadingNext(true);
    findNextBattle(battle.id).then(id => { if (alive) { setNextId(id); setLoadingNext(false); } });
    return () => { alive = false; };
  }, [battle.id]);

  // Auto-advance to the next round once we know its id. Counts down 8s, pauses
  // while the cursor is over the banner so the player can read the result.
  // They can also click "Next round →" any time to jump immediately, or click
  // "Stay" to cancel the auto-jump entirely.
  useEffect(() => {
    if (!nextId || paused) return;
    if (autoSeconds <= 0) { navigate(`/battle/${nextId}`); return; }
    const t = setTimeout(() => setAutoSeconds(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [nextId, paused, autoSeconds, navigate]);

  const { winner, reasoning } = determineWinner(battle);
  const winnerLabel = winner === "A" ? battle.sideA.label : battle.sideB.label;
  const winnerColor = winner === "A" ? "#16a34a" : "#dc2626";
  // "No wins" reads as "no winner". "Yes wins" reads as a stutter. For short
  // affirmative labels we use "carries this round" instead — reads cleanly
  // regardless of the label ("No carries this round", "BTC carries this round",
  // "Up carries this round").
  const winnerHeadline = `${winnerLabel} carries this round`;
  const playerWon = userBetSide != null && userBetSide === winner;
  const playerLost = userBetSide != null && userBetSide !== winner;

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      style={{
      background: playerWon ? "linear-gradient(135deg, #f0fdf4, #dcfce7)"
        : playerLost ? "linear-gradient(135deg, #fef2f2, #fee2e2)"
        : "linear-gradient(135deg, #fafafa, #f3f4f6)",
      border: `2px solid ${playerWon ? "#16a34a" : playerLost ? "#dc2626" : "#d4d4d8"}`,
      borderRadius: 24,
      padding: "28px 32px",
      fontFamily: "'Nunito', system-ui, sans-serif",
      animation: "fini-banner-in 0.5s ease-out",
    }}>
      <style>{`@keyframes fini-banner-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>

      {/* Headline */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#666", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>
            🏁 Battle Settled
          </div>
          <div style={{ fontSize: 26, fontWeight: 900, color: winnerColor }}>
            {winnerHeadline}
          </div>
        </div>
        {userBetSide != null && (
          <div style={{
            background: playerWon ? "#16a34a" : "#dc2626",
            color: "#fff",
            padding: "10px 18px",
            borderRadius: 100,
            fontWeight: 900,
            fontSize: 14,
            boxShadow: `0 4px 14px ${playerWon ? "#16a34a55" : "#dc262655"}`,
          }}>
            {playerWon
              ? `🎉 You won ${userPayout != null ? userPayout.toLocaleString() + " FINI$" : ""}`
              : "💀 You lost this one"}
          </div>
        )}
      </div>

      {/* Audit reasoning */}
      <div style={{ fontSize: 13, color: "#444", fontWeight: 600, lineHeight: 1.5, marginBottom: 20 }}>
        {reasoning}
      </div>

      {/* Next round CTA + auto-advance countdown */}
      <div style={{ borderTop: "1px solid #d4d4d8", paddingTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#888", textTransform: "uppercase", letterSpacing: 0.8 }}>
            Up next
          </div>
          <div style={{ fontSize: 13, color: "#333", fontWeight: 700 }}>
            {loadingNext ? "Finding the next round…"
              : nextId ? (paused ? "Hover paused — release to continue auto-advance." : `Auto-jumping in ${autoSeconds}s…`)
              : "Watching for the next round to spawn…"}
          </div>
        </div>
        {nextId && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              onClick={() => setPaused(true)}
              style={{
                background: "transparent", color: "#666",
                border: "1.5px solid #d4d4d8", borderRadius: 100,
                padding: "10px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer",
              }}
            >Stay here</button>
            <Link
              to={`/battle/${nextId}`}
              style={{
                background: "linear-gradient(135deg, #f472b6, #ec4899)",
                color: "#fff",
                padding: "12px 24px",
                borderRadius: 100,
                fontWeight: 800,
                fontSize: 14,
                textDecoration: "none",
                boxShadow: "0 4px 14px rgba(244,114,182,0.30)",
                display: "inline-flex", alignItems: "center", gap: 8,
                whiteSpace: "nowrap",
                position: "relative", overflow: "hidden",
              }}
            >
              Next round
              <span style={{
                background: "rgba(255,255,255,0.25)",
                borderRadius: 100, padding: "2px 8px", fontSize: 11, fontWeight: 900,
                fontFamily: "monospace",
              }}>{autoSeconds}s</span>
            </Link>
          </div>
        )}
        {!nextId && !loadingNext && (
          <Link
            to="/crypto"
            style={{
              background: "#111",
              color: "#fff",
              padding: "12px 24px",
              borderRadius: 100,
              fontWeight: 800,
              fontSize: 14,
              textDecoration: "none",
            }}
          >
            Browse Arena →
          </Link>
        )}
      </div>
    </div>
  );
}
