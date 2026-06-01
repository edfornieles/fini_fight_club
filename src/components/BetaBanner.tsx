/**
 * Closed-beta banner — pinned strip across the very top of the site.
 *
 * Dismissible (state lives in localStorage). Tells testers this is a work
 * in progress and tells them how to give feedback.
 */
import { useState } from "react";

const DISMISS_KEY = "fini-beta-banner-dismissed-v1";

export function BetaBanner() {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(DISMISS_KEY) === "1";
  });
  if (dismissed) return null;

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
    setDismissed(true);
  }

  return (
    <div style={{
      background: "linear-gradient(90deg, #1f2937 0%, #374151 100%)",
      color: "#fff",
      padding: "8px 20px",
      fontSize: 12,
      fontWeight: 600,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 14,
      fontFamily: "'Nunito', system-ui, sans-serif",
      borderBottom: "1px solid rgba(255,255,255,0.08)",
    }}>
      <span style={{ fontSize: 14 }}>🚧</span>
      <span>
        <b>Closed beta.</b> No real money — everything's FINI$ game tokens.
        Found a bug or have an idea?{" "}
        <a href="mailto:ed@finiliar.com" style={{ color: "#fde047", textDecoration: "underline" }}>
          ed@finiliar.com
        </a>
        {" "}or DM on{" "}
        <a href="https://twitter.com/edfornieles" target="_blank" rel="noreferrer" style={{ color: "#fde047", textDecoration: "underline" }}>
          @edfornieles
        </a>
      </span>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        style={{
          background: "transparent",
          border: "1px solid rgba(255,255,255,0.2)",
          color: "#fff",
          borderRadius: 100,
          padding: "2px 10px",
          fontSize: 11,
          fontWeight: 700,
          cursor: "pointer",
          marginLeft: 8,
        }}
      >Got it</button>
    </div>
  );
}
