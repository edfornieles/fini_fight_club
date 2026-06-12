/** Operator console → Economy tab: CUTE$ circulation + tunable levers for both
 * games. Reads live aggregates; writes config through admin-ops. */
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { api, type EconomyConfig } from "../../lib/api";
import { Card, Stat, Btn, fmtCompact } from "./shared";

type Agg = {
  circulation: number; inBots: number; inPlayers: number; players: number;
  openBattles: number; openPool: number; voided: number; treasurySwept: number;
};

type BoolLabels = { on: string; off: string; onTone?: "danger" | "default" };
const FIELDS: { group: "Crypto Arena" | "Fight Club" | "Access"; key: keyof EconomyConfig; label: string; hint: string; bool?: boolean; boolLabels?: BoolLabels }[] = [
  { group: "Crypto Arena", key: "daily_grant", label: "Daily grant", hint: "CUTE$ per daily claim" },
  { group: "Crypto Arena", key: "rescue_amount", label: "Rescue top-up", hint: "amount when nearly broke" },
  { group: "Crypto Arena", key: "rescue_floor", label: "Rescue floor", hint: "below this, rescue unlocks" },
  { group: "Crypto Arena", key: "new_account_seed", label: "New-account seed", hint: "starting balance" },
  { group: "Crypto Arena", key: "arena_fee_pct", label: "House rake %", hint: "fee skimmed off the pool" },
  { group: "Crypto Arena", key: "entry_cutoff_seconds", label: "Entry cutoff (s)", hint: "lock entries N s before end" },
  { group: "Crypto Arena", key: "bots_paused", label: "Pause ALL bots", hint: "global house-bot kill switch", bool: true,
    boolLabels: { on: "PAUSED — click to resume", off: "Active — click to pause", onTone: "danger" } },
  { group: "Access", key: "open_beta", label: "Signups", hint: "who can sign in", bool: true,
    boolLabels: { on: "OPEN — anyone can join (click to lock)", off: "INVITE-ONLY — allowlist (click to open)", onTone: "default" } },
  { group: "Fight Club", key: "fc_daily_cap", label: "Daily cap / player", hint: "max CUTE$ won per day" },
  { group: "Fight Club", key: "fc_treasury_float", label: "Treasury float", hint: "house float backing payouts" },
  { group: "Fight Club", key: "fc_stake_min", label: "Min stake", hint: "" },
  { group: "Fight Club", key: "fc_stake_max", label: "Max stake", hint: "" },
];

export function EconomyPanel({ canWrite }: { canWrite: boolean }) {
  const [agg, setAgg] = useState<Agg | null>(null);
  const [cfg, setCfg] = useState<EconomyConfig | null>(null);
  const [draft, setDraft] = useState<Partial<EconomyConfig>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  async function load() {
    setErr(null);
    try {
      const [{ data: bals }, { data: cfgRow }, openRes, voidRes, { data: pw }] = await Promise.all([
        supabase.from("fini_balances").select("wallet_address,balance"),
        supabase.from("economy_config").select("*").eq("id", 1).maybeSingle(),
        supabase.from("battle_instances").select("total_volume", { count: "exact" }).eq("status", "open"),
        supabase.from("battle_instances").select("id", { count: "exact", head: true }).eq("resolution_status", "voided"),
        supabase.from("project_wallet").select("swept_total").eq("id", 1).maybeSingle(),
      ]);
      let inBots = 0, inPlayers = 0, players = 0;
      for (const b of bals ?? []) {
        const bal = Number(b.balance) || 0;
        if (b.wallet_address.startsWith("0xb07")) inBots += bal;
        else { inPlayers += bal; players += 1; }
      }
      const openPool = (openRes.data ?? []).reduce((s, r) => s + (Number((r as { total_volume: number }).total_volume) || 0), 0);
      setAgg({
        circulation: inBots + inPlayers, inBots, inPlayers, players,
        openBattles: openRes.count ?? 0, openPool, voided: voidRes.count ?? 0,
        treasurySwept: Number(pw?.swept_total) || 0,
      });
      if (cfgRow) { setCfg(cfgRow as EconomyConfig); setDraft({}); }
    } catch (e) { setErr(e instanceof Error ? e.message : "load_failed"); }
  }
  useEffect(() => { load(); const t = setInterval(load, 30_000); return () => clearInterval(t); }, []);

  const merged = { ...(cfg ?? {}), ...draft } as EconomyConfig;
  const dirty = Object.keys(draft).length > 0;
  function setField(k: keyof EconomyConfig, v: number | boolean) { setDraft((d) => ({ ...d, [k]: v })); }
  async function save() {
    setBusy(true); setErr(null);
    try { const r = await api.admin.configSet(draft); setCfg(r.config); setDraft({}); setSavedAt(new Date().toLocaleTimeString()); }
    catch (e) { setErr(e instanceof Error ? e.message : "save_failed"); }
    finally { setBusy(false); }
  }

  return (
    <div>
      {agg && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 16 }}>
            <Stat label="CUTE$ in circulation" value={fmtCompact(agg.circulation)} color="#111" sub={`${fmtCompact(agg.inPlayers)} players · ${fmtCompact(agg.inBots)} bots`} />
            <Stat label="Player wallets funded" value={agg.players.toLocaleString()} color="#7c3aed" />
            <Stat label="Open battles" value={agg.openBattles.toLocaleString()} color="#16a34a" sub={`${fmtCompact(agg.openPool)} CUTE$ at stake`} />
            <Stat label="Voided (refunded)" value={agg.voided.toLocaleString()} color="#f59e0b" />
            <Stat label="Treasury swept" value={fmtCompact(agg.treasurySwept)} color="#0ea5e9" />
          </div>
          {merged.bots_paused && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", padding: 12, borderRadius: 10, marginBottom: 16, fontWeight: 800, fontSize: 13 }}>
              ⛔ All house bots are paused — the arena will go quiet. Re-enable below.
            </div>
          )}
        </>
      )}

      <Card title="Economics — both games" right={
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {savedAt && <span style={{ fontSize: 11, color: "#16a34a" }}>saved {savedAt}</span>}
          {canWrite && <Btn small tone="primary" disabled={!dirty || busy} onClick={save}>{busy ? "Saving…" : dirty ? "Save changes" : "No changes"}</Btn>}
        </div>
      }>
        {err && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", padding: 10, borderRadius: 8, marginBottom: 12, fontSize: 13 }}>{err}</div>}
        {!cfg && <div style={{ color: "#999", fontSize: 13 }}>economy_config not found — apply migration 0010 and deploy admin-ops, then refresh.</div>}
        {cfg && (["Crypto Arena", "Access", "Fight Club"] as const).map((group) => (
          <div key={group} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>{group}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
              {FIELDS.filter((f) => f.group === group).map((f) => (
                <div key={f.key} style={{ border: "1px solid #f0f0f0", borderRadius: 10, padding: "10px 12px", background: "#fafafa" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#333" }}>{f.label}</div>
                  {f.hint && <div style={{ fontSize: 10, color: "#999", marginBottom: 6 }}>{f.hint}</div>}
                  {f.bool ? (
                    <Btn small tone={merged[f.key] && f.boolLabels?.onTone === "danger" ? "danger" : "default"} disabled={!canWrite}
                      onClick={() => setField(f.key, !merged[f.key])}>
                      {merged[f.key] ? (f.boolLabels?.on ?? "On") : (f.boolLabels?.off ?? "Off")}
                    </Btn>
                  ) : (
                    <input type="number" value={String(merged[f.key] ?? "")} disabled={!canWrite}
                      onChange={(e) => setField(f.key, Number(e.target.value))}
                      style={{ width: "100%", padding: "6px 8px", border: "1px solid #ddd", borderRadius: 6, fontSize: 13, fontWeight: 700, background: "#fff" }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        {cfg?.updated_at && <div style={{ fontSize: 11, color: "#aaa", marginTop: 4 }}>Last edited {new Date(cfg.updated_at).toLocaleString()}{cfg.updated_by ? ` by ${cfg.updated_by.slice(0, 10)}…` : ""}</div>}
      </Card>
    </div>
  );
}
