import { useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useUIStore } from "../state/uiStore";
import { BalanceChip } from "./BalanceChip";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useDisconnect } from "wagmi";

export function SiteNav() {
  const { walletAddress, walletDropdownOpen, setWalletDropdown, disconnectWallet } = useUIStore();
  const { disconnect } = useDisconnect();
  const logout = () => { disconnect(); disconnectWallet(); };
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setWalletDropdown(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [setWalletDropdown]);

  const short = walletAddress
    ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`
    : null;

  return (
    <nav style={{
      fontFamily: "'Nunito', system-ui, sans-serif",
      background: "#fff",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 32px", height: 64,
      borderBottom: "1px solid #f0f0f0",
      position: "sticky", top: 0, zIndex: 200,
    }}>
      {/* Logo */}
      <Link to="/" style={{ textDecoration: "none", fontSize: 26, fontWeight: 900, letterSpacing: "-1px", lineHeight: 1 }}>
        <span style={{ color: "#4aaee8" }}>F</span>
        <span style={{ color: "#f472b6" }}>i</span>
        <span style={{ color: "#fbbf24" }}>n</span>
        <span style={{ color: "#f97316" }}>i</span>
      </Link>

      {/* Nav links */}
      <div style={{ display: "flex", alignItems: "center", gap: 24, fontSize: 14, fontWeight: 600, color: "#111", whiteSpace: "nowrap" }}>
        <NavLink to="/crypto" dot="#60a5fa" label="Crypto Arena" />
        <NavLink to="/fight-club" dot="#4ade80" label="Fight Club" />
        <NavLink to="/leaderboard" dot="#f97316" label="Leaderboard" />
        <NavLink to="/claim" dot="#a78bfa" label="Claim FINI$" />
      </div>

      {/* Wallet + balance */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {walletAddress && <BalanceChip compact />}
        <div style={{ position: "relative" }} ref={dropdownRef}>
        {walletAddress ? (
          <>
            <button onClick={() => setWalletDropdown(!walletDropdownOpen)} style={{
              background: "#fce8f3", color: "#111",
              border: "1.5px solid #f472b6", borderRadius: 100,
              padding: "9px 18px", fontSize: 14, fontWeight: 700,
              cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
            }}>
              {short}
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 4l4 4 4-4" stroke="#f472b6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {walletDropdownOpen && (
              <div style={{
                position: "absolute", top: "calc(100% + 8px)", right: 0,
                background: "#fff", border: "1.5px solid #f0e0ea",
                borderRadius: 16, boxShadow: "0 8px 32px rgba(0,0,0,0.10)",
                minWidth: 200, overflow: "hidden", zIndex: 300,
              }}>
                {[
                  { icon: "👤", label: "Profile",        action: () => { setWalletDropdown(false); navigate("/profile"); } },
                  { icon: "🐾", label: "My Stable",      action: () => { setWalletDropdown(false); navigate("/account"); } },
                  { icon: "🪙", label: "Claim Fini Coin",action: () => { setWalletDropdown(false); navigate("/claim"); } },
                  { icon: "→",  label: "Logout",         action: logout },
                ].map(({ icon, label, action }) => (
                  <button key={label} onClick={action} style={{
                    width: "100%", textAlign: "left", background: "none", border: "none",
                    padding: "13px 20px", fontSize: 14, fontWeight: 600, color: "#111",
                    cursor: "pointer", display: "flex", alignItems: "center", gap: 12,
                    borderBottom: label !== "Logout" ? "1px solid #f5eaf0" : "none",
                  }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#fdf0f7")}
                    onMouseLeave={e => (e.currentTarget.style.background = "none")}
                  >
                    <span style={{ fontSize: 16 }}>{icon}</span>
                    {label}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <ConnectButton
            label="Connect Wallet"
            chainStatus="none"
            accountStatus="address"
            showBalance={false}
          />
        )}
        </div>
      </div>
    </nav>
  );
}

function NavLink({ to, dot, label }: { to: string; dot: string; label: string }) {
  return (
    <Link to={to} style={{ display: "flex", alignItems: "center", gap: 6, color: "#111", textDecoration: "none", fontWeight: 600, fontSize: 15 }}
      onMouseEnter={e => (e.currentTarget.style.opacity = "0.7")}
      onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
    >
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot, flexShrink: 0 }} />
      {label}
    </Link>
  );
}

