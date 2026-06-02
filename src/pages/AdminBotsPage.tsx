/**
 * /admin/bots — house bot performance dashboard.
 *
 * Dev-only. Shows each bot's strategy, current balance vs starting (200k),
 * P&L, total predictions, win rate, and recent activity. Pulls live data
 * straight from Supabase (house_bots, fini_balances, predictions).
 */
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const STARTING_BALANCE = 200_000;
const S: React.CSSProperties = { fontFamily: "'Nunito', system-ui, sans-serif" };

type Bot = {
  wallet_address: string;
  handle: string;
  strategy_type: string;
  params: Record<string, unknown>;
  stake: number;
  active: boolean;
};
type Pred = {
  wallet_address: string;
  battle_id: string;
  side: string;
  stake: number;
  payout: number | null;
  status: string;
  created_at: string;
};

type Row = {
  bot: Bot;
  balance: number;
  pl: number;
  total: number;
  open: number;
  resolved: number;
  wins: number;
  staked: number;
  paidOut: number;
  recent: Pred[];
};

function isDev() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("fini_dev") !== "0";
}

const STRATEGY_BLURB: Record<string, string> = {
  momentum: "Backs the leading side — chases winners. Good in trending markets, bleeds in chop.",
  contrarian: "Fades the crowd — bets the underdog when favourites look overpriced.",
  loyalist: "Always picks a fixed side. Pure benchmark — wins only when that side has a real edge.",
  flat_bias: "Pure one-side bias. Beating 50% means the side genuinely has the edge.",
  late_joiner: "Joins late on near-certain winners for small steady gains.",
  momentum_underlying: "Reads 5-min price velocity. Catches real moves the crowd hasn't priced.",
  mean_reversion: "Bets against spikes — wins when moves overshoot and snap back.",
  late_sniper: "Acts in the final seconds when the feed is clean — near-riskless.",
};

export function AdminBotsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    setLoading(true); setErr(null);
    try {
      const [{ data: bots }, { data: bals }, { data: preds }] = await Promise.all([
        supabase.from("house_bots").select("wallet_address,handle,strategy_type,params,stake,active").order("handle"),
        supabase.from("fini_balances").select("wallet_address,balance").like("wallet_address", "0xb07%"),
        supabase.from("predictions").select("wallet_address,battle_id,side,stake,payout,status,created_at").like("wallet_address", "0xb07%").order("created_at", { ascending: false }).limit(2000),
      ]);
      const balMap = new Map((bals ?? []).map(b => [b.wallet_address, b.balance]));
      const byBot = new Map<string, Pred[]>();
      for (const p of preds ?? []) {
        const arr = byBot.get(p.wallet_address) ?? [];
        arr.push(p as Pred);
        byBot.set(p.wallet_address, arr);
      }
      const out: Row[] = (bots ?? []).map(b => {
        const ps = byBot.get(b.wallet_address) ?? [];
        const balance = balMap.get(b.wallet_address) ?? 0;
        const staked = ps.reduce((s, p) => s + (p.stake || 0), 0);
        const paidOut = ps.reduce((s, p) => s + (p.payout || 0), 0);
        const open = ps.filter(p => p.status === "open").length;
        const resolved = ps.filter(p => p.status !== "open").length;
        const wins = ps.filter(p => (p.payout || 0) > p.stake).length;
        return {
          bot: b as Bot,
          balance,
          pl: balance - STARTING_BALANCE,
          total: ps.length,
          open,
          resolved,
          wins,
          staked,
          paidOut,
          recent: ps.slice(0, 10),
        };
      });
      out.sort((a, b) => b.pl - a.pl);
      setRows(out);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "load_failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isDev()) return;
    load();
    const t = setInterval(load, 30_000); // auto-refresh every 30s
    return () => clearInterval(t);
  }, []);

  if (!isDev()) {
    return (
      <div style={{ ...S, padding: "80px 48px", textAlign: "center", color: "#666" }}>
        <h1>Admin only</h1>
        <p>Add <code>?dev=1</code> to the URL to view this page.</p>
      </div>
    );
  }

  const totalPL = rows.reduce((s, r) => s + r.pl, 0);
  const totalPreds = rows.reduce((s, r) => s + r.total, 0);
  const totalResolved = rows.reduce((s, r) => s + r.resolved, 0);
  const totalWins = rows.reduce((s, r) => s + r.wins, 0);
  const overallWR = totalResolved > 0 ? Math.round((totalWins / totalResolved) * 100) : 0;

  return (
    <div style={{ ...S, background: "#f8f9fa", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #f0f0f0", padding: "32px 48px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 900, color: "#111", margin: 0 }}>🤖 House Bot Dashboard</h1>
              <p style={{ fontSize: 13, color: "#666", marginTop: 4, marginBottom: 0, fontWeight: 500 }}>
                Live performance of the {rows.length} rational bots seeding the arena.
              </p>
            </div>
            <button onClick={load} disabled={loading} style={{
              background: "#111", color: "#fff", border: "none", borderRadius: 100,
              padding: "10px 18px", fontSize: 13, fontWeight: 800, cursor: loading ? "wait" : "pointer",
              opacity: loading ? 0.5 : 1,
            }}>{loading ? "Loading…" : "↻ Refresh"}</button>
          </div>

          {/* Aggregate stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 24 }}>
            <Stat label="Total P&L" value={fmtPl(totalPL)} color={totalPL >= 0 ? "#16a34a" : "#dc2626"} />
            <Stat label="Predictions placed" value={totalPreds.toLocaleString()} color="#111" />
            <Stat label="Settled" value={totalResolved.toLocaleString()} color="#666" />
            <Stat label="Overall win rate" value={`${overallWR}%`} color={overallWR >= 50 ? "#16a34a" : "#dc2626"} />
          </div>
        </div>
      </div>

      {/* Bot list */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 48px" }}>
        {err && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", padding: 12, borderRadius: 8, marginBottom: 16 }}>
            Failed to load: {err}
          </div>
        )}

        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #f0f0f0", overflow: "hidden" }}>
          {/* Table header */}
          <div style={headerRow}>
            <div style={{ width: 24 }}></div>
            <div style={{ flex: 2, minWidth: 0 }}>Bot</div>
            <div style={{ flex: 2, minWidth: 0 }}>Strategy</div>
            <div style={{ flex: 1, textAlign: "right" }}>Balance</div>
            <div style={{ flex: 1, textAlign: "right" }}>P&L</div>
            <div style={{ flex: 0.6, textAlign: "right" }}>Preds</div>
            <div style={{ flex: 0.6, textAlign: "right" }}>Win%</div>
          </div>

          {rows.map(r => {
            const wr = r.resolved > 0 ? Math.round((r.wins / r.resolved) * 100) : null;
            const isOpen = expanded === r.bot.wallet_address;
            return (
              <div key={r.bot.wallet_address}>
                <div
                  onClick={() => setExpanded(isOpen ? null : r.bot.wallet_address)}
                  style={{ ...dataRow, cursor: "pointer", background: isOpen ? "#fafafa" : "#fff" }}
                >
                  <div style={{ width: 24, color: "#999", fontSize: 11 }}>{isOpen ? "▼" : "▶"}</div>
                  <div style={{ flex: 2, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, color: "#111" }}>{r.bot.handle}</div>
                    <div style={{ fontSize: 10, color: "#999", fontFamily: "monospace" }}>{r.bot.wallet_address.slice(0, 8)}…{r.bot.wallet_address.slice(-4)}</div>
                  </div>
                  <div style={{ flex: 2, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: "#333", fontWeight: 600 }}>{prettyStrategy(r.bot.strategy_type)}</div>
                    <div style={{ fontSize: 11, color: "#888" }}>{paramSummary(r.bot.params)}</div>
                  </div>
                  <div style={{ flex: 1, textAlign: "right", fontWeight: 700, color: "#111" }}>{r.balance.toLocaleString()}</div>
                  <div style={{ flex: 1, textAlign: "right", fontWeight: 800, color: r.pl >= 0 ? "#16a34a" : "#dc2626" }}>{fmtPl(r.pl)}</div>
                  <div style={{ flex: 0.6, textAlign: "right", color: "#666", fontWeight: 600 }}>
                    {r.total}
                    {r.open > 0 && <span style={{ color: "#f59e0b", fontSize: 10, marginLeft: 4 }}>({r.open} open)</span>}
                  </div>
                  <div style={{ flex: 0.6, textAlign: "right", fontWeight: 700, color: wr == null ? "#999" : wr >= 55 ? "#16a34a" : wr <= 45 ? "#dc2626" : "#666" }}>
                    {wr == null ? "—" : `${wr}%`}
                  </div>
                </div>

                {/* Expanded detail */}
                {isOpen && (
                  <div style={{ background: "#fafafa", padding: "16px 24px", borderTop: "1px solid #f0f0f0", borderBottom: "1px solid #f0f0f0" }}>
                    <div style={{ fontSize: 12, color: "#555", marginBottom: 10, lineHeight: 1.5 }}>
                      <strong style={{ color: "#111" }}>How it plays:</strong> {STRATEGY_BLURB[r.bot.strategy_type] ?? "Custom strategy."}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginBottom: 14, fontSize: 11 }}>
                      <KV k="Stake / forecast" v={`${r.bot.stake} FINI$`} />
                      <KV k="Total staked" v={r.staked.toLocaleString()} />
                      <KV k="Total paid out" v={r.paidOut.toLocaleString()} />
                      <KV k="Net per-pred" v={r.resolved > 0 ? `${Math.round(r.pl / r.resolved)} FINI$` : "—"} />
                    </div>
                    {r.recent.length === 0 ? (
                      <div style={{ fontSize: 12, color: "#999", fontStyle: "italic" }}>No predictions yet — the bot's filters may be skipping all open battles.</div>
                    ) : (
                      <div>
                        <div style={{ fontSize: 11, color: "#888", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Recent predictions</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                          {r.recent.map((p, i) => {
                            const won = (p.payout || 0) > p.stake;
                            const lost = p.status !== "open" && (p.payout || 0) < p.stake;
                            return (
                              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 8px", background: "#fff", borderRadius: 4, border: "1px solid #f0f0f0" }}>
                                <span style={{ color: "#666", fontFamily: "monospace", fontSize: 11 }}>{p.battle_id}</span>
                                <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
                                  <span style={{ color: "#666" }}>{p.side} / {p.stake}</span>
                                  {p.status === "open"
                                    ? <span style={{ color: "#f59e0b", fontWeight: 700 }}>OPEN</span>
                                    : won ? <span style={{ color: "#16a34a", fontWeight: 700 }}>+{(p.payout || 0) - p.stake}</span>
                                    : lost ? <span style={{ color: "#dc2626", fontWeight: 700 }}>-{p.stake - (p.payout || 0)}</span>
                                    : <span style={{ color: "#999" }}>void</span>}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {rows.length === 0 && !loading && (
            <div style={{ padding: 48, textAlign: "center", color: "#999" }}>No bots found.</div>
          )}
        </div>

        {/* Strategy aggregate */}
        <StrategyRollup rows={rows} />
      </div>
    </div>
  );
}

function StrategyRollup({ rows }: { rows: Row[] }) {
  // Aggregate P&L + win rate per strategy type, so you can see which approach
  // is actually working market-wide.
  const byType = new Map<string, { pl: number; total: number; wins: number; resolved: number; n: number }>();
  for (const r of rows) {
    const t = r.bot.strategy_type;
    const e = byType.get(t) ?? { pl: 0, total: 0, wins: 0, resolved: 0, n: 0 };
    e.pl += r.pl; e.total += r.total; e.wins += r.wins; e.resolved += r.resolved; e.n += 1;
    byType.set(t, e);
  }
  const arr = Array.from(byType.entries()).map(([t, e]) => ({ t, ...e })).sort((a, b) => b.pl - a.pl);
  return (
    <div style={{ marginTop: 24, background: "#fff", borderRadius: 16, border: "1px solid #f0f0f0", padding: 24 }}>
      <h2 style={{ fontSize: 16, fontWeight: 900, color: "#111", margin: 0, marginBottom: 12 }}>Strategy rollup</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
        {arr.map(s => {
          const wr = s.resolved > 0 ? Math.round((s.wins / s.resolved) * 100) : null;
          return (
            <div key={s.t} style={{ padding: 14, background: s.pl >= 0 ? "#f0fdf4" : "#fef2f2", border: `1px solid ${s.pl >= 0 ? "#bbf7d0" : "#fecaca"}`, borderRadius: 10 }}>
              <div style={{ fontWeight: 800, color: "#111", marginBottom: 4 }}>{prettyStrategy(s.t)}</div>
              <div style={{ fontSize: 11, color: "#666", marginBottom: 8, lineHeight: 1.4 }}>{STRATEGY_BLURB[s.t] ?? ""}</div>
              <div style={{ display: "flex", gap: 12, fontSize: 12, fontWeight: 700 }}>
                <span style={{ color: s.pl >= 0 ? "#16a34a" : "#dc2626" }}>{fmtPl(s.pl)} P&L</span>
                <span style={{ color: "#666" }}>{wr == null ? "—" : `${wr}% win`}</span>
                <span style={{ color: "#999" }}>{s.total} preds · {s.n} bots</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: "#fafafa", padding: "12px 16px", borderRadius: 10, border: "1px solid #f0f0f0" }}>
      <div style={{ fontSize: 10, color: "#888", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color, marginTop: 2 }}>{value}</div>
    </div>
  );
}
function KV({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div style={{ color: "#888", fontWeight: 700, textTransform: "uppercase", fontSize: 10, letterSpacing: 0.5 }}>{k}</div>
      <div style={{ color: "#111", fontWeight: 700 }}>{v}</div>
    </div>
  );
}
function prettyStrategy(t: string): string {
  return t.split("_").map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
}
function paramSummary(p: Record<string, unknown>): string {
  if (!p || Object.keys(p).length === 0) return "default params";
  const bits: string[] = [];
  if (p.sideFilter) bits.push(`side ${p.sideFilter}`);
  if (Array.isArray(p.assetFilter) && p.assetFilter.length) bits.push(p.assetFilter.join("/"));
  if (p.pctThreshold) bits.push(`pct≤${p.pctThreshold}`);
  if (p.velocityThreshold) bits.push(`vel ${p.velocityThreshold}`);
  if (p.minEdgePp) bits.push(`edge ${p.minEdgePp}pp`);
  return bits.join(" · ") || "—";
}
function fmtPl(n: number): string {
  if (n === 0) return "±0";
  return n > 0 ? `+${n.toLocaleString()}` : n.toLocaleString();
}

const headerRow: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 12, padding: "12px 24px",
  borderBottom: "2px solid #f0f0f0", fontSize: 10, fontWeight: 800,
  color: "#888", textTransform: "uppercase", letterSpacing: 0.5, background: "#fafafa",
};
const dataRow: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 12, padding: "14px 24px",
  borderBottom: "1px solid #f5f5f5", fontSize: 13,
};
