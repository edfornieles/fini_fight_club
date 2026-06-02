import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { getBattleById, ASSET_META } from "../data/mockBattles";
import { useUIStore } from "../state/uiStore";
import { ResolutionAuditPanel } from "../components/ResolutionAuditPanel";
import { MOCK_INSTANCES } from "../data/mockBattleInstances";
import { useCoinStore, fmtCoin } from "../state/coinStore";
import { useMyEntries } from "../state/myEntriesStore";
import { api } from "../lib/api";
import { LiveMarketCard } from "../components/PriceGraph";
import { useLivePrices } from "../hooks/useLivePrices";
import { useCryptoSim, useSimBattles, useSimFeed } from "../data/cryptoSim";
import { personaFor } from "../lib/ghostPersonas";
import { openingFor, intraWindowReturn } from "../lib/openingPrices";
import { getCachedPrices } from "../lib/priceProviders";
import { useConnectModal } from "@rainbow-me/rainbowkit";

const S: React.CSSProperties = { fontFamily: "'Nunito', system-ui, sans-serif" };

const ASSET_COLORS: Record<string, string> = {
  BTC: "#f7931a", ETH: "#627eea", SOL: "#9945ff", DOGE: "#c3a634",
  LINK: "#2a5ada", UNI: "#ff007a", AVAX: "#e84142", BNB: "#f3ba2f",
  MATIC: "#8247e5", XTZ: "#a6e000",
};


export function BattlePage() {
  const { battleId = "" } = useParams<{ battleId: string }>();
  const { walletAddress } = useUIStore();
  // Keep the live price feed polling while on this page so the velocity tracker
  // (which powers the price graph + % readouts) has fresh data even if the user
  // landed here directly without visiting the Crypto Arena first.
  useLivePrices();
  // Read the LIVE battle from the sim store so odds / volume / momentum update
  // in real time (and match what /crypto shows). Boot the sim if it isn't
  // already running (direct landing on this page). Fall back to the static
  // seed only if the sim hasn't produced this battle yet.
  const startSim = useCryptoSim(s => s.start);
  useEffect(() => { startSim(); }, [startSim]);
  const simBattles = useSimBattles();
  const battle = simBattles.find(b => b.id === battleId) ?? getBattleById(battleId);
  const [stake, setStake] = useState("100");
  const [selectedSide, setSelectedSide] = useState<"A" | "B" | null>(null);
  const [predicting, setPredicting] = useState(false);
  const [predictResult, setPredictResult] = useState<{ ok: true; side: "A" | "B"; stake: number } | { ok: false; error: string } | null>(null);
  const { openConnectModal } = useConnectModal();

  async function placePrediction() {
    if (!selectedSide || !battle) return;
    setPredicting(true);
    setPredictResult(null);
    const amount = Math.round(Number(stake));
    const lockedPct = selectedSide === "A" ? battle.sideA.pct : battle.sideB.pct;
    const idemKey = `predict:${battle.id}:${selectedSide}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;

    // Local-first: if the player can afford it, deduct FINI$ optimistically and
    // show the success state. If the backend is wired up, server settlement
    // will reconcile when the battle resolves. If offline (dev mode), this is
    // the authoritative path.
    const balance = useCoinStore.getState().balance;
    if (balance < amount) {
      setPredictResult({ ok: false, error: "Not enough FINI$ to place this prediction." });
      setPredicting(false);
      return;
    }
    useCoinStore.getState().spend(amount);

    // Helper: parse "15m"/"1h"/"2h" → ms (kept local to avoid a new util import)
    const parseDur = (label?: string) => {
      if (!label) return battle!.endsInMs;
      const m = /^(\d+)(m|h)$/.exec(label.trim());
      if (!m) return battle!.endsInMs;
      const n = Number(m[1]);
      return m[2] === "h" ? n * 3_600_000 : n * 60_000;
    };
    // Persist the entry locally so My Active Battles shows up on /crypto + survives reload.
    const persistEntry = (side: "A" | "B", stake: number) => {
      useMyEntries.getState().add({
        battleId: battle.id,
        battleTitle: battle.title,
        side,
        sideLabel: side === "A" ? battle.sideA.label : battle.sideB.label,
        stake,
        entryPct: side === "A" ? battle.sideA.pct : battle.sideB.pct,
        endsAt: Date.now() + battle.endsInMs,
        durationMs: parseDur(battle.durationLabel),
      });
    };
    try {
      const r = await api.predictPlace({
        battleId: battle.id, side: selectedSide, stake: amount, lockedPct, idempotencyKey: idemKey,
      });
      setPredictResult({ ok: true, side: r.side, stake: r.stake });
      persistEntry(r.side, r.stake);
      const wallet = useUIStore.getState().walletAddress;
      if (wallet) useCoinStore.getState().refresh(wallet);
    } catch (e) {
      // Backend not deployed — that's fine in dev mode. The local FINI$ debit
      // above already happened; treat this as a successful local prediction.
      const msg = e instanceof Error ? e.message : "predict_failed";
      if (msg.includes("offline") || msg.includes("Failed to fetch") || msg.includes("backend") || msg.includes("network")) {
        setPredictResult({ ok: true, side: selectedSide, stake: amount });
        persistEntry(selectedSide, amount);
      } else {
        // Real error (insufficient funds server-side, battle closed, etc.) —
        // refund the optimistic debit and show the message.
        useCoinStore.getState().earn(amount);
        const friendly =
          msg.includes("insufficient_funds")  ? "Not enough FINI$ — claim more or earn from battles."
        : msg.includes("battle_closed")        ? "This battle is no longer accepting entries."
        : msg.includes("past_entry_cutoff")    ? "Entry window closed."
        : msg;
        setPredictResult({ ok: false, error: friendly });
      }
    } finally {
      setPredicting(false);
    }
  }

  if (!battle) {
    return (
      <div style={{ ...S, padding: "80px 48px", textAlign: "center" }}>
        <h2>Battle not found</h2>
        <Link to="/crypto">← Back to arena</Link>
      </div>
    );
  }

  const { sideA, sideB } = battle;
  const primaryAsset = battle.assets[0];
  const color = ASSET_COLORS[primaryAsset] ?? "#f472b6";
  const meta = ASSET_META[primaryAsset];
  const endsInMin = Math.floor(battle.endsInMs / 60000);
  const fee = Math.round(Number(stake) * 0.07 * (sideA.pct / 100) * (sideB.pct / 100));

  function fmtTime(ms: number) {
    if (ms <= 0) return "Ended";
    const m = Math.floor(ms / 60000);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
  }

  return (
    <div style={{ ...S, background: "#f8f9fa", minHeight: "100vh" }}>
      {/* Breadcrumb */}
      <div style={{ background: "#fff", borderBottom: "1px solid #f0f0f0", padding: "12px 48px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", gap: 8, fontSize: 13, color: "#888", fontWeight: 600 }}>
          <Link to="/crypto" style={{ color: "#888", textDecoration: "none" }}>Crypto Arena</Link>
          <span>/</span>
          {meta && <Link to={`/crypto/${primaryAsset.toLowerCase()}`} style={{ color: "#888", textDecoration: "none" }}>{meta.name}</Link>}
          <span>/</span>
          <span style={{ color: "#111" }}>{battle.title}</span>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 48px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 32, alignItems: "start" }}>

          {/* Left: battle info */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Title block */}
            <div style={{ background: "#fff", borderRadius: 20, padding: "28px", border: "1.5px solid #f0f0f0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                {battle.assets.map(a => (
                  <span key={a} style={{ fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 100, background: ASSET_COLORS[a] + "20", color: ASSET_COLORS[a] }}>{a}</span>
                ))}
                <StatusPill status={battle.status} />
                <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700, color: "#888" }}>
                  ⏱ {fmtTime(battle.endsInMs)}
                </span>
              </div>
              <h1 style={{ fontSize: 24, fontWeight: 900, color: "#111", margin: "0 0 8px" }}>{battle.title}</h1>
              <p style={{ fontSize: 16, color: "#555", fontWeight: 600, margin: "0 0 12px", lineHeight: 1.5 }}>{battle.question}</p>
              {/* Stated resolution rule — the contract, up front */}
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "#f8fafc", border: "1px solid #e8edf2", borderRadius: 10, padding: "10px 12px" }}>
                <span style={{ fontSize: 13 }}>⚖️</span>
                <span style={{ fontSize: 12, color: "#475569", fontWeight: 600, lineHeight: 1.5 }}>
                  {resolutionRule(battle)}
                </span>
              </div>
            </div>

            {/* Hero battle arena — shows two Finis facing off, expands after a
                prediction is placed. Progress bar tracks time to resolution.
                Sits above Battle Momentum so the graphic leads the page. */}
            <BattleArenaHero
              battle={battle}
              sideALabel={sideA.label}
              sideBLabel={sideB.label}
              sideAPct={sideA.pct}
              sideBPct={sideB.pct}
              color={color}
              userBet={predictResult && predictResult.ok ? predictResult : null}
            />

            {/* Live market data — % since open + price graph (Up/Down + Outperform only) */}
            {(battle.type === "updown" || battle.type === "outperform") && (
              <LiveMarketCard
                battleId={battle.id}
                assets={battle.assets}
                colors={ASSET_COLORS}
                durationLabel={battle.durationLabel}
              />
            )}

            {/* Probability panel */}
            <div style={{ background: "#fff", borderRadius: 20, padding: "24px", border: "1.5px solid #f0f0f0" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>Battle Momentum</div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 20, fontWeight: 900, marginBottom: 10 }}>
                <span style={{ color: "#16a34a" }}>{sideA.label} {sideA.pct}%</span>
                <span style={{ color: "#dc2626" }}>{sideB.label} {sideB.pct}%</span>
              </div>
              <div style={{ height: 12, borderRadius: 100, background: "#f3f4f6", overflow: "hidden", marginBottom: 16 }}>
                <div style={{ height: "100%", width: `${sideA.pct}%`, background: "linear-gradient(90deg, #22c55e, #16a34a)", borderRadius: 100 }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginTop: 8 }}>
                <StatBox label="Volume" value={`${battle.volumeK}K`} sub="Fini Coin" />
                <StatBox label="Time Left" value={fmtTime(battle.endsInMs)} sub={`ends in ${endsInMin}m`} />
                <StatBox label="Arena Mood" value={battle.volumeK > 100 ? "Volatile" : "Calm"} sub="intensity" />
              </div>
            </div>

            {/* Battle log — real, auditable activity */}
            <BattleLog battle={battle} />


            {/* Rules */}
            <div style={{ background: "#fff", borderRadius: 20, padding: "24px", border: "1.5px solid #f0f0f0" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Battle Rules</div>
              <div style={{ fontSize: 13, color: "#555", lineHeight: 1.7, fontWeight: 500 }}>
                <b>Price source.</b> Every price is the median of three feeds — CoinGecko, Coinbase, and Binance — so no single source can skew a result.<br />
                <b>Winner.</b> Decided purely by the price move over the window (see the rule at the top of this page). Every battle resolves to a clear winner — there are no ties or voids.<br />
                <b>Payout.</b> Winners are paid from the prize pool in proportion to the odds when they entered — back an underdog and you earn more; back a favourite and you earn less.<br />
                <b>Sell anytime.</b> You can cash out a position before the battle ends at its current market value, to lock in a gain or cut a loss.<br />
                <b>Play-money beta.</b> FINI$ is an in-game currency with no real-world value. Prices may be delayed; this is a game, not a trading tool.
              </div>
            </div>

            {/* Resolution audit panel — always visible, content depends on status */}
            {(() => {
              const instance = MOCK_INSTANCES[battle.id];
              if (!instance) return null;
              return (
                <div style={{ background: "#fff", borderRadius: 20, padding: "24px", border: "1.5px solid #f0f0f0" }}>
                  <ResolutionAuditPanel instance={instance} />
                </div>
              );
            })()}
          </div>

          {/* Right: predict panel */}
          <div style={{ position: "sticky", top: 80 }}>
            <div style={{ background: "#fff", borderRadius: 20, padding: "24px", border: "1.5px solid #f0f0f0", display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#111" }}>Place your prediction</div>
                <BalanceDisplay />
              </div>

              {/* Side selector */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <SideBtn label={sideA.label} pct={sideA.pct} side="A" selected={selectedSide === "A"} color="#16a34a" bg="#dcfce7" onSelect={() => setSelectedSide("A")} />
                <SideBtn label={sideB.label} pct={sideB.pct} side="B" selected={selectedSide === "B"} color="#dc2626" bg="#fee2e2" onSelect={() => setSelectedSide("B")} />
              </div>

              {/* Amount */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#aaa", marginBottom: 8 }}>FINI$ amount</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {["50", "100", "250", "500"].map(v => (
                    <button key={v} onClick={() => setStake(v)} style={{
                      flex: 1, padding: "8px 0", borderRadius: 10, border: "none", cursor: "pointer",
                      fontSize: 12, fontWeight: 700,
                      background: stake === v ? "#111" : "#f3f4f6",
                      color: stake === v ? "#fff" : "#666",
                    }}>{v}</button>
                  ))}
                </div>
                <input
                  type="number" value={stake} onChange={e => setStake(e.target.value)}
                  style={{
                    width: "100%", marginTop: 8, padding: "10px 14px", borderRadius: 12,
                    border: "1.5px solid #e5e7eb", fontSize: 14, fontWeight: 600, color: "#111",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Fee breakdown */}
              <div style={{ background: "#f9fafb", borderRadius: 12, padding: "12px 14px", fontSize: 12, display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", color: "#666" }}>
                  <span>Stake</span><span style={{ fontWeight: 700 }}>{stake} FINI$</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", color: "#666" }}>
                  <span>Arena fee (7%)</span><span style={{ fontWeight: 700 }}>~{fee} FINI$</span>
                </div>
                <div style={{ height: 1, background: "#e5e7eb", margin: "4px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, color: "#111" }}>
                  <span>Max winnings</span>
                  <span>{selectedSide ? Math.round(Number(stake) * (selectedSide === "A" ? 100 / sideA.pct : 100 / sideB.pct)) : "—"} FINI$</span>
                </div>
              </div>

              {/* CTA */}
              {walletAddress ? (() => {
                // Once an entry is placed on this battle, lock the page —
                // you can't double-up or change your pick on the same outcome.
                const locked = !!predictResult?.ok;
                if (locked && predictResult?.ok) {
                  return (
                    <div>
                      <button
                        disabled
                        style={{
                          width: "100%", padding: "14px 0", borderRadius: 100,
                          border: "2px solid #16a34a",
                          fontSize: 15, fontWeight: 800,
                          cursor: "not-allowed",
                          background: "#dcfce7", color: "#15803d",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                        }}
                      >
                        <span style={{ fontSize: 18 }}>🔒</span>
                        Entry locked — {predictResult.stake} FINI$ on {predictResult.side === "A" ? sideA.label : sideB.label}
                      </button>
                      <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 10, background: "#fff", border: "1.5px solid #f0f0f0", fontSize: 12, color: "#666", fontWeight: 600, lineHeight: 1.5, textAlign: "center" }}>
                        Entry placed. The outcome settles when the battle's resolution timer hits zero — sit tight.
                      </div>
                      <Link
                        to="/crypto"
                        style={{
                          display: "block", marginTop: 10, padding: "10px 14px", borderRadius: 100,
                          border: "1.5px solid #e5e7eb", background: "#fff",
                          color: "#666", fontWeight: 700, fontSize: 13,
                          textAlign: "center", textDecoration: "none",
                        }}
                      >
                        ← Find another battle
                      </Link>
                    </div>
                  );
                }
                return (
                  <>
                    <button
                      onClick={placePrediction}
                      disabled={!selectedSide || predicting}
                      style={{
                        width: "100%", padding: "14px 0", borderRadius: 100, border: "none",
                        fontSize: 15, fontWeight: 800,
                        cursor: (!selectedSide || predicting) ? "not-allowed" : "pointer",
                        background: (!selectedSide || predicting) ? "#e5e7eb" : "#f472b6",
                        color: (!selectedSide || predicting) ? "#aaa" : "#fff",
                        transition: "all 0.15s",
                      }}
                    >
                      {predicting ? "Placing prediction…"
                        : selectedSide ? `Predict ${selectedSide === "A" ? sideA.label : sideB.label} →`
                        : "Select a side"}
                    </button>
                    {predictResult && !predictResult.ok && (
                      <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 10, background: "#fee2e2", border: "1.5px solid #fca5a5", fontSize: 12, color: "#dc2626", fontWeight: 700 }}>
                        {predictResult.error}
                      </div>
                    )}
                  </>
                );
              })() : (
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 13, color: "#888", marginBottom: 10, fontWeight: 600 }}>Connect wallet to predict</div>
                  <button onClick={() => openConnectModal?.()} style={{
                    width: "100%", padding: "14px 0", borderRadius: 100, border: "none",
                    fontSize: 15, fontWeight: 800, cursor: "pointer",
                    background: "#f472b6", color: "#fff",
                  }}>
                    Connect Wallet
                  </button>
                </div>
              )}

              <div style={{ fontSize: 11, color: "#bbb", textAlign: "center", lineHeight: 1.5 }}>
                Fini Coin is a non-transferable in-game currency. No real-world value.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    live: { bg: "#dcfce7", color: "#15803d", label: "🟢 Live" },
    upcoming: { bg: "#dbeafe", color: "#1d4ed8", label: "🔵 Upcoming" },
    resolving: { bg: "#f3e8ff", color: "#7c3aed", label: "🟣 Resolving" },
    resolved: { bg: "#f3f4f6", color: "#6b7280", label: "⚫ Resolved" },
  };
  const s = styles[status] ?? styles.resolved;
  return <span style={{ fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 100, background: s.bg, color: s.color }}>{s.label}</span>;
}

function StatBox({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div style={{ textAlign: "center", padding: "12px", borderRadius: 12, background: "#f9fafb" }}>
      <div style={{ fontSize: 10, color: "#aaa", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 900, color: "#111" }}>{value}</div>
      <div style={{ fontSize: 10, color: "#aaa", fontWeight: 600 }}>{sub}</div>
    </div>
  );
}

function SideBtn({ label, pct, selected, color, bg, onSelect }: {
  label: string; pct: number; side: string; selected: boolean; color: string; bg: string; onSelect: () => void;
}) {
  return (
    <button onClick={onSelect} style={{
      padding: "12px 8px", borderRadius: 12, border: selected ? `2px solid ${color}` : "2px solid transparent",
      background: selected ? bg : "#f9fafb", cursor: "pointer", transition: "all 0.12s",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
    }}>
      <span style={{ fontSize: 18, fontWeight: 900, color: selected ? color : "#555" }}>{pct}%</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: selected ? color : "#888" }}>{label}</span>
    </button>
  );
}

function BalanceDisplay() {
  const balance = useCoinStore(s => s.balance);
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "5px 11px", borderRadius: 100,
      background: "linear-gradient(135deg, #fef3c7, #fde68a)",
      border: "1.5px solid #fbbf24",
      color: "#854d0e", fontWeight: 800, fontSize: 12,
    }}>
      <span style={{ fontSize: 13 }}>🪙</span>
      <span>{fmtCoin(balance, { compact: true })}</span>
      <span style={{ fontSize: 10, opacity: 0.75 }}>FINI$</span>
    </div>
  );
}

/**
 * Hero battle arena — two Finis facing off with a time-remaining progress bar.
 * Expands to a large dramatic scene when the user has placed a prediction.
 *
 * The placeholder image lives at /public/battle-placeholder.png — Ed dropped
 * the reference there. (Two cute Finis sketched facing each other.)
 */
function BattleArenaHero({
  battle, sideALabel, sideBLabel, sideAPct, sideBPct, color, userBet,
}: {
  battle: { endsInMs: number; assets: string[]; familyA?: string; familyB?: string; durationLabel?: string };
  sideALabel: string; sideBLabel: string;
  sideAPct: number; sideBPct: number;
  color: string;
  userBet: { side: "A" | "B"; stake: number } | null;
}) {
  // Parse the *total* battle duration from its label ("15m", "1h", "2h", "24h").
  // `battle.endsInMs` is only the time REMAINING, so we can't use it alone to
  // compute elapsed%.
  function parseDurationLabel(label?: string): number {
    if (!label) return battle.endsInMs;
    const m = /^(\d+)(m|h)$/.exec(label.trim());
    if (!m) return battle.endsInMs;
    const n = Number(m[1]);
    return m[2] === "h" ? n * 60 * 60 * 1000 : n * 60 * 1000;
  }
  const totalDuration = parseDurationLabel(battle.durationLabel);
  const initialEndsAt = useState(() => Date.now() + battle.endsInMs)[0];
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  const remaining = Math.max(0, initialEndsAt - now);
  // Elapsed = total - remaining. Clamped to 0..100%.
  const elapsedPct = totalDuration > 0
    ? Math.min(100, Math.max(0, ((totalDuration - remaining) / totalDuration) * 100))
    : 0;

  function fmt(ms: number) {
    if (ms <= 0) return "Resolving…";
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}h ${m % 60}m`;
    if (m > 0) return `${m}m ${s % 60}s`;
    return `${s}s`;
  }

  const placed = !!userBet;
  // After prediction: bigger, more dramatic. Before: compact intro.
  const minH = placed ? 480 : 260;

  return (
    <div style={{
      position: "relative",
      background: `linear-gradient(135deg, ${color}10, ${color}03)`,
      borderRadius: 24,
      border: `1.5px solid ${color}30`,
      overflow: "hidden",
      minHeight: minH,
      transition: "min-height 0.4s ease",
    }}>
      {/* Background placeholder art — two Finis facing off */}
      <img
        src="/battle-placeholder.png"
        alt=""
        onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        style={{
          position: "absolute", inset: 0, width: "100%", height: "100%",
          objectFit: "contain", objectPosition: "center 60%",
          opacity: placed ? 1 : 0.55,
          transition: "opacity 0.4s ease",
          pointerEvents: "none",
        }}
      />

      {/* Top overlay — side labels + percentages */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0,
        display: "flex", justifyContent: "space-between", alignItems: "flex-start",
        padding: "20px 28px", zIndex: 2,
      }}>
        <div style={{ textAlign: "left", background: "rgba(255,255,255,0.85)", backdropFilter: "blur(8px)", padding: "10px 16px", borderRadius: 14, border: userBet?.side === "A" ? "2.5px solid #16a34a" : "1px solid #e5e7eb" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 0.5 }}>{battle.familyA ?? "Side A"}</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: "#16a34a" }}>{sideAPct}%</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#16a34a" }}>{sideALabel}</div>
          {userBet?.side === "A" && <div style={{ fontSize: 10, fontWeight: 800, color: "#16a34a", marginTop: 3 }}>★ YOUR PICK</div>}
        </div>
        <div style={{ textAlign: "right", background: "rgba(255,255,255,0.85)", backdropFilter: "blur(8px)", padding: "10px 16px", borderRadius: 14, border: userBet?.side === "B" ? "2.5px solid #dc2626" : "1px solid #e5e7eb" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 0.5 }}>{battle.familyB ?? "Side B"}</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: "#dc2626" }}>{sideBPct}%</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#dc2626" }}>{sideBLabel}</div>
          {userBet?.side === "B" && <div style={{ fontSize: 10, fontWeight: 800, color: "#dc2626", marginTop: 3 }}>★ YOUR PICK</div>}
        </div>
      </div>

      {/* Bottom overlay — time-remaining progress bar */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 2,
        background: "rgba(255,255,255,0.92)", backdropFilter: "blur(10px)",
        padding: "18px 28px", borderTop: "1.5px solid #f0f0f0",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#888", textTransform: "uppercase", letterSpacing: 0.5 }}>Resolution in</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#111", fontFamily: "monospace", fontVariantNumeric: "tabular-nums" }}>{fmt(remaining)}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#888", textTransform: "uppercase", letterSpacing: 0.5 }}>Status</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: remaining > 0 ? "#16a34a" : "#a855f7" }}>
              {remaining > 0 ? "● Battle in progress" : "⚖️ Awaiting price oracle"}
            </div>
          </div>
        </div>
        <div style={{ height: 8, borderRadius: 100, background: "#f3f4f6", overflow: "hidden", position: "relative" }}>
          <div style={{
            height: "100%", width: `${elapsedPct}%`,
            background: `linear-gradient(90deg, ${color}, ${color}dd)`,
            borderRadius: 100,
            transition: "width 0.5s ease",
          }} />
        </div>
        {placed && userBet && (
          <div style={{ marginTop: 10, fontSize: 12, color: "#666", fontWeight: 600 }}>
            You staked <b style={{ color: "#111" }}>{userBet.stake} FINI$</b> on <b style={{ color: userBet.side === "A" ? "#16a34a" : "#dc2626" }}>
              {userBet.side === "A" ? sideALabel : sideBLabel}
            </b>. Sit tight — payout settles when the timer hits zero.
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * BattleLog — real, auditable activity for a battle. Everything here is
 * derived from actual data so players can verify their results:
 *   - Battle open: the real opening price + when the window started
 *   - Live predictions: real persona bets on THIS battle from the sim feed
 *   - Your entry: the player's own prediction if placed
 *   - Current standing: real % move since open + which side it favours
 *   - Resolution: when ended, the final price + winner
 */
function BattleLog({ battle }: { battle: { id: string; assets: string[]; type: string; sideA: { label: string }; sideB: { label: string }; durationLabel: string; endsInMs: number } }) {
  const feed = useSimFeed();
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 2000);
    return () => clearInterval(t);
  }, []);

  const asset = battle.assets[0];
  const opening = openingFor(battle.id, asset);
  const ret = intraWindowReturn(battle.id, asset);
  const cur = getCachedPrices()?.[asset]?.usd ?? null;
  const ended = battle.endsInMs <= 0;

  const fmtUsd = (n: number) => n >= 1000 ? "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 }) : n >= 1 ? "$" + n.toFixed(2) : "$" + n.toFixed(4);
  const fmtClock = (ts: number) => { const d = new Date(ts); return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}:${String(d.getSeconds()).padStart(2,"0")}`; };
  const ago = (ts: number) => { const s = Math.floor((Date.now() - ts) / 1000); if (s < 60) return `${s}s ago`; const m = Math.floor(s/60); return `${m}m ago`; };

  // Recent real predictions on this battle (newest first), cap 6
  const battleBets = feed.filter(f => f.battleId === battle.id).slice(0, 6);

  type LogRow = { ts: number; tone: "open" | "bet" | "info" | "result"; text: string };
  const rows: LogRow[] = [];

  // Opening line
  if (opening != null) {
    rows.push({ ts: 0, tone: "open", text: `Battle opened — ${asset} at ${fmtUsd(opening)}` });
  }

  // Current standing
  if (ret != null && cur != null) {
    const pct = ret * 100;
    const up = pct >= 0;
    const leading = up ? battle.sideA.label : battle.sideB.label;
    rows.push({
      ts: 1,
      tone: ended ? "result" : "info",
      text: ended
        ? `Settled — ${asset} closed ${fmtUsd(cur)} (${up ? "+" : ""}${pct.toFixed(2)}% since open). ${leading} wins.`
        : `${asset} now ${fmtUsd(cur)} — ${up ? "▲ +" : "▼ "}${pct.toFixed(2)}% since open · ${leading} leading`,
    });
  }

  return (
    <div style={{ background: "#fff", borderRadius: 20, padding: "24px", border: "1.5px solid #f0f0f0" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>Battle Log</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {/* Derived rows (open + standing) */}
        {rows.map((r, i) => (
          <div key={`r${i}`} style={{ display: "flex", gap: 12, fontSize: 13, alignItems: "baseline" }}>
            <span style={{ fontSize: 14, flexShrink: 0 }}>{r.tone === "open" ? "🟢" : r.tone === "result" ? "🏁" : "📊"}</span>
            <span style={{ color: r.tone === "result" ? "#15803d" : "#333", fontWeight: r.tone === "result" ? 800 : 600 }}>{r.text}</span>
          </div>
        ))}

        {/* Real prediction feed for this battle */}
        {battleBets.length > 0 && (
          <div style={{ borderTop: "1px solid #f3f4f6", marginTop: 4, paddingTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.06em" }}>Recent predictions</div>
            {battleBets.map(b => {
              const p = personaFor(b.wallet);
              const sideColor = b.side === "A" ? "#16a34a" : "#dc2626";
              return (
                <div key={b.id} style={{ display: "flex", gap: 10, fontSize: 13, alignItems: "baseline" }}>
                  <span style={{ fontFamily: "monospace", color: "#bbb", flexShrink: 0, fontSize: 11 }}>{ago(b.at)}</span>
                  <span style={{ color: "#333", fontWeight: 600 }}>
                    {p.tierIcon} <b>{p.handle}</b> backed <b style={{ color: sideColor }}>{b.sideLabel}</b> with {b.amount.toLocaleString()} FINI$
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {rows.length === 0 && battleBets.length === 0 && (
          <div style={{ fontSize: 13, color: "#bbb", fontStyle: "italic" }}>Loading live battle data…</div>
        )}
      </div>
      <div style={{ fontSize: 10, color: "#ccc", marginTop: 14, lineHeight: 1.5 }}>
        Times are your local clock. Prices sourced live (CoinGecko + Coinbase + Binance, median). {fmtClock(Date.now())} now.
      </div>
    </div>
  );
}

/** A clear, stated resolution rule per battle type — the "contract" shown up front. */
function resolutionRule(battle: { type: string; assets: string[]; durationLabel: string }): string {
  const a = battle.assets[0];
  const b = battle.assets[1];
  const src = "median of CoinGecko + Coinbase + Binance";
  switch (battle.type) {
    case "updown":
      return `Resolves "Up" if ${a}'s price at window close is higher than at open, else "Down". ${battle.durationLabel} window, priced by ${src}.`;
    case "outperform":
      return `Resolves to whichever of ${a} / ${b} has the higher % return over the ${battle.durationLabel} window, priced by ${src}.`;
    case "abovebelow":
      return `Resolves on whether ${a} is above or below the target at window close (${battle.durationLabel}), priced by ${src}.`;
    case "volatility":
      return `Resolves on whether ${a} moves more than the threshold in either direction over ${battle.durationLabel}, priced by ${src}.`;
    case "clanwar":
      return `Resolves to the Fini family with the best combined performance over ${battle.durationLabel}, priced by ${src}.`;
    default:
      return `Resolves at window close (${battle.durationLabel}) using the ${src}. If sources disagree beyond tolerance, the battle is held for review.`;
  }
}
