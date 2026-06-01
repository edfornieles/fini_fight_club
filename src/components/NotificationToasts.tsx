/**
 * Floating toast stack — top-right of the viewport.
 *
 * Renders the live `useNotifications.list`. Wins get a green/yellow celebration
 * tone, losses a muted red, info purple. Click anywhere on the toast (or its
 * × button) to dismiss; click the linked href to navigate to the source battle.
 */
import { Link } from "react-router-dom";
import { useNotifications, type NotifTone } from "../state/notificationsStore";

const TONE_STYLES: Record<NotifTone, { bg: string; border: string; titleColor: string }> = {
  win:     { bg: "linear-gradient(135deg, #dcfce7, #bbf7d0)", border: "#22c55e", titleColor: "#15803d" },
  loss:    { bg: "linear-gradient(135deg, #fee2e2, #fecaca)", border: "#ef4444", titleColor: "#b91c1c" },
  info:    { bg: "linear-gradient(135deg, #f3e8ff, #e9d5ff)", border: "#a855f7", titleColor: "#6d28d9" },
  warning: { bg: "linear-gradient(135deg, #fef3c7, #fde68a)", border: "#f59e0b", titleColor: "#854d0e" },
};

export function NotificationToasts() {
  const list = useNotifications(s => s.list);
  const dismiss = useNotifications(s => s.dismiss);

  if (list.length === 0) return null;

  return (
    <div style={{
      position: "fixed", top: 76, right: 20, zIndex: 9500,
      display: "flex", flexDirection: "column", gap: 10,
      width: 340, maxWidth: "calc(100vw - 40px)",
      pointerEvents: "none",
      fontFamily: "'Nunito', system-ui, sans-serif",
    }}>
      {list.slice().reverse().map(n => {
        const style = TONE_STYLES[n.tone];
        const inner = (
          <div style={{
            position: "relative",
            background: style.bg, border: `2px solid ${style.border}`,
            borderRadius: 14, padding: "12px 14px",
            boxShadow: "0 12px 28px rgba(0,0,0,0.18)",
            pointerEvents: "auto",
            cursor: n.href ? "pointer" : "default",
            animation: "fini-toast-in 0.32s cubic-bezier(.18,1.2,.4,1)",
          }}>
            <button
              onClick={e => { e.preventDefault(); e.stopPropagation(); dismiss(n.id); }}
              aria-label="Dismiss"
              style={{
                position: "absolute", top: 6, right: 8,
                background: "transparent", border: "none",
                color: style.titleColor, opacity: 0.6,
                fontSize: 18, lineHeight: 1, cursor: "pointer", padding: 2,
              }}
            >×</button>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <div style={{ fontSize: 28, lineHeight: 1, flexShrink: 0 }}>{n.icon}</div>
              <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: style.titleColor, lineHeight: 1.3 }}>
                  {n.title}
                </div>
                {n.body && (
                  <div style={{ fontSize: 12, color: "#333", marginTop: 2, fontWeight: 500, lineHeight: 1.4 }}>
                    {n.body}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
        return n.href
          ? <Link key={n.id} to={n.href} style={{ textDecoration: "none", color: "inherit" }}>{inner}</Link>
          : <div key={n.id}>{inner}</div>;
      })}

      {/* Slide-in animation */}
      <style>{`
        @keyframes fini-toast-in {
          0%   { transform: translateX(420px); opacity: 0; }
          100% { transform: translateX(0);     opacity: 1; }
        }
      `}</style>
    </div>
  );
}
