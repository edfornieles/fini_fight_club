/**
 * Dev Wallet Switcher — paste any 0x… address (or pick a holder from the
 * ghost-team snapshot) to use the app as that wallet without going through
 * MetaMask / SIWE.
 *
 * Gating: visible when `?dev=1` is in the URL OR `localStorage.fini_dev === "1"`.
 * Toggling either persists across reloads (`?dev=1` writes the localStorage flag).
 *
 * What it bypasses:
 *   - RainbowKit / MetaMask connection
 *   - SIWE signature → Supabase session
 *
 * What it does NOT bypass:
 *   - Any code path that calls `supabase.auth.getSession()` and requires a real
 *     JWT (server-side debit/credit, real claims). In dev-impersonation mode
 *     those calls will fail and we fall back to local state — the UI still works
 *     for browsing, matchmaking, battling, and inspecting balances.
 */
import { useEffect, useState } from "react";
import { useUIStore } from "../state/uiStore";
import { useCoinStore } from "../state/coinStore";

const QUICK_PICKS: { label: string; addr: string; note: string }[] = [
  // Top whales from public/data/ownership.json (verified via seed-ghost-teams)
  { label: "🐋 Whale #1",  addr: "0x18ce6cd5c283dca2f50c8347420607a4e59716a6", note: "253 Finis" },
  { label: "🐋 Whale #2",  addr: "0x6266dbb2d202d4e246ee86d76bb2fbb9a71eafcd", note: "251 Finis" },
  { label: "🐋 Whale #3",  addr: "0x28d2d8d8780ff95d94689ce59f031cf829a41d40", note: "230 Finis" },
  { label: "📊 Mid",       addr: "0x5377000000000000000000000000000000d7be00", note: "(custom mid sample)" },
];

function isDevModeEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  // Explicit opt-out via ?dev=0 still works (hides the panel for clean screenshots etc.)
  if (params.get("dev") === "0") {
    try { localStorage.setItem("fini_dev", "0"); } catch { /* ignore */ }
    return false;
  }
  // Explicit opt-in via ?dev=1 takes priority
  if (params.get("dev") === "1") {
    try { localStorage.setItem("fini_dev", "1"); } catch { /* ignore */ }
    return true;
  }
  // Read persisted preference
  let stored: string | null = null;
  try { stored = localStorage.getItem("fini_dev"); } catch { /* ignore */ }
  if (stored === "0") return false;
  // Default: ON during closed beta so testers can play instantly without
  // MetaMask. To hide the panel on a specific browser, visit /?dev=0
  return true;
}

export function DevWalletSwitcher() {
  const walletAddress = useUIStore(s => s.walletAddress);
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [mid, setMid] = useState<string>("");
  const [bots, setBots] = useState<{ wallet_address: string; handle: string; strategy_type: string }[]>([]);

  useEffect(() => {
    setVisible(isDevModeEnabled());
    // Listen for hash/path changes in case ?dev=1 is added mid-session
    const handler = () => setVisible(isDevModeEnabled());
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  // Lazy-pick a mid-tier holder from the ghostTeams snapshot for the quick-pick.
  useEffect(() => {
    if (!visible || mid) return;
    fetch("/data/ghostTeams.json").then(r => r.ok ? r.json() : null).then(j => {
      if (!j?.teams) return;
      const midTier = j.teams.find((t: { ownedCount: number; wallet: string }) =>
        t.ownedCount >= 5 && t.ownedCount <= 15
      );
      if (midTier) setMid(midTier.wallet);
    }).catch(() => { /* ignore */ });

    // Load house bots from Supabase so you can "play as" each one (admin view).
    const sbUrl = (import.meta as { env?: { VITE_SUPABASE_URL?: string; VITE_SUPABASE_ANON_KEY?: string } }).env;
    if (sbUrl?.VITE_SUPABASE_URL && sbUrl?.VITE_SUPABASE_ANON_KEY) {
      fetch(`${sbUrl.VITE_SUPABASE_URL}/rest/v1/house_bots?active=eq.true&select=wallet_address,handle,strategy_type&order=handle&limit=30`, {
        headers: { apikey: sbUrl.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${sbUrl.VITE_SUPABASE_ANON_KEY}` },
      }).then(r => r.ok ? r.json() : []).then(rows => { if (Array.isArray(rows)) setBots(rows); }).catch(() => { /* ignore */ });
    }
  }, [visible, mid]);

  if (!visible) return null;

  function impersonate(addr: string) {
    const a = addr.trim().toLowerCase();
    if (!/^0x[0-9a-f]{40}$/i.test(a)) { alert("Not a valid 0x address"); return; }
    useUIStore.setState({ walletAddress: a });
    // Switch to THIS account's own balance. Fresh dev accounts seed at 1,000;
    // bots/funded wallets pull their real Supabase balance. Each account keeps
    // its own balance that changes as it plays.
    // Switch every per-wallet store in lockstep so balance, active battles,
    // AND deployed auto-attacks all follow the account you're playing as.
    useCoinStore.getState().useWallet(a, 1_000);
    import("../state/myEntriesStore").then(({ useMyEntries }) => useMyEntries.getState().useWallet(a));
    import("../state/strategiesStore").then(({ useStrategies }) => useStrategies.getState().useWallet(a));
    setOpen(false);
  }
  function disconnect() {
    useUIStore.setState({ walletAddress: null });
  }

  const short = walletAddress ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}` : "—";

  return (
    <div style={{
      position: "fixed", bottom: 12, right: 12, zIndex: 9999,
      fontFamily: "'Nunito', system-ui, sans-serif", fontSize: 13,
    }}>
      {open ? (
        <div style={{
          background: "#111", color: "#fff", borderRadius: 12, padding: 14,
          width: 320, boxShadow: "0 12px 32px rgba(0,0,0,0.35)",
          border: "1px solid #333",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <strong style={{ fontSize: 12, letterSpacing: 0.5, color: "#f472b6" }}>DEV · IMPERSONATE</strong>
            <button onClick={() => setOpen(false)} style={btnX}>×</button>
          </div>

          <div style={{ fontSize: 11, color: "#aaa", marginBottom: 6 }}>Current: <span style={{ color: "#fff", fontFamily: "monospace" }}>{short}</span></div>

          <div style={{ fontSize: 10, color: "#fbbf24", background: "#78350f55", border: "1px solid #b45309", borderRadius: 6, padding: "5px 7px", marginBottom: 8, lineHeight: 1.4 }}>
            View-only online: impersonation shows an account's real CUTE$ balance but can't bet/claim (no signature). To play with real CUTE$, connect a real wallet and fund it from the operator console.
          </div>

          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="0x…  (paste any address)"
            style={inputStyle}
            onKeyDown={e => { if (e.key === "Enter") impersonate(input); }}
          />
          <button onClick={() => impersonate(input)} style={btnPrimary}>Sign in as this address</button>

          <div style={{ fontSize: 10, color: "#777", margin: "12px 0 6px", textTransform: "uppercase", letterSpacing: 0.5 }}>Quick picks</div>
          {QUICK_PICKS.map(p => (
            <button key={p.addr} onClick={() => impersonate(p.addr)} style={btnRow}>
              <span>{p.label}</span>
              <span style={{ color: "#888", fontSize: 11 }}>{p.note}</span>
            </button>
          ))}
          {mid && (
            <button onClick={() => impersonate(mid)} style={btnRow}>
              <span>📊 Mid holder (live)</span>
              <span style={{ color: "#888", fontSize: 11, fontFamily: "monospace" }}>{mid.slice(0,6)}…{mid.slice(-4)}</span>
            </button>
          )}

          {/* House bots — play as any of them to inspect their account */}
          {bots.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: "#777", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  🤖 House bots ({bots.length})
                </span>
                <a href="/admin/bots" style={{ fontSize: 10, color: "#3b82f6", fontWeight: 700, textDecoration: "none" }}>Performance →</a>
              </div>
              <div style={{ maxHeight: 180, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                {bots.map(b => (
                  <button key={b.wallet_address} onClick={() => impersonate(b.wallet_address)} style={btnRow}>
                    <span>{b.handle}</span>
                    <span style={{ color: "#888", fontSize: 10 }}>{b.strategy_type}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {walletAddress && (
            <button onClick={disconnect} style={{ ...btnRow, marginTop: 8, color: "#f87171" }}>
              <span>↶ Disconnect</span>
              <span></span>
            </button>
          )}

          <div style={{ fontSize: 10, color: "#666", marginTop: 10, lineHeight: 1.4 }}>
            Bypasses MetaMask + SIWE. Server-side calls (claim, debit) will fail —
            local state still works.
          </div>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} style={floatingPill}>
          ⚙ DEV · {short}
        </button>
      )}
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "8px 10px", borderRadius: 8, background: "#1c1c1c",
  border: "1px solid #333", color: "#fff", fontSize: 13, marginBottom: 8,
  boxSizing: "border-box" as const, fontFamily: "monospace",
};
const btnPrimary = {
  width: "100%", padding: "8px 10px", borderRadius: 8, background: "#f472b6",
  color: "#fff", border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer",
};
const btnRow = {
  width: "100%", padding: "8px 10px", borderRadius: 8, background: "#1c1c1c",
  color: "#eee", border: "1px solid #2a2a2a", fontSize: 12, cursor: "pointer",
  display: "flex", justifyContent: "space-between", alignItems: "center",
  marginBottom: 4, textAlign: "left" as const,
};
const btnX = {
  background: "transparent", color: "#888", border: "none", fontSize: 20,
  cursor: "pointer", padding: 0, lineHeight: 1,
};
const floatingPill = {
  background: "#111", color: "#fff", border: "1px solid #333",
  borderRadius: 999, padding: "8px 14px", fontSize: 12, cursor: "pointer",
  fontFamily: "monospace", boxShadow: "0 6px 16px rgba(0,0,0,0.25)",
};
