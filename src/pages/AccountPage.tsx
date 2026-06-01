import { useState } from "react";
import { useUIStore } from "../state/uiStore";
import { Link } from "react-router-dom";
import { ConnectWalletButton } from "../components/ConnectWalletButton";
import { useWalletRoster } from "../hooks/useWalletRoster";

// CoinFamily symbol → display name used in this page's FAMILY_COLORS map.
const FAMILY_DISPLAY: Record<string, string> = {
  BTC: "Bitcoin", ETH: "Ethereum", SOL: "Solana", DOGE: "Dogecoin",
  LINK: "Chainlink", UNI: "Uniswap", AVAX: "Avalanche",
  BNB: "BNB", MATIC: "Polygon", XTZ: "Tezos",
};

const S = { fontFamily: "'Nunito', system-ui, sans-serif" };

const CLAN_TINTS: Record<string, string> = {
  "Arms of the State": "#b8c8d8", "Hourly": "#c8b4a0", "Townspeople": "#d4cfa0",
  "Artists": "#d4a4a0", "Soldiers": "#b0b0c8", "Twice Daily": "#a8c8d8",
  "Miners": "#b8a890", "Farmers": "#a8b8a0",
};
const FAMILY_COLORS: Record<string, { bg: string; icon: string }> = {
  Bitcoin:   { bg: "#f7931a", icon: "₿" },
  Ethereum:  { bg: "#627eea", icon: "Ξ" },
  Solana:    { bg: "#9945ff", icon: "◎" },
  Dogecoin:  { bg: "#c3a634", icon: "Ð" },
  Chainlink: { bg: "#2a5ada", icon: "🔗" },
  Uniswap:   { bg: "#ff007a", icon: "🦄" },
  Avalanche: { bg: "#e84142", icon: "🏔" },
  BNB:       { bg: "#f3ba2f", icon: "⭕" },
  Polygon:   { bg: "#8247e5", icon: "⬡" },
  Tezos:     { bg: "#a6e000", icon: "🧊" },
};

type Fini = { tokenId: number; family: string; clan: string };

function slugify(s: string) {
  return s.toLowerCase().replace(/'/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export function AccountPage() {
  const { walletAddress } = useUIStore();
  const { roster, loading: rosterLoading, error: rosterError } = useWalletRoster(walletAddress);

  // Adapt OwnedFini → page-local Fini shape (display family name + clan).
  const ALL_FINIS: Fini[] = (roster ?? []).map(f => ({
    tokenId: f.tokenId,
    family: FAMILY_DISPLAY[f.traits.family] ?? f.traits.family,
    clan: f.traits.clan,
  }));

  const [teamName, setTeamName] = useState("My Team");
  const [editingName, setEditingName] = useState(false);
  const [starting, setStarting] = useState<(Fini | null)[]>([null, null, null]);
  const [bench, setBench] = useState<(Fini | null)[]>([null, null, null]);
  // Active slot — user explicitly selected which one to fill next
  const [activeSlot, setActiveSlot] = useState<{ type: "starting" | "bench"; idx: number } | null>({ type: "starting", idx: 0 });

  const allSelected = [...starting, ...bench].filter((f): f is Fini => !!f);

  function findNextEmpty(): { type: "starting" | "bench"; idx: number } | null {
    const si = starting.findIndex(f => f === null);
    if (si !== -1) return { type: "starting", idx: si };
    const bi = bench.findIndex(f => f === null);
    if (bi !== -1) return { type: "bench", idx: bi };
    return null;
  }

  function addFini(fini: Fini) {
    // Already in team? remove from wherever it is
    if (allSelected.find(s => s.tokenId === fini.tokenId)) {
      const sNext = starting.map(f => f?.tokenId === fini.tokenId ? null : f);
      const bNext = bench.map(f => f?.tokenId === fini.tokenId ? null : f);
      setStarting(sNext); setBench(bNext);
      return;
    }
    // Use active slot if set and empty, else next empty
    const target = activeSlot
      && ((activeSlot.type === "starting" && starting[activeSlot.idx] === null)
       || (activeSlot.type === "bench"    && bench[activeSlot.idx]    === null))
      ? activeSlot
      : findNextEmpty();
    if (!target) return;
    if (target.type === "starting") {
      const next = [...starting]; next[target.idx] = fini; setStarting(next);
    } else {
      const next = [...bench]; next[target.idx] = fini; setBench(next);
    }
    // Auto-advance to next empty slot
    const after = (() => {
      const sCopy = target.type === "starting" ? Object.assign([], starting, { [target.idx]: fini }) : starting;
      const bCopy = target.type === "bench"    ? Object.assign([], bench,    { [target.idx]: fini }) : bench;
      const si = sCopy.findIndex((f: Fini | null) => f === null);
      if (si !== -1) return { type: "starting" as const, idx: si };
      const bi = bCopy.findIndex((f: Fini | null) => f === null);
      if (bi !== -1) return { type: "bench" as const, idx: bi };
      return null;
    })();
    setActiveSlot(after);
  }

  function removeFromSlot(type: "starting" | "bench", idx: number) {
    if (type === "starting") { const next = [...starting]; next[idx] = null; setStarting(next); }
    else                     { const next = [...bench];    next[idx] = null; setBench(next); }
    // Active slot becomes the one we just cleared
    setActiveSlot({ type, idx });
  }

  function selectEmptySlot(type: "starting" | "bench", idx: number) {
    setActiveSlot({ type, idx });
  }

  const grouped = ALL_FINIS.reduce<Record<string, Fini[]>>((acc, f) => {
    if (!acc[f.family]) acc[f.family] = [];
    acc[f.family].push(f);
    return acc;
  }, {});

  if (!walletAddress) {
    return (
      <div style={{ ...S, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, background: "#f8f9fa" }}>
        <div style={{ fontSize: 48 }}>🐾</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#111" }}>Connect wallet to view your Stable</div>
        <ConnectWalletButton />
      </div>
    );
  }

  if (rosterLoading) {
    return (
      <div style={{ ...S, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, background: "#f8f9fa" }}>
        <div style={{ fontSize: 38 }}>🔄</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#666" }}>Loading your Finis from the chain…</div>
        <div style={{ fontSize: 11, color: "#aaa", fontFamily: "monospace" }}>{walletAddress}</div>
      </div>
    );
  }

  if (!rosterLoading && ALL_FINIS.length === 0) {
    return (
      <div style={{ ...S, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, background: "#f8f9fa", padding: "0 24px", textAlign: "center" }}>
        <div style={{ fontSize: 48 }}>🐾</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#111" }}>No Finis found in this wallet</div>
        <div style={{ fontSize: 13, color: "#888", maxWidth: 420 }}>
          This wallet doesn't currently hold any Finiliar NFTs. Get one on{" "}
          <a href="https://opensea.io/collection/finiliar" target="_blank" rel="noopener noreferrer" style={{ color: "#f472b6", fontWeight: 700 }}>OpenSea</a> to start building your team.
        </div>
        {rosterError && <div style={{ fontSize: 11, color: "#ef4444" }}>{rosterError}</div>}
      </div>
    );
  }

  const teamFull = starting.every(f => f !== null);
  const benchFull = bench.every(f => f !== null);

  return (
    <div style={{ ...S, background: "#f8f9fa", minHeight: "100vh" }}>
      {/* Page header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #f0f0f0", padding: "32px 48px 28px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 900, color: "#111", margin: 0 }}>🐾 My Stable</h1>
              <div style={{ fontSize: 13, color: "#888", marginTop: 4, fontFamily: "monospace" }}>
                {walletAddress.slice(0, 10)}...{walletAddress.slice(-4)} · {ALL_FINIS.length} Finis
              </div>
            </div>
            {editingName ? (
              <input
                autoFocus value={teamName}
                onChange={e => setTeamName(e.target.value)}
                onBlur={() => setEditingName(false)}
                onKeyDown={e => e.key === "Enter" && setEditingName(false)}
                style={{ fontSize: 18, fontWeight: 800, color: "#111", border: "2px solid #f472b6", borderRadius: 10, padding: "6px 14px", outline: "none", width: 220 }}
              />
            ) : (
              <button onClick={() => setEditingName(true)} style={{ background: "none", border: "1.5px dashed #ddd", borderRadius: 10, padding: "6px 14px", fontSize: 18, fontWeight: 800, color: "#111", cursor: "pointer" }}>
                {teamName} ✏️
              </button>
            )}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 48px", display: "flex", flexDirection: "column", gap: 24 }}>

        {/* Lineup + Bench in a row, slot sizes */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {/* Starting */}
          <Section
            title="Starting Lineup"
            subtitle="3 Finis who enter the arena"
            badge={`${starting.filter(Boolean).length}/3`}
            badgeColor={teamFull ? "#16a34a" : "#aaa"}
          >
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {starting.map((fini, i) => {
                const isActive = activeSlot?.type === "starting" && activeSlot.idx === i;
                return (
                  <TeamSlot key={i} fini={fini} label={`Starter ${i + 1}`}
                    onRemove={() => removeFromSlot("starting", i)}
                    onSelect={() => selectEmptySlot("starting", i)}
                    isActive={isActive}
                  />
                );
              })}
            </div>
          </Section>

          {/* Bench */}
          <Section
            title="Bench"
            subtitle="3 reserves"
            badge={`${bench.filter(Boolean).length}/3`}
            badgeColor={benchFull ? "#16a34a" : "#aaa"}
          >
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {bench.map((fini, i) => {
                const isActive = activeSlot?.type === "bench" && activeSlot.idx === i;
                return (
                  <TeamSlot key={i} fini={fini} label={`Bench ${i + 1}`}
                    onRemove={() => removeFromSlot("bench", i)}
                    onSelect={() => selectEmptySlot("bench", i)}
                    isActive={isActive}
                  />
                );
              })}
            </div>
          </Section>
        </div>

        {/* CTAs */}
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button
            disabled={!teamFull}
            style={{
              background: teamFull ? "#f472b6" : "#e5e7eb",
              color: teamFull ? "#fff" : "#aaa",
              border: "none", borderRadius: 100,
              padding: "13px 32px", fontSize: 15, fontWeight: 800,
              cursor: teamFull ? "pointer" : "not-allowed",
            }}
          >
            Save Team
          </button>
          <button
            disabled={!teamFull}
            style={{
              background: teamFull ? "#fff" : "#f9fafb",
              color: teamFull ? "#666" : "#bbb",
              border: "1.5px solid #e5e7eb", borderRadius: 100,
              padding: "13px 24px", fontSize: 15, fontWeight: 700,
              cursor: teamFull ? "pointer" : "not-allowed",
            }}
          >
            Enter Ranked Battle →
          </button>
        </div>

        {/* Your Collection — full width below */}
        <div style={{ background: "#fff", borderRadius: 20, border: "1.5px solid #f0f0f0", padding: "24px 28px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#111" }}>Your Collection</div>
              <div style={{ fontSize: 12, color: "#aaa", marginTop: 2 }}>Click a Fini to add or remove from your team</div>
            </div>
            <Link to="/claim" style={{ fontSize: 13, color: "#f472b6", fontWeight: 700, textDecoration: "none" }}>
              + Claim Fini Coin →
            </Link>
          </div>

          {Object.entries(grouped).map(([family, finis]) => {
            const meta = FAMILY_COLORS[family] ?? { bg: "#888", icon: "◆" };
            return (
              <div key={family} style={{ marginBottom: 28 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <span style={{ width: 26, height: 26, borderRadius: "50%", background: meta.bg, color: "#fff", fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{meta.icon}</span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: "#111" }}>{family} <span style={{ color: "#bbb", fontWeight: 600 }}>({finis.length})</span></span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 14 }}>
                  {finis.map(f => {
                    const inTeam = !!allSelected.find(s => s.tokenId === f.tokenId);
                    const inStart = starting.find(s => s?.tokenId === f.tokenId);
                    const inBench = bench.find(s => s?.tokenId === f.tokenId);
                    return (
                      <button
                        key={f.tokenId}
                        onClick={() => addFini(f)}
                        style={{
                          borderRadius: 14, overflow: "hidden",
                          border: inTeam ? "2.5px solid #f472b6" : "1.5px solid #f0f0f0",
                          padding: 0, cursor: "pointer", background: "#fff",
                          transition: "transform 0.12s, box-shadow 0.12s",
                          position: "relative",
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 6px 18px rgba(0,0,0,0.10)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = ""; }}
                      >
                        <div style={{ background: CLAN_TINTS[f.clan] ?? "#c8c8d8", height: 110, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                          <img
                            src={`/clan-art/${slugify(f.clan)}.gif`}
                            alt={f.clan}
                            style={{ height: 80, width: "auto", objectFit: "contain" }}
                            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                          {/* Semi-transparent white overlay when in team */}
                          {inTeam && (
                            <div style={{
                              position: "absolute", inset: 0,
                              background: "rgba(255,255,255,0.55)",
                              backdropFilter: "blur(1px)",
                              pointerEvents: "none",
                            }} />
                          )}
                          {inTeam && (
                            <div style={{
                              position: "absolute", top: 6, right: 6,
                              padding: "3px 9px", borderRadius: 100,
                              background: "#f472b6", color: "#fff",
                              fontSize: 10, fontWeight: 800,
                              zIndex: 1,
                            }}>
                              {inStart ? "STARTER" : inBench ? "BENCH" : ""}
                            </div>
                          )}
                        </div>
                        <div style={{ background: inTeam ? "rgba(244,114,182,0.06)" : "rgba(255,255,255,0.7)", padding: "8px 10px", textAlign: "left" }}>
                          <div style={{ fontSize: 12, fontWeight: 800, color: inTeam ? "#aaa" : "#111" }}>Fini #{f.tokenId}</div>
                          <div style={{ fontSize: 10, color: "#888", marginTop: 1 }}>{f.clan}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TeamSlot({ fini, label, onRemove, onSelect, isActive }: {
  fini: Fini | null; label: string;
  onRemove: () => void; onSelect: () => void; isActive?: boolean;
}) {
  if (fini) {
    return (
      <button
        onClick={onRemove}
        title="Click to return to your stable"
        style={{
          borderRadius: 14, overflow: "hidden", border: "1.5px solid #f0f0f0",
          position: "relative", padding: 0, background: "#fff",
          cursor: "pointer", transition: "transform 0.12s, box-shadow 0.12s",
          textAlign: "left", display: "block", width: "100%",
        }}
        onMouseEnter={e => {
          const card = e.currentTarget as HTMLElement;
          card.style.transform = "translateY(-2px)";
          card.style.boxShadow = "0 6px 18px rgba(244,114,182,0.18)";
          const hint = card.querySelector('[data-hint]') as HTMLElement | null;
          if (hint) hint.style.opacity = "1";
        }}
        onMouseLeave={e => {
          const card = e.currentTarget as HTMLElement;
          card.style.transform = "";
          card.style.boxShadow = "";
          const hint = card.querySelector('[data-hint]') as HTMLElement | null;
          if (hint) hint.style.opacity = "0";
        }}
      >
        <div style={{ background: CLAN_TINTS[fini.clan] ?? "#ccc", height: 100, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
          <img src={`/clan-art/${slugify(fini.clan)}.gif`} alt="" style={{ height: 72, objectFit: "contain" }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
          {/* Remove hint */}
          <div data-hint style={{
            position: "absolute", inset: 0,
            background: "rgba(244,114,182,0.85)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontWeight: 800, fontSize: 12,
            opacity: 0, transition: "opacity 0.15s", pointerEvents: "none",
            gap: 6,
          }}>
            ← Return to stable
          </div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.85)", padding: "6px 10px" }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#111" }}>#{fini.tokenId}</div>
          <div style={{ fontSize: 9, color: "#888" }}>{fini.clan}</div>
        </div>
      </button>
    );
  }
  // Empty slot — click to make active
  return (
    <button onClick={onSelect} style={{
      borderRadius: 14,
      border: isActive ? "2.5px solid #f472b6" : "2px dashed #e5e7eb",
      height: 138, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 6,
      background: isActive ? "#fdf0f7" : "#fafafa",
      color: isActive ? "#f472b6" : "#bbb",
      fontWeight: 700, fontSize: 12, cursor: "pointer",
      boxShadow: isActive ? "0 0 0 4px rgba(244,114,182,0.15)" : "none",
      transition: "all 0.15s", width: "100%",
      animation: isActive ? "slot-pulse 1.8s ease-in-out infinite" : "none",
    }}>
      <span style={{ fontSize: 26, opacity: isActive ? 1 : 0.5 }}>{isActive ? "↓" : "+"}</span>
      <span>{label}</span>
      <style>{`@keyframes slot-pulse { 0%,100% { box-shadow: 0 0 0 4px rgba(244,114,182,0.15); } 50% { box-shadow: 0 0 0 8px rgba(244,114,182,0.25); } }`}</style>
    </button>
  );
}

function Section({ title, subtitle, badge, badgeColor, children }: {
  title: string; subtitle: string; badge: string; badgeColor: string; children: React.ReactNode;
}) {
  return (
    <div style={{ background: "#fff", borderRadius: 20, border: "1.5px solid #f0f0f0", padding: "22px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#111" }}>{title}</div>
          <div style={{ fontSize: 12, color: "#aaa", marginTop: 2 }}>{subtitle}</div>
        </div>
        <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 100, background: badgeColor + "20", color: badgeColor }}>
          {badge}
        </span>
      </div>
      {children}
    </div>
  );
}
