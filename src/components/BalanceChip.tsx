import { useCoinStore, fmtCoin } from "../state/coinStore";
import { useUIStore } from "../state/uiStore";
import { useNavigate } from "react-router-dom";

/**
 * Top-nav FINI$ chip — the bankroll only.
 * (Crumbs are an in-battle currency and live in the Fight Club shop area,
 * not the global nav, so the bankroll has visual priority.)
 */
export function BalanceChip({ compact = false }: { compact?: boolean }) {
  const balance = useCoinStore(s => s.balance);
  const walletAddress = useUIStore(s => s.walletAddress);
  const navigate = useNavigate();

  if (!walletAddress) return null;

  return (
    <button
      onClick={() => navigate("/claim")}
      title="Your FINI$ bankroll — entry stakes & prizes"
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: compact ? "5px 10px" : "7px 14px",
        borderRadius: 100,
        background: "linear-gradient(135deg, #fef3c7, #fde68a)",
        border: "1.5px solid #fbbf24",
        color: "#854d0e", fontWeight: 800,
        fontSize: compact ? 12 : 13, cursor: "pointer",
        transition: "transform 0.12s",
        fontFamily: "'Nunito', system-ui, sans-serif",
      }}
      onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-1px)")}
      onMouseLeave={e => (e.currentTarget.style.transform = "")}
    >
      <span style={{ fontSize: compact ? 13 : 15 }}>🪙</span>
      <span>{fmtCoin(balance, { compact })}</span>
      <span style={{ opacity: 0.75, fontWeight: 700 }}>FINI$</span>
    </button>
  );
}
