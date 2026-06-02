/**
 * ActivityHub — the player's own history of forecasts.
 *
 * Renders three views of their data:
 *   1. Open positions — currently live bets with mark-to-market value
 *   2. Activity      — chronological log of every event (placed / settled / sold)
 *   3. History       — only the settled rows, easy to scan W/L
 *
 * Header strip up top: net P&L (the emotional anchor), volume staked,
 * battles bet on, and current open-position value.
 *
 * Empty state nudges first-time players toward the arena rather than
 * showing zeros.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMyEntries, positionValue, type MyEntry } from "../state/myEntriesStore";
import { useCoinStore } from "../state/coinStore";
import { useSimBattles } from "../data/cryptoSim";

type Tab = "open" | "activity" | "history";

export function ActivityHub() {
  const entries = useMyEntries(s => s.entries);
  const sellEntry = useMyEntries(s => s.sellEntry);
  const earn = useCoinStore(s => s.earn);
  const battles = useSimBattles();
  const [tab, setTab] = useState<Tab>("open");

  // ── Header aggregates ───────────────────────────────────────────────────
  const stats = useMemo(() => {
    let staked = 0, paid = 0, openValue = 0, openCount = 0;
    let wins = 0, losses = 0, voided = 0, sold = 0;
    const battleIds = new Set<string>();
    for (const e of entries) {
      staked += e.stake;
      battleIds.add(e.battleId);
      if (e.status === "open") {
        openCount++;
        // Mark-to-market against current side odds (falls back to entry stake)
        const battle = battles.find(b => b.id === e.battleId);
        if (battle) {
          const sidePct = e.side === "A" ? battle.sideA.pct : battle.sideB.pct;
          openValue += positionValue(e, sidePct);
        } else {
          openValue += e.stake; // unknown — value at cost
        }
      } else if (e.status === "won") {
        wins++;
        paid += e.result?.payout ?? 0;
      } else if (e.status === "lost") {
        losses++;
      } else if (e.status === "voided") {
        voided++;
        paid += e.result?.payout ?? 0;
      } else if (e.status === "sold") {
        sold++;
        paid += e.soldFor ?? 0;
      }
    }
    // Realised P&L = paid out (winnings + refunds + sales) − total staked
    // PLUS unrealized: open-position current value − open-position stake-at-risk.
    // Together: paid + openValue − staked. Open positions you haven't realised
    // still count toward the picture so you see the true position.
    const openStaked = entries.filter(e => e.status === "open").reduce((s, e) => s + e.stake, 0);
    const realisedPL = paid - (staked - openStaked);
    const unrealisedPL = openValue - openStaked;
    const totalPL = realisedPL + unrealisedPL;
    const settled = wins + losses + voided + sold;
    const winRate = settled > 0 ? Math.round((wins / settled) * 100) : null;
    return { staked, paid, openValue, openCount, realisedPL, unrealisedPL, totalPL, wins, losses, voided, sold, battles: battleIds.size, settled, winRate };
  }, [entries, battles]);

  // ── Partition ───────────────────────────────────────────────────────────
  const sorted = useMemo(() => entries.slice().sort((a, b) => (b.result?.settledAt ?? b.endsAt) - (a.result?.settledAt ?? a.endsAt)), [entries]);
  const openEntries = sorted.filter(e => e.status === "open");
  const settledEntries = sorted.filter(e => e.status !== "open");

  const empty = entries.length === 0;

  // ── Sell handler ─────────────────────────────────────────────────────────
  function handleSell(entry: MyEntry) {
    const battle = battles.find(b => b.id === entry.battleId);
    if (!battle) return;
    const sidePct = entry.side === "A" ? battle.sideA.pct : battle.sideB.pct;
    const value = positionValue(entry, sidePct);
    const sold = sellEntry(entry.battleId, value);
    if (sold) earn(value);
  }

  return (
    <div style={{ fontFamily: "'Nunito', system-ui, sans-serif" }}>
      {/* ── Header stat strip ──────────────────────────────────────────── */}
      <div style={{
        background: "#fff", borderRadius: 20, padding: "24px 28px",
        border: "1.5px solid #f0f0f0", marginBottom: 16,
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#888", textTransform: "uppercase", letterSpacing: 0.5 }}>Net P&L</div>
          <div style={{
            fontSize: 38, fontWeight: 900, fontFamily: "monospace",
            color: stats.totalPL > 0 ? "#16a34a" : stats.totalPL < 0 ? "#dc2626" : "#666",
          }}>
            {stats.totalPL >= 0 ? "+" : ""}{stats.totalPL.toLocaleString()} <span style={{ fontSize: 16, opacity: 0.7 }}>FINI$</span>
          </div>
          <div style={{ fontSize: 12, color: "#999", fontWeight: 600 }}>
            {stats.realisedPL >= 0 ? "+" : ""}{stats.realisedPL.toLocaleString()} realised · {stats.unrealisedPL >= 0 ? "+" : ""}{stats.unrealisedPL.toLocaleString()} unrealised
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
          <Stat label="Open positions" value={stats.openCount.toLocaleString()} sub={`${stats.openValue.toLocaleString()} FINI$ at risk`} />
          <Stat label="Volume staked" value={stats.staked.toLocaleString()} sub="all-time FINI$" />
          <Stat label="Battles bet on" value={stats.battles.toLocaleString()} sub={`${stats.settled} settled`} />
          <Stat label="Win rate" value={stats.winRate == null ? "—" : `${stats.winRate}%`} sub={`${stats.wins}W · ${stats.losses}L · ${stats.voided}V · ${stats.sold}S`} />
        </div>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        <TabButton active={tab === "open"}     onClick={() => setTab("open")}    >Open ({openEntries.length})</TabButton>
        <TabButton active={tab === "activity"} onClick={() => setTab("activity")}>Activity ({entries.length})</TabButton>
        <TabButton active={tab === "history"}  onClick={() => setTab("history")} >History ({settledEntries.length})</TabButton>
      </div>

      {/* ── Content ───────────────────────────────────────────────────── */}
      <div style={{ background: "#fff", borderRadius: 20, border: "1.5px solid #f0f0f0", overflow: "hidden" }}>
        {empty ? (
          <EmptyState />
        ) : tab === "open" ? (
          <OpenPositionsTable entries={openEntries} battles={battles} onSell={handleSell} />
        ) : tab === "activity" ? (
          <ActivityTable entries={sorted} />
        ) : (
          <ActivityTable entries={settledEntries} />
        )}
      </div>
    </div>
  );
}

// ── Open positions table — mark-to-market with Sell action ─────────────────
function OpenPositionsTable({
  entries, battles, onSell,
}: {
  entries: MyEntry[];
  battles: { id: string; sideA: { pct: number }; sideB: { pct: number } }[];
  onSell: (e: MyEntry) => void;
}) {
  if (entries.length === 0) {
    return <Pad>No open positions right now. The next round is one click away from any battle page.</Pad>;
  }
  return (
    <div>
      <Header cols={["Battle", "Side", "Stake", "Entry", "Now", "Worth", "Unrealised P&L", ""]} />
      {entries.map((e, i) => {
        const battle = battles.find(b => b.id === e.battleId);
        const sidePct = battle ? (e.side === "A" ? battle.sideA.pct : battle.sideB.pct) : e.entryPct;
        const value = positionValue(e, sidePct);
        const pl = value - e.stake;
        const plPct = e.stake > 0 ? Math.round((pl / e.stake) * 100) : 0;
        return (
          <Row key={i}>
            <Cell flex={2}>
              <Link to={`/battle/${e.battleId}`} style={linkBlock}>{e.battleTitle}</Link>
              <Sub>{relativeEnds(e.endsAt)}</Sub>
            </Cell>
            <Cell flex={0.8}><Pill side={e.side}>{e.sideLabel}</Pill></Cell>
            <Cell flex={0.8} align="right">{e.stake.toLocaleString()}</Cell>
            <Cell flex={0.7} align="right">{e.entryPct}%</Cell>
            <Cell flex={0.7} align="right">{sidePct}%</Cell>
            <Cell flex={1} align="right" mono><b>{value.toLocaleString()}</b></Cell>
            <Cell flex={1.1} align="right" mono>
              <span style={{ color: pl > 0 ? "#16a34a" : pl < 0 ? "#dc2626" : "#666", fontWeight: 800 }}>
                {pl >= 0 ? "+" : ""}{pl.toLocaleString()} <small style={{ opacity: 0.7 }}>({pl >= 0 ? "+" : ""}{plPct}%)</small>
              </span>
            </Cell>
            <Cell flex={0.8} align="right">
              <button onClick={() => onSell(e)} style={sellBtn}>Sell</button>
            </Cell>
          </Row>
        );
      })}
    </div>
  );
}

// ── Activity table — chronological event log ───────────────────────────────
function ActivityTable({ entries }: { entries: MyEntry[] }) {
  if (entries.length === 0) {
    return <Pad>No settled activity yet. Open positions show up here once they resolve.</Pad>;
  }
  return (
    <div>
      <Header cols={["Event", "Battle", "Side", "Stake", "Outcome", "When"]} />
      {entries.map((e, i) => {
        const event = eventFor(e);
        return (
          <Row key={i}>
            <Cell flex={0.9}>
              <span style={{ fontSize: 16, marginRight: 6 }}>{event.icon}</span>
              <b>{event.label}</b>
            </Cell>
            <Cell flex={2}>
              <Link to={`/battle/${e.battleId}`} style={linkBlock}>{e.battleTitle}</Link>
            </Cell>
            <Cell flex={0.8}><Pill side={e.side}>{e.sideLabel}</Pill></Cell>
            <Cell flex={0.8} align="right">{e.stake.toLocaleString()}</Cell>
            <Cell flex={1.4} align="right" mono>
              {e.status === "open" ? (
                <span style={{ color: "#888" }}>—</span>
              ) : e.status === "won" ? (
                <span style={{ color: "#16a34a", fontWeight: 800 }}>+{((e.result?.payout ?? 0) - e.stake).toLocaleString()} (paid {(e.result?.payout ?? 0).toLocaleString()})</span>
              ) : e.status === "lost" ? (
                <span style={{ color: "#dc2626", fontWeight: 800 }}>-{e.stake.toLocaleString()}</span>
              ) : e.status === "voided" ? (
                <span style={{ color: "#a855f7", fontWeight: 700 }}>Refunded {e.stake.toLocaleString()}</span>
              ) : e.status === "sold" ? (
                <span style={{ color: (e.soldFor ?? 0) >= e.stake ? "#16a34a" : "#dc2626", fontWeight: 800 }}>
                  {(((e.soldFor ?? 0) - e.stake) >= 0) ? "+" : ""}{((e.soldFor ?? 0) - e.stake).toLocaleString()} (sold for {(e.soldFor ?? 0).toLocaleString()})
                </span>
              ) : null}
            </Cell>
            <Cell flex={0.9} align="right">
              <span title={absoluteLocal(e.result?.settledAt ?? e.endsAt)} style={{ color: "#888" }}>
                {relative(e.result?.settledAt ?? e.endsAt)}
              </span>
            </Cell>
          </Row>
        );
      })}
    </div>
  );
}

// ── Atoms ──────────────────────────────────────────────────────────────────
function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ background: "#fafafa", border: "1px solid #f0f0f0", borderRadius: 12, padding: "10px 14px" }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: "#999", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 900, color: "#111", marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "#888", marginTop: 1 }}>{sub}</div>}
    </div>
  );
}
function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      background: active ? "#111" : "#fff",
      color: active ? "#fff" : "#666",
      border: active ? "1.5px solid #111" : "1.5px solid #e5e7eb",
      borderRadius: 100, padding: "8px 16px",
      fontSize: 12, fontWeight: 800, cursor: "pointer",
    }}>{children}</button>
  );
}
function Header({ cols }: { cols: string[] }) {
  return (
    <div style={{
      display: "flex", gap: 12, padding: "10px 20px",
      background: "#fafafa", borderBottom: "1px solid #f0f0f0",
      fontSize: 10, fontWeight: 800, color: "#888", textTransform: "uppercase", letterSpacing: 0.5,
    }}>
      {cols.map((c, i) => <div key={i} style={{ flex: i === 0 ? 2 : 1 }}>{c}</div>)}
    </div>
  );
}
function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", gap: 12, padding: "12px 20px", borderBottom: "1px solid #f5f5f5", fontSize: 13, alignItems: "center" }}>{children}</div>;
}
function Cell({ children, flex = 1, align = "left", mono = false }: { children: React.ReactNode; flex?: number; align?: "left" | "right"; mono?: boolean }) {
  return <div style={{ flex, textAlign: align, fontFamily: mono ? "monospace" : "inherit", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{children}</div>;
}
function Sub({ children }: { children: React.ReactNode }) { return <div style={{ fontSize: 11, color: "#999", marginTop: 1 }}>{children}</div>; }
function Pill({ side, children }: { side: "A" | "B"; children: React.ReactNode }) {
  return (
    <span style={{
      display: "inline-block",
      background: side === "A" ? "#dcfce7" : "#fee2e2",
      color:      side === "A" ? "#15803d" : "#b91c1c",
      padding: "2px 9px", borderRadius: 100, fontSize: 11, fontWeight: 800,
    }}>{children}</span>
  );
}
function Pad({ children }: { children: React.ReactNode }) { return <div style={{ padding: "40px 24px", textAlign: "center", color: "#888", fontSize: 13, fontWeight: 600 }}>{children}</div>; }
function EmptyState() {
  return (
    <div style={{ padding: "60px 24px", textAlign: "center" }}>
      <div style={{ fontSize: 48, marginBottom: 8 }}>🎲</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: "#111", marginBottom: 6 }}>Your forecast log is empty.</div>
      <div style={{ fontSize: 13, color: "#666", marginBottom: 18, maxWidth: 380, marginInline: "auto", lineHeight: 1.5 }}>
        Pick a side on any open battle. Win, lose or sell early — every move shows up here as you build a track record.
      </div>
      <Link to="/crypto" style={{
        background: "linear-gradient(135deg, #f472b6, #ec4899)", color: "#fff",
        padding: "11px 22px", borderRadius: 100, textDecoration: "none",
        fontWeight: 800, fontSize: 13,
      }}>Browse Arena →</Link>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────
function eventFor(e: MyEntry): { icon: string; label: string } {
  switch (e.status) {
    case "open":   return { icon: "📍", label: "Open" };
    case "won":    return { icon: "🎉", label: "Won" };
    case "lost":   return { icon: "💀", label: "Lost" };
    case "voided": return { icon: "↩️", label: "Refunded" };
    case "sold":   return { icon: "💸", label: "Sold early" };
  }
}
function relative(ts: number): string {
  const diff = Date.now() - ts;
  const absDiff = Math.abs(diff);
  const past = diff > 0;
  const s = Math.floor(absDiff / 1000);
  if (s < 60)  return past ? `${s}s ago` : `in ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60)  return past ? `${m}m ago` : `in ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24)  return past ? `${h}h ago` : `in ${h}h`;
  const d = Math.floor(h / 24);
  return past ? `${d}d ago` : `in ${d}d`;
}
function relativeEnds(ts: number): string {
  const diff = ts - Date.now();
  if (diff <= 0) return "Resolving…";
  const s = Math.floor(diff / 1000);
  if (s < 60)  return `Ends in ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60)  return `Ends in ${m}m`;
  const h = Math.floor(m / 60);
  return `Ends in ${h}h ${m % 60}m`;
}
function absoluteLocal(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString();
}

// ── Styles ─────────────────────────────────────────────────────────────────
const linkBlock: React.CSSProperties = { color: "#111", fontWeight: 700, textDecoration: "none" };
const sellBtn: React.CSSProperties = {
  background: "#fff", border: "1.5px solid #e5e7eb",
  borderRadius: 100, padding: "6px 14px",
  fontSize: 11, fontWeight: 800, color: "#111", cursor: "pointer",
};
