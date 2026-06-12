/** Operator console → Bots tab: monitor + control the house bots. */
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { api } from "../../lib/api";
import { Card, Btn, Stat, KV, fmtPl, prettyStrategy, STRATEGY_TYPES, STRATEGY_BLURB } from "./shared";

const STARTING_BALANCE = 200_000;

type Bot = { wallet_address: string; handle: string; strategy_type: string; params: Record<string, unknown>; stake: number; max_per_day: number; active: boolean };
type Pred = { wallet_address: string; battle_id: string; side: string; stake: number; payout: number | null; status: string; created_at: string };
type Row = { bot: Bot; balance: number; pl: number; total: number; open: number; resolved: number; wins: number; staked: number; paidOut: number; recent: Pred[]; lastAt: string | null };

export function BotsPanel({ canWrite }: { canWrite: boolean }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showSpawn, setShowSpawn] = useState(false);

  async function load() {
    setLoading(true); setErr(null);
    try {
      const [{ data: bots }, { data: bals }, { data: preds }] = await Promise.all([
        supabase.from("house_bots").select("wallet_address,handle,strategy_type,params,stake,max_per_day,active").order("handle"),
        supabase.from("fini_balances").select("wallet_address,balance").like("wallet_address", "0xb07%"),
        supabase.from("predictions").select("wallet_address,battle_id,side,stake,payout,status,created_at").like("wallet_address", "0xb07%").order("created_at", { ascending: false }).limit(2000),
      ]);
      const balMap = new Map((bals ?? []).map((b) => [b.wallet_address, b.balance]));
      const byBot = new Map<string, Pred[]>();
      for (const p of preds ?? []) { const a = byBot.get(p.wallet_address) ?? []; a.push(p as Pred); byBot.set(p.wallet_address, a); }
      const out: Row[] = (bots ?? []).map((b) => {
        const ps = byBot.get(b.wallet_address) ?? [];
        const balance = balMap.get(b.wallet_address) ?? 0;
        return {
          bot: b as Bot, balance, pl: balance - STARTING_BALANCE, total: ps.length,
          open: ps.filter((p) => p.status === "open").length,
          resolved: ps.filter((p) => p.status !== "open").length,
          wins: ps.filter((p) => (p.payout || 0) > p.stake).length,
          staked: ps.reduce((s, p) => s + (p.stake || 0), 0),
          paidOut: ps.reduce((s, p) => s + (p.payout || 0), 0),
          recent: ps.slice(0, 10), lastAt: ps[0]?.created_at ?? null,
        };
      });
      out.sort((a, b) => b.pl - a.pl);
      setRows(out);
    } catch (e) { setErr(e instanceof Error ? e.message : "load_failed"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); const t = setInterval(load, 30_000); return () => clearInterval(t); }, []);

  async function act(label: string, fn: () => Promise<unknown>) {
    setBusy(label); setErr(null);
    try { await fn(); await load(); }
    catch (e) { setErr(e instanceof Error ? e.message : "action_failed"); }
    finally { setBusy(null); }
  }

  const totalPL = rows.reduce((s, r) => s + r.pl, 0);
  const activeN = rows.filter((r) => r.bot.active).length;
  const stale = (at: string | null) => at ? (Date.now() - new Date(at).getTime() > 20 * 60_000) : true;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 16 }}>
        <Stat label="Active bots" value={`${activeN}/${rows.length}`} color="#111" />
        <Stat label="Combined P&L" value={fmtPl(totalPL)} color={totalPL >= 0 ? "#16a34a" : "#dc2626"} />
        <Stat label="Open positions" value={rows.reduce((s, r) => s + r.open, 0).toLocaleString()} color="#f59e0b" />
        <Stat label="Predictions" value={rows.reduce((s, r) => s + r.total, 0).toLocaleString()} color="#666" />
      </div>

      <Card title="House bots" right={
        <div style={{ display: "flex", gap: 8 }}>
          <Btn small onClick={load} disabled={loading}>{loading ? "Loading…" : "↻ Refresh"}</Btn>
          {canWrite && <Btn small tone="primary" onClick={() => setShowSpawn((v) => !v)}>+ Spawn bot</Btn>}
        </div>
      }>
        {err && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", padding: 10, borderRadius: 8, marginBottom: 12, fontSize: 13 }}>{err}</div>}
        {showSpawn && canWrite && <SpawnForm onDone={() => { setShowSpawn(false); load(); }} />}

        <div style={{ overflow: "hidden", borderRadius: 12, border: "1px solid #f0f0f0" }}>
          {rows.map((r) => {
            const wr = r.resolved > 0 ? Math.round((r.wins / r.resolved) * 100) : null;
            const isOpen = expanded === r.bot.wallet_address;
            const w = r.bot.wallet_address;
            return (
              <div key={w}>
                <div onClick={() => setExpanded(isOpen ? null : w)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "1px solid #f5f5f5", cursor: "pointer", background: r.bot.active ? "#fff" : "#fbfbfb", opacity: r.bot.active ? 1 : 0.6 }}>
                  <span style={{ width: 14, color: "#bbb", fontSize: 10 }}>{isOpen ? "▼" : "▶"}</span>
                  <div style={{ flex: 2, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, color: "#111", display: "flex", alignItems: "center", gap: 6 }}>
                      {r.bot.handle}
                      {!r.bot.active && <span style={tag("#888")}>paused</span>}
                      {r.bot.active && stale(r.lastAt) && <span style={tag("#f59e0b")} title="No prediction in 20+ min">idle</span>}
                    </div>
                    <div style={{ fontSize: 10, color: "#999", fontFamily: "monospace" }}>{w.slice(0, 8)}…{w.slice(-4)}</div>
                  </div>
                  <div style={{ flex: 2, minWidth: 0, fontSize: 12, color: "#333", fontWeight: 600 }}>{prettyStrategy(r.bot.strategy_type)}</div>
                  <div style={{ flex: 1, textAlign: "right", fontWeight: 700, color: "#111" }}>{r.balance.toLocaleString()}</div>
                  <div style={{ flex: 1, textAlign: "right", fontWeight: 800, color: r.pl >= 0 ? "#16a34a" : "#dc2626" }}>{fmtPl(r.pl)}</div>
                  <div style={{ flex: 0.7, textAlign: "right", color: "#666", fontWeight: 600, fontSize: 12 }}>{r.total}{r.open > 0 && <span style={{ color: "#f59e0b", fontSize: 10 }}> ·{r.open}</span>}</div>
                  <div style={{ flex: 0.6, textAlign: "right", fontWeight: 700, color: wr == null ? "#999" : wr >= 55 ? "#16a34a" : wr <= 45 ? "#dc2626" : "#666" }}>{wr == null ? "—" : `${wr}%`}</div>
                </div>

                {isOpen && (
                  <div style={{ background: "#fafafa", padding: "14px 20px", borderBottom: "1px solid #f0f0f0" }}>
                    <div style={{ fontSize: 12, color: "#555", marginBottom: 10 }}><strong>How it plays:</strong> {STRATEGY_BLURB[r.bot.strategy_type] ?? "Custom."}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8, marginBottom: 12, fontSize: 11 }}>
                      <KV k="Stake / forecast" v={`${r.bot.stake} CUTE$`} />
                      <KV k="Max / day" v={String(r.bot.max_per_day)} />
                      <KV k="Total staked" v={r.staked.toLocaleString()} />
                      <KV k="Net / pred" v={r.resolved > 0 ? `${Math.round(r.pl / r.resolved)}` : "—"} />
                    </div>
                    {canWrite && <BotControls row={r} busy={busy} onAct={act} />}
                    {!canWrite && <div style={{ fontSize: 11, color: "#999", fontStyle: "italic" }}>Connect an admin wallet to control bots.</div>}
                  </div>
                )}
              </div>
            );
          })}
          {rows.length === 0 && !loading && <div style={{ padding: 40, textAlign: "center", color: "#999" }}>No bots found.</div>}
        </div>
      </Card>

      <StrategyRollup rows={rows} />
    </div>
  );
}

function StrategyRollup({ rows }: { rows: Row[] }) {
  const byType = new Map<string, { pl: number; total: number; wins: number; resolved: number; n: number }>();
  for (const r of rows) {
    const t = r.bot.strategy_type;
    const e = byType.get(t) ?? { pl: 0, total: 0, wins: 0, resolved: 0, n: 0 };
    e.pl += r.pl; e.total += r.total; e.wins += r.wins; e.resolved += r.resolved; e.n += 1;
    byType.set(t, e);
  }
  const arr = Array.from(byType.entries()).map(([t, e]) => ({ t, ...e })).sort((a, b) => b.pl - a.pl);
  if (arr.length === 0) return null;
  return (
    <Card title="Strategy rollup — which approach is actually working">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
        {arr.map((s) => {
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
    </Card>
  );
}

function BotControls({ row, busy, onAct }: { row: Row; busy: string | null; onAct: (l: string, f: () => Promise<unknown>) => void }) {
  const w = row.bot.wallet_address;
  const [stake, setStake] = useState(String(row.bot.stake));
  const [maxPerDay, setMaxPerDay] = useState(String(row.bot.max_per_day));
  const dirty = Number(stake) !== row.bot.stake || Number(maxPerDay) !== row.bot.max_per_day;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
      <Btn small tone={row.bot.active ? "default" : "primary"} disabled={busy === `active:${w}`}
        onClick={() => onAct(`active:${w}`, () => api.admin.botSetActive(w, !row.bot.active))}>
        {row.bot.active ? "⏸ Pause" : "▶ Resume"}
      </Btn>
      <span style={{ fontSize: 11, color: "#888" }}>stake</span>
      <input value={stake} onChange={(e) => setStake(e.target.value)} style={inp} />
      <span style={{ fontSize: 11, color: "#888" }}>max/day</span>
      <input value={maxPerDay} onChange={(e) => setMaxPerDay(e.target.value)} style={inp} />
      <Btn small tone="primary" disabled={!dirty || busy === `update:${w}`}
        onClick={() => onAct(`update:${w}`, () => api.admin.botUpdate(w, { stake: Number(stake), maxPerDay: Number(maxPerDay) }))}>
        Save
      </Btn>
      <Btn small tone="danger" disabled={busy === `retire:${w}`}
        onClick={() => { if (confirm(`Retire ${row.bot.handle}? Its balance is swept to the treasury and it stops playing.`)) onAct(`retire:${w}`, () => api.admin.botRetire(w)); }}>
        Retire & sweep
      </Btn>
    </div>
  );
}

function SpawnForm({ onDone }: { onDone: () => void }) {
  const [handle, setHandle] = useState("");
  const [strategyType, setStrategyType] = useState<string>(STRATEGY_TYPES[0]);
  const [stake, setStake] = useState("100");
  const [seed, setSeed] = useState("200000");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function spawn() {
    setBusy(true); setErr(null);
    try { await api.admin.botSpawn({ handle: handle.trim(), strategyType, stake: Number(stake), seed: Number(seed) }); onDone(); }
    catch (e) { setErr(e instanceof Error ? e.message : "spawn_failed"); }
    finally { setBusy(false); }
  }
  return (
    <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 10, padding: 14, marginBottom: 14, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
      <input placeholder="handle e.g. house_falcon" value={handle} onChange={(e) => setHandle(e.target.value)} style={{ ...inp, width: 160 }} />
      <select value={strategyType} onChange={(e) => setStrategyType(e.target.value)} style={{ ...inp, width: 180 }}>
        {STRATEGY_TYPES.map((t) => <option key={t} value={t}>{prettyStrategy(t)}</option>)}
      </select>
      <span style={{ fontSize: 11, color: "#888" }}>stake</span>
      <input value={stake} onChange={(e) => setStake(e.target.value)} style={inp} />
      <span style={{ fontSize: 11, color: "#888" }}>seed CUTE$</span>
      <input value={seed} onChange={(e) => setSeed(e.target.value)} style={{ ...inp, width: 90 }} />
      <Btn small tone="primary" disabled={busy || !handle.trim()} onClick={spawn}>{busy ? "Spawning…" : "Create bot"}</Btn>
      {err && <span style={{ color: "#dc2626", fontSize: 12 }}>{err}</span>}
    </div>
  );
}

const inp: React.CSSProperties = { width: 70, padding: "5px 8px", border: "1px solid #ddd", borderRadius: 6, fontSize: 12, fontWeight: 700 };
const tag = (c: string): React.CSSProperties => ({ fontSize: 9, fontWeight: 800, color: c, background: `${c}1a`, padding: "1px 6px", borderRadius: 100, textTransform: "uppercase", letterSpacing: 0.4 });
