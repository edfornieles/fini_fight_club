import type { BattleInstance } from "../game/priceIntegrity";

const SOURCE_LABELS: Record<string, string> = {
  coingecko_v3:  "CoinGecko v3 API",
  coinbase_spot: "Coinbase Advanced Trade",
  binance_spot:  "Binance Spot API",
  kraken_spot:   "Kraken REST API",
  manual_admin:  "Manual admin entry",
};

const STATUS_CONFIG: Record<string, { bg: string; color: string; icon: string; label: string }> = {
  resolved:      { bg: "#dcfce7", color: "#15803d", icon: "✓", label: "Resolved" },
  manual_review: { bg: "#fef9c3", color: "#854d0e", icon: "⚠", label: "Manual Review" },
  voided:        { bg: "#fee2e2", color: "#dc2626", icon: "✕", label: "Voided — Entries Returned" },
  resolving:     { bg: "#dbeafe", color: "#1d4ed8", icon: "⟳", label: "Resolving" },
  locked:        { bg: "#f3e8ff", color: "#7c3aed", icon: "🔒", label: "Locked" },
  open:          { bg: "#f3f4f6", color: "#6b7280", icon: "○", label: "Open" },
  pending:       { bg: "#f3f4f6", color: "#6b7280", icon: "○", label: "Pending" },
};

export function ResolutionAuditPanel({ instance }: { instance: BattleInstance }) {
  const status = STATUS_CONFIG[instance.resolutionStatus] ?? STATUS_CONFIG.pending;

  return (
    <div style={{ fontFamily: "'Nunito', system-ui, sans-serif", display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#111" }}>Resolution Audit</div>
        <span style={{
          fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 100,
          background: status.bg, color: status.color,
        }}>
          {status.icon} {status.label}
        </span>
      </div>

      {/* Void notice */}
      {instance.resolutionStatus === "voided" && instance.voidReason && (
        <Notice color="#fee2e2" border="#fca5a5" textColor="#7f1d1d">
          <strong>Why this battle was voided:</strong> {instance.voidReason}
        </Notice>
      )}

      {/* Manual review notice */}
      {instance.resolutionStatus === "manual_review" && (
        <Notice color="#fef9c3" border="#fde047" textColor="#713f12">
          <strong>Pending admin review.</strong> All entries are held. No payouts will occur until an admin resolves this battle. You will see the outcome here when it is decided.
        </Notice>
      )}

      {/* Security notice */}
      <Notice color="#f0f9ff" border="#bae6fd" textColor="#075985">
        All prices, winners, and payouts are determined server-side. The client cannot submit prices or influence resolution. Entries accepted before the cutoff cannot be changed.
      </Notice>

      {/* Price snapshots */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <SnapshotCard
          label="Official Start Price"
          price={instance.officialStartPrice}
          source={instance.officialStartPriceSource}
          timestamp={instance.officialStartTimestamp}
          backups={instance.startBackupPriceChecks}
          deviation={instance.startDeviationReport}
        />
        <SnapshotCard
          label="Official End Price"
          price={instance.officialEndPrice}
          source={instance.officialEndPriceSource}
          timestamp={instance.officialEndTimestamp}
          backups={instance.endBackupPriceChecks}
          deviation={instance.endDeviationReport}
          failed={instance.resolutionStatus !== "resolved" && instance.officialEndPrice === null}
        />
      </div>

      {/* Resolution formula */}
      <Section label="Resolution Formula">
        <div style={{ fontSize: 13, color: "#555", lineHeight: 1.6, fontWeight: 500, fontFamily: "monospace", background: "#f9fafb", padding: "10px 14px", borderRadius: 10 }}>
          {instance.resolutionFormula}
        </div>
      </Section>

      {/* Calculation */}
      {instance.resolutionStatus === "resolved" && (
        <Section label="Calculation Applied">
          <div style={{ fontSize: 13, fontWeight: 700, color: "#111", background: "#f0fdf4", border: "1.5px solid #bbf7d0", borderRadius: 10, padding: "10px 14px" }}>
            {instance.resolutionCalculation}
          </div>
          <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
            <WinnerChip
              label={instance.winningSide === "A" ? instance.sideALabel : instance.sideBLabel}
              won={true}
            />
            <WinnerChip
              label={instance.winningSide === "A" ? instance.sideBLabel : instance.sideALabel}
              won={false}
            />
          </div>
        </Section>
      )}

      {/* Audit log */}
      <Section label="Full Audit Log">
        <div style={{ display: "flex", flexDirection: "column", gap: 0, borderLeft: "2px solid #e5e7eb", paddingLeft: 16 }}>
          {instance.resolutionAuditLog.map((entry, i) => (
            <div key={i} style={{ paddingBottom: 14, position: "relative" }}>
              <div style={{
                position: "absolute", left: -22, top: 3,
                width: 10, height: 10, borderRadius: "50%",
                background: entry.actor === "admin" ? "#f59e0b" : "#6366f1",
                border: "2px solid #fff",
              }} />
              <div style={{ fontSize: 11, color: "#aaa", fontFamily: "monospace", marginBottom: 2 }}>
                {new Date(entry.timestamp).toLocaleString("en-GB", { hour12: false })}
                {" · "}
                <span style={{ color: entry.actor === "admin" ? "#f59e0b" : "#6366f1", fontWeight: 700 }}>
                  {entry.actor}
                </span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#222" }}>{entry.event}</div>
              {entry.detail && (
                <div style={{ fontSize: 12, color: "#666", marginTop: 2, lineHeight: 1.5 }}>{entry.detail}</div>
              )}
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function SnapshotCard({ label, price, source, timestamp, backups, deviation, failed }: {
  label: string;
  price: number | null;
  source: string | null;
  timestamp: string | null;
  backups: { source: string; price: number; fetchedAt: string; latencyMs: number }[];
  deviation: { primaryPrice: number; maxDeviationBps: number; withinThreshold: boolean } | null;
  failed?: boolean;
}) {
  return (
    <div style={{
      borderRadius: 14, border: `1.5px solid ${failed ? "#fca5a5" : "#e5e7eb"}`,
      background: failed ? "#fff5f5" : "#f9fafb", padding: "14px",
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{label}</div>

      {price !== null ? (
        <>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#111" }}>
            ${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>
            <div>{source ? SOURCE_LABELS[source] ?? source : "—"}</div>
            <div style={{ fontFamily: "monospace" }}>{timestamp ? new Date(timestamp).toISOString() : "—"}</div>
          </div>
          {deviation && (
            <div style={{
              marginTop: 8, fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6,
              background: deviation.withinThreshold ? "#dcfce7" : "#fee2e2",
              color: deviation.withinThreshold ? "#15803d" : "#dc2626",
              display: "inline-block",
            }}>
              {deviation.withinThreshold ? "✓" : "✕"} {deviation.maxDeviationBps.toFixed(1)}bps deviation
            </div>
          )}
          {backups.length > 0 && (
            <div style={{ marginTop: 10, borderTop: "1px solid #e5e7eb", paddingTop: 8, display: "flex", flexDirection: "column", gap: 3 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Backup checks</div>
              {backups.map(b => (
                <div key={b.source} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#666" }}>
                  <span>{SOURCE_LABELS[b.source] ?? b.source}</span>
                  <span style={{ fontWeight: 700, fontFamily: "monospace" }}>
                    ${b.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    <span style={{ color: "#bbb", fontWeight: 400 }}> {b.latencyMs}ms</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div style={{ fontSize: 13, fontWeight: 700, color: failed ? "#dc2626" : "#aaa" }}>
          {failed ? "⚠ Price integrity check failed — see audit log" : "Not yet recorded"}
          {backups.length > 0 && (
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.06em" }}>Attempted sources</div>
              {backups.map(b => (
                <div key={b.source} style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                  <span style={{ color: "#666" }}>{SOURCE_LABELS[b.source] ?? b.source}</span>
                  <span style={{ fontWeight: 700, fontFamily: "monospace", color: "#ef4444" }}>
                    ${b.price.toLocaleString()} <span style={{ color: "#bbb", fontWeight: 400 }}>{b.latencyMs}ms</span>
                  </span>
                </div>
              ))}
              {deviation && !deviation.withinThreshold && (
                <div style={{ fontSize: 11, fontWeight: 700, color: "#ef4444", background: "#fee2e2", padding: "4px 8px", borderRadius: 6, marginTop: 4 }}>
                  ✕ {deviation.maxDeviationBps.toFixed(1)}bps — exceeds 50bps limit
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{label}</div>
      {children}
    </div>
  );
}

function Notice({ color, border, textColor, children }: { color: string; border: string; textColor: string; children: React.ReactNode }) {
  return (
    <div style={{ background: color, border: `1.5px solid ${border}`, borderRadius: 12, padding: "12px 14px", fontSize: 12, color: textColor, lineHeight: 1.6 }}>
      {children}
    </div>
  );
}

function WinnerChip({ label, won }: { label: string; won: boolean }) {
  return (
    <span style={{
      fontSize: 12, fontWeight: 800, padding: "5px 14px", borderRadius: 100,
      background: won ? "#dcfce7" : "#f3f4f6",
      color: won ? "#15803d" : "#9ca3af",
    }}>
      {won ? "🏆" : "✕"} {label}
    </span>
  );
}
