import { useEffect, useState } from "react";
import { useCoinStore, fmtCoin } from "../state/coinStore";
import { useUIStore } from "../state/uiStore";
import { useNotifications } from "../state/notificationsStore";
import { useNavigate } from "react-router-dom";

/**
 * Top-nav CUTE$ chip + a drop/rescue chip so players never get stuck:
 *   - 🎁 Daily drop — come back each day, claim +500 CUTE$ (rewards activity)
 *   - 🪂 Top up — when you're nearly broke (< 100), grab +500 to keep playing
 * (Crumbs are the in-battle currency and live in the Fight Club shop area.)
 */
export function BalanceChip({ compact = false }: { compact?: boolean }) {
  const balance = useCoinStore(s => s.balance);
  const walletAddress = useUIStore(s => s.walletAddress);
  const claimDailyDrop = useCoinStore(s => s.claimDailyDrop);
  const rescueTopUp = useCoinStore(s => s.rescueTopUp);
  const dropCooldownMs = useCoinStore(s => s.dropCooldownMs);
  const economy = useCoinStore(s => s.economy);
  const pushNotif = useNotifications(s => s.push);
  const navigate = useNavigate();
  const [, tick] = useState(0);

  // Re-render each minute so the daily-drop availability updates.
  useEffect(() => {
    const t = setInterval(() => tick(n => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  if (!walletAddress) return null;

  const dropReady = dropCooldownMs() <= 0;
  const broke = balance < economy.rescueFloor;

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "'Nunito', system-ui, sans-serif" }}>
      {/* Daily drop OR rescue — whichever is relevant */}
      {broke ? (
        <button
          onClick={async () => { const a = await rescueTopUp(); if (a) pushNotif({ tone: "win", icon: "🪂", title: `+${a} CUTE$ top-up`, body: "A little something to keep you in the game." }); }}
          title="You're low — grab a top-up to keep playing"
          style={dropBtnStyle("#ef4444")}
        >🪂 Top up</button>
      ) : dropReady ? (
        <button
          onClick={async () => { const a = await claimDailyDrop(); if (a) pushNotif({ tone: "win", icon: "🎁", title: `Daily drop: +${a} CUTE$`, body: "Thanks for coming back — see you tomorrow for more." }); tick(n => n + 1); }}
          title="Your daily CUTE$ drop is ready"
          style={dropBtnStyle("#16a34a")}
        >🎁 Daily +{economy.dailyGrant}</button>
      ) : null}

      {/* Balance */}
      <button
        onClick={() => navigate("/claim")}
        title="Your CUTE$ bankroll — entry stakes & prizes"
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: compact ? "5px 10px" : "7px 14px",
          borderRadius: 100,
          background: "linear-gradient(135deg, #fef3c7, #fde68a)",
          border: "1.5px solid #fbbf24",
          color: "#854d0e", fontWeight: 800,
          fontSize: compact ? 12 : 13, cursor: "pointer",
          transition: "transform 0.12s",
        }}
        onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-1px)")}
        onMouseLeave={e => (e.currentTarget.style.transform = "")}
      >
        <span style={{ fontSize: compact ? 13 : 15 }}>🪙</span>
        <span>{fmtCoin(balance, { compact })}</span>
        <span style={{ opacity: 0.75, fontWeight: 700 }}>CUTE$</span>
      </button>
    </span>
  );
}

function dropBtnStyle(color: string): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 4,
    padding: "6px 12px", borderRadius: 100,
    background: color, color: "#fff", border: "none",
    fontSize: 12, fontWeight: 800, cursor: "pointer",
    boxShadow: `0 2px 8px ${color}55`,
  };
}
