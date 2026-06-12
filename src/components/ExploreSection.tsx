import { asset } from "../lib/assetUrl";
import { useCallback, useEffect, useRef, useState } from "react";
import { ALL_COIN_FAMILIES, type CoinFamily, type PassiveAbility } from "../game/types";
import { loadTaxonomy, familyView, type TaxonomyDataset, type ClanEntry } from "../game/taxonomy";
import { FAMILY_COLOR } from "./familyColors";
import CLAN_COLORS from "../clanColors.json";
import {
  fetchOwnedFini, loadOwnershipSnapshot,
  type OwnedFini, type OwnershipSnapshot,
} from "../game/wallet";
import {
  traitsToStats, getFamilyArchetype, familyMatchup,
  SPECIAL_PERKS, MYTHICAL_PERKS,
} from "../game/attributes";
import { getFiniRecord, winRate, type FiniRecord } from "../game/finiRecords";
import { Fini3DPreview } from "./Fini3DPreview";
import { PriceSparkline } from "./PriceSparkline";
import { FiniMedia } from "./FiniMedia";
import { moodFromDeltaPct, MOOD_META, fmtUsd, fmtDeltaPct } from "../lib/finiMood";
import { useFamilyDeltas, type TimeWindow } from "../lib/familyDeltas";
import { finiModelUrl } from "../lib/finiAssets";
import type { FiniMood } from "./FiniAvatar";

const MAX_TOKEN = 9999;

const FAMILY_LABEL: Record<CoinFamily, string> = {
  BTC: "Bitcoin", ETH: "Ethereum", SOL: "Solana", DOGE: "Dodge",
  LINK: "Chain link", UNI: "Uniswap", AVAX: "Avalanche",
  BNB: "Binance", MATIC: "Polygon", XTZ: "Tezos",
};
const PASSIVE_LABEL: Record<PassiveAbility, string> = {
  DIAMOND_BODY: "Diamond Body", COMPOUND: "Compound", HIGH_THROUGHPUT: "High Throughput",
  MEME_SPIKE: "Meme Spike", ORACLE: "Oracle", SWAP: "Swap", AVALANCHE: "Avalanche",
  FEE_BURN: "Fee Burn", SCALING: "Scaling", SELF_AMEND: "Self-Amend",
};

const COIN_GLYPH: Record<CoinFamily, string> = {
  BTC: "₿", ETH: "Ξ", SOL: "◎", DOGE: "Ð", LINK: "⬡",
  UNI: "🦄", AVAX: "▲", BNB: "◆", MATIC: "⬟", XTZ: "ꜩ",
};

function slugify(n: string) { return n.toLowerCase().replace(/'/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""); }
function clanGifUrl(name: string) { return asset(`/clan-art/${slugify(name)}.gif`); }
function finiVideoUrl(slug: string, id: string) { return asset(`/clan-finis/${slug}/${id}.mp4`); }
function shortAddr(a: string) { return `${a.slice(0, 6)}...${a.slice(-4)}`; }
function moodFromDelta(delta: number): FiniMood {
  if (delta > 0.02) return "happy";
  if (delta >= -0.02) return "ok";
  if (delta > -0.1) return "sad";
  return "ko";
}

const SPECIALS_PAL = { bg: "#1a1a2e", text: "#ffd700" };
const MYTHICALS_PAL = { bg: "#0d1b2a", text: "#c0a0ff" };

function clanPalette(slug: string, isSpecial?: boolean, isMythical?: boolean) {
  if (isSpecial) return SPECIALS_PAL;
  if (isMythical) return MYTHICALS_PAL;
  const bg = (CLAN_COLORS as Record<string, string>)[slug] ?? "#e8e0d0";
  const hex = bg.replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return { bg, text: brightness < 128 ? "#f0e8d0" : "#2a1f10" };
}

function familyEdges(family: CoinFamily) {
  const strong: CoinFamily[] = [], weak: CoinFamily[] = [];
  for (const other of ALL_COIN_FAMILIES) {
    if (other === family) continue;
    const m = familyMatchup(family, other);
    if (m > 1.001) strong.push(other);
    else if (m < 0.999) weak.push(other);
  }
  return { strong, weak };
}

type VirtualClan = { clan: string; count: number; isSpecial?: boolean; isMythical?: boolean };
const CLANS_PER_PAGE = 4;
const TIME_TABS = ["1D", "1H", "1W", "1M", "1Y"];

export function ExploreSection() {
  const [tab, setTab] = useState<"browse" | "lookup">("browse");

  // Browse state
  const [dataset, setDataset] = useState<TaxonomyDataset | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [manifest, setManifest] = useState<Record<string, string[]> | null>(null);
  const [clanTokens, setClanTokens] = useState<Record<string, string[]> | null>(null);
  const [selectedFamily, setSelectedFamily] = useState<CoinFamily>("BTC");
  const [selectedClanIdx, setSelectedClanIdx] = useState(0);
  const [page, setPage] = useState(0);
  const [finiIdx, setFiniIdx] = useState(0);
  const [timeTab, setTimeTab] = useState("1D");

  // Lookup state
  const [query, setQuery] = useState("");
  const [tokenId, setTokenId] = useState<number | null>(null);
  const [fini, setFini] = useState<OwnedFini | null>(null);
  const [snapshot, setSnapshot] = useState<OwnershipSnapshot | null>(null);
  const [lookupStatus, setLookupStatus] = useState<"idle" | "loading" | "error">("idle");
  const [lookupError, setLookupError] = useState<string | null>(null);

  useEffect(() => {
    if (loaded) return;
    Promise.all([
      loadTaxonomy(),
      fetch(asset("/clan-finis/manifest.json")).then(r => r.json()).catch(() => null),
      fetch(asset("/data/clanTokens.json")).then(r => r.json()).catch(() => null),
    ]).then(([tax, man, ct]) => { setDataset(tax); setManifest(man); setClanTokens(ct); setLoaded(true); });
  }, [loaded]);

  useEffect(() => {
    if (tab !== "lookup" || snapshot) return;
    loadOwnershipSnapshot().then(setSnapshot).catch(() => {});
  }, [tab, snapshot]);

  const handleFamily = (f: CoinFamily) => { setSelectedFamily(f); setSelectedClanIdx(0); setPage(0); setFiniIdx(0); };

  const lookup = useCallback(async (id: number) => {
    if (!Number.isFinite(id) || id < 0 || id > MAX_TOKEN) {
      setLookupStatus("error"); setLookupError(`Token must be 0-${MAX_TOKEN}.`); return;
    }
    setLookupStatus("loading"); setLookupError(null); setTokenId(id);
    try {
      setFini(await fetchOwnedFini(id));
      setLookupStatus("idle");
    } catch (e) {
      setLookupStatus("error");
      setLookupError(e instanceof Error ? e.message : "Failed to load this Fini.");
    }
  }, []);

  const submitLookup = () => { const id = parseInt(query.trim(), 10); lookup(id); };
  const randomLookup = () => { const r = Math.floor(Math.random() * (MAX_TOKEN + 1)); setQuery(String(r)); lookup(r); };

  const view = familyView(selectedFamily, dataset ?? null);
  const allClans: (ClanEntry | VirtualClan)[] = [
    ...view.clans,
    ...(view.specials && view.specials > 0 ? [{ clan: "Specials", count: view.specials, isSpecial: true }] : []),
    ...(view.mythicals && view.mythicals > 0 ? [{ clan: "Mythicals", count: view.mythicals, isMythical: true }] : []),
  ];
  const totalPages = Math.ceil(allClans.length / CLANS_PER_PAGE);
  const paginated = allClans.slice(page * CLANS_PER_PAGE, (page + 1) * CLANS_PER_PAGE);
  const selectedClan = allClans[selectedClanIdx];
  const familyColor = FAMILY_COLOR[selectedFamily].hex;
  const isSpecialClan = (selectedClan as VirtualClan)?.isSpecial;
  const isMythicalClan = (selectedClan as VirtualClan)?.isMythical;
  const clanSlug = isSpecialClan || isMythicalClan ? "special" : selectedClan ? slugify(selectedClan.clan) : "";
  // Full clan roster from the characters_info index (every token, 3D-browsable);
  // the old 6-sample MP4 manifest is the fallback. Specials/Mythicals live under
  // "unknown" in the index (their characters_info has no clan field).
  const tokens: string[] = clanTokens?.[clanSlug]
    ?? (clanSlug === "special" ? clanTokens?.unknown : undefined)
    ?? manifest?.[clanSlug]
    ?? [];
  // MP4s only exist for the manifest samples — the viewer uses them as the
  // load/failure fallback and the clan gif for everything else.
  const videoTokens: string[] = manifest?.[clanSlug] ?? [];

  const S: React.CSSProperties = { fontFamily: "'Nunito', system-ui, sans-serif" };

  return (
    <section id="explore" style={{ ...S, background: "#fff", padding: "80px 56px 64px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 36 }}>
        <div>
          <h2 style={{ fontSize: 42, fontWeight: 800, color: "#111", lineHeight: 1.15, letterSpacing: "-0.5px", margin: 0 }}>
            Track your favorite{" "}
            <span style={{ position: "relative", display: "inline-block" }}>
              <span style={{ position: "relative", zIndex: 1 }}>coins</span>
              <svg aria-hidden style={{ position: "absolute", top: "-10px", left: "-12px", width: "calc(100% + 24px)", height: "calc(100% + 20px)", pointerEvents: "none" }} viewBox="0 0 130 50" preserveAspectRatio="none">
                <ellipse cx="65" cy="25" rx="62" ry="22" fill="none" stroke="#f472b6" strokeWidth="3.5" strokeLinecap="round" />
              </svg>
            </span>
          </h2>
          <p style={{ fontSize: 15, color: "#777", marginTop: 10 }}>
            Finis are emotionally connected to the performance of financial assets.
          </p>
        </div>
        <a href="https://opensea.io/collection/finiliar" target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 14, color: "#f472b6", fontWeight: 700, textDecoration: "none", paddingTop: 8 }}>
          Get a Fini &rarr; View on Opensea
        </a>
      </div>

      {/* Tab switcher */}
      <div style={{ display: "flex", gap: 4, background: "#f3f4f6", borderRadius: 100, padding: 4, width: "fit-content", marginBottom: 40 }}>
        {(["browse", "lookup"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "8px 24px", borderRadius: 100, border: "none", cursor: "pointer",
            fontSize: 14, fontWeight: 700,
            background: tab === t ? "#fff" : "transparent",
            color: tab === t ? "#111" : "#888",
            boxShadow: tab === t ? "0 1px 4px rgba(0,0,0,0.10)" : "none",
            transition: "all 0.15s",
          }}>
            {t === "browse" ? "Browse clans" : "Look up a Fini"}
          </button>
        ))}
      </div>

      {/* Browse tab */}
      {tab === "browse" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, minHeight: 600 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>Select a Family</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {ALL_COIN_FAMILIES.map(f => {
                  const active = f === selectedFamily;
                  return (
                    <button key={f} onClick={() => handleFamily(f)} style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 100,
                      border: active ? "none" : "1.5px solid #e5e7eb",
                      background: active ? "#f472b6" : "#fff", color: active ? "#fff" : "#222",
                      fontWeight: 600, fontSize: 14, cursor: "pointer",
                      boxShadow: active ? "none" : "0 1px 3px rgba(0,0,0,0.06)", transition: "all 0.15s",
                    }}>
                      <span style={{ width: 22, height: 22, borderRadius: "50%", background: active ? "rgba(0,0,0,0.18)" : "#111", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
                        {f.slice(0, 2)}
                      </span>
                      {FAMILY_LABEL[f]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>Select a Clan</p>
              {!loaded ? <p style={{ color: "#bbb", fontSize: 14 }}>Loading...</p> : (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                    {paginated.map((clan, i) => {
                      const absIdx = page * CLANS_PER_PAGE + i;
                      const active = absIdx === selectedClanIdx;
                      const vc = clan as VirtualClan;
                      const cSlug = vc.isSpecial || vc.isMythical ? "special" : slugify(clan.clan);
                      const pal = clanPalette(cSlug, vc.isSpecial, vc.isMythical);
                      return (
                        <button key={clan.clan} onClick={() => { setSelectedClanIdx(absIdx); setFiniIdx(0); }} style={{
                          display: "flex", flexDirection: "column", borderRadius: 16, overflow: "hidden",
                          border: "none", padding: 0, cursor: "pointer",
                          outline: active ? `3px solid ${vc.isSpecial ? "#ffd700" : vc.isMythical ? "#c0a0ff" : familyColor}` : "3px solid transparent",
                          outlineOffset: 2, transition: "all 0.12s", transform: active ? "scale(1.02)" : "scale(1)", background: "transparent",
                        }}>
                          <div style={{ background: pal.bg, height: 100, position: "relative", display: "flex", alignItems: "flex-end", justifyContent: "center", overflow: "hidden", paddingBottom: 4 }}>
                            {vc.isSpecial || vc.isMythical
                              ? <div style={{ fontSize: 32, paddingBottom: 8 }}>{vc.isSpecial ? "S" : "M"}</div>
                              : (() => {
                                  const gif = <img src={clanGifUrl(clan.clan)} alt={clan.clan} style={{ height: 80, width: "auto", objectFit: "contain" }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />;
                                  const thumbToken = manifest?.[cSlug]?.[0];
                                  return thumbToken ? <Fini3DPreview tokenId={thumbToken} fallback={gif} interactive={false} /> : gif;
                                })()
                            }
                          </div>
                          <div style={{ background: "#fff", padding: "6px 4px 8px", textAlign: "center" }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: active ? (vc.isSpecial ? "#b8860b" : vc.isMythical ? "#7c3aed" : familyColor) : "#333", display: "block", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                              {clan.clan}
                            </span>
                            <span style={{ fontSize: 9, color: "#bbb", display: "block" }}>{clan.count} Finis</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16 }}>
                    <NavBtn dir="<" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))} />
                    <NavBtn dir=">" disabled={page >= totalPages - 1} onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} />
                    <span style={{ fontSize: 12, color: "#bbb" }}>{page + 1} / {totalPages}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div>
            {selectedClan && loaded ? (
              <InlineFiniViewer
                clan={selectedClan} familyLabel={FAMILY_LABEL[selectedFamily]}
                familyCode={selectedFamily} familyColor={familyColor}
                tokens={tokens} videoTokens={videoTokens}
                finiIdx={finiIdx} setFiniIdx={setFiniIdx}
                timeTab={timeTab} setTimeTab={setTimeTab}
                passiveLabel={selectedClan && !(selectedClan as VirtualClan).isSpecial && !(selectedClan as VirtualClan).isMythical
                  ? PASSIVE_LABEL[(selectedClan as ClanEntry).passive] : undefined}
              />
            ) : (
              <div style={{ flex: 1, borderRadius: 24, background: `${familyColor}18`, height: 600, display: "flex", alignItems: "center", justifyContent: "center", color: "#ccc" }}>
                {loaded ? "Select a clan" : "Loading..."}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lookup tab */}
      {tab === "lookup" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, minHeight: 600, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>
                Search by token ID (0-{MAX_TOKEN})
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && submitLookup()}
                  inputMode="numeric"
                  placeholder="e.g. 1024"
                  style={{
                    flex: 1, borderRadius: 100, border: "1.5px solid #e5e7eb",
                    background: "#fff", padding: "10px 18px", fontSize: 15, fontFamily: "monospace",
                    color: "#111", outline: "none",
                  }}
                />
                <button onClick={submitLookup} style={{
                  background: "#f472b6", color: "#fff", border: "none", borderRadius: 100,
                  padding: "10px 22px", fontSize: 14, fontWeight: 700, cursor: "pointer",
                }}>Search</button>
                <button onClick={randomLookup} style={{
                  background: "#f3f4f6", color: "#555", border: "none", borderRadius: 100,
                  padding: "10px 18px", fontSize: 20, cursor: "pointer",
                }}>&#x1F3B2;</button>
              </div>
              {lookupError && (
                <p style={{ marginTop: 10, fontSize: 13, color: "#e11d48", fontWeight: 600 }}>Warning: {lookupError}</p>
              )}
            </div>

            {!fini && lookupStatus === "idle" && (
              <div style={{ borderRadius: 20, background: "#f9f9f9", padding: "40px 32px", textAlign: "center", color: "#bbb" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>&#x1F5C2;&#xFE0F;</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#888" }}>Search any of the 10,000 Finis</div>
                <div style={{ fontSize: 13, marginTop: 6 }}>See stats, matchups, owner, price, and battle record.</div>
              </div>
            )}

            {lookupStatus === "loading" && (
              <div style={{ borderRadius: 20, background: "#f9f9f9", padding: "40px 32px", textAlign: "center", color: "#bbb" }}>
                Summoning #{tokenId}...
              </div>
            )}

            {fini && lookupStatus !== "loading" && (
              <CodexStats fini={fini} snapshot={snapshot} record={getFiniRecord(fini.tokenId)} onNav={d => {
                const next = Math.min(MAX_TOKEN, Math.max(0, fini.tokenId + d));
                setQuery(String(next)); lookup(next);
              }} />
            )}
          </div>

          <div>
            {fini && lookupStatus !== "loading" ? (
              <CodexArtwork fini={fini} />
            ) : (
              <div style={{ borderRadius: 24, background: "#f3f4f6", height: 520, display: "flex", alignItems: "center", justifyContent: "center", color: "#ddd" }}>
                <span style={{ fontSize: 48 }}>&#x1F50D;</span>
              </div>
            )}
          </div>
        </div>
      )}

    </section>
  );
}

function CodexStats({ fini, snapshot, record, onNav }: {
  fini: OwnedFini; snapshot: OwnershipSnapshot | null;
  record: FiniRecord | null; onNav: (d: number) => void;
}) {
  const stats = traitsToStats(fini.traits);
  const archetype = getFamilyArchetype(fini.traits.family);
  const edges = familyEdges(fini.traits.family);
  const color = FAMILY_COLOR[fini.traits.family];
  const owner = snapshot?.tokenOwners?.[String(fini.tokenId)] ?? null;
  const ownerHoldings = owner ? snapshot?.byOwner?.[owner]?.length ?? 1 : null;
  const perk = stats.mythicalPerk
    ? { kind: "mythical" as const, def: MYTHICAL_PERKS[stats.mythicalPerk] }
    : stats.specialPerk
      ? { kind: "special" as const, def: SPECIAL_PERKS[stats.specialPerk] }
      : null;
  const up = fini.latestDelta > 0;
  const flat = Math.abs(fini.latestDelta) < 0.0001;
  const deltaPct = Math.abs(fini.latestDelta * 100).toFixed(2);

  const nbStyle: React.CSSProperties = {
    width: 36, height: 36, borderRadius: "50%", border: "1.5px solid #e5e7eb",
    background: "#fff", cursor: "pointer", fontSize: 18, display: "flex",
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => onNav(-1)} style={nbStyle}>&lsaquo;</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 20, color: "#111", lineHeight: 1 }}>{fini.name}</div>
          <div style={{ fontSize: 13, color: "#999", fontWeight: 600, marginTop: 2 }}>
            #{fini.tokenId} &middot; {archetype} &middot; {fini.traits.clan}
          </div>
        </div>
        <button onClick={() => onNav(1)} style={nbStyle}>&rsaquo;</button>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 100, background: color.bg, color: "#fff" }}>
          {fini.traits.family}
        </span>
        <span style={{ fontSize: 12, fontWeight: 600, padding: "4px 12px", borderRadius: 100, background: "#f3f4f6", color: "#666" }}>
          {fini.traits.frequency}
        </span>
        {perk && (
          <span style={{ fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 100, background: perk.kind === "mythical" ? "#fef9c3" : "#f3e8ff", color: perk.kind === "mythical" ? "#854d0e" : "#7c3aed" }}
            title={perk.def.description}>
            {perk.kind === "mythical" ? "Star" : "Gem"} {perk.def.displayName}
          </span>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
        {[
          ["STR", stats.strength], ["HP", stats.maxHealth], ["SPD", stats.speed],
          ["DEF", stats.defense], ["VOL", Math.round(stats.volatilityAffinity * 100)], ["CUTE", stats.cuteness],
        ].map(([label, val]) => (
          <div key={label as string} style={{ textAlign: "center", padding: "8px 4px", borderRadius: 12, border: "1.5px solid #eee" }}>
            <div style={{ fontSize: 9, color: "#aaa", textTransform: "uppercase" }}>{label}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#222" }}>{val}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 11, color: "#aaa", fontWeight: 600 }}>
        passive: {stats.passiveAbility.replace(/_/g, " ").toLowerCase()}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 12 }}>
        {edges.strong.length > 0 && (
          <span style={{ color: "#15803d", fontWeight: 700 }}>strong vs {edges.strong.join(", ")}</span>
        )}
        {edges.weak.length > 0 && (
          <span style={{ color: "#c2410c", fontWeight: 700 }}>weak vs {edges.weak.join(", ")}</span>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <InfoPanel label="Price">
          <div style={{ fontWeight: 800, fontSize: 17, color: "#111" }}>
            {fini.latestPrice ? `$${fini.latestPrice.toLocaleString()}` : "-"}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: flat ? "#aaa" : up ? "#15803d" : "#e11d48" }}>
            {flat ? "flat" : up ? "up" : "down"} {deltaPct}%
          </div>
        </InfoPanel>
        <InfoPanel label="Owner">
          {owner
            ? <><div style={{ fontSize: 12, fontFamily: "monospace", color: "#333" }}>{shortAddr(owner)}</div>
                <div style={{ fontSize: 11, color: "#aaa" }}>holds {ownerHoldings} Finis</div></>
            : <div style={{ fontSize: 12, color: "#aaa" }}>{snapshot ? "unknown" : "loading..."}</div>
          }
        </InfoPanel>
        <InfoPanel label="Battles">
          {record && record.battles > 0
            ? <><div style={{ fontWeight: 800, fontSize: 17, color: "#111" }}>Lvl {record.level}</div>
                <div style={{ fontSize: 11, color: "#aaa" }}>{record.wins}W-{record.losses}L &middot; {Math.round(winRate(record) * 100)}%</div></>
            : <div style={{ fontSize: 12, color: "#aaa" }}>No battles yet</div>
          }
        </InfoPanel>
      </div>
    </div>
  );
}

function CodexArtwork({ fini }: { fini: OwnedFini }) {
  const mood = moodFromDelta(fini.latestDelta);
  const color = FAMILY_COLOR[fini.traits.family];
  return (
    <div style={{
      borderRadius: 24, overflow: "hidden", background: fini.artwork.background ?? "#fae3eb",
      height: 520, display: "flex", alignItems: "center", justifyContent: "center",
      position: "relative",
    }}>
      <FiniMedia artwork={fini.artwork} family={fini.traits.family} mood={mood} animate />
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, padding: "16px 20px",
        background: "rgba(255,255,255,0.75)", backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>{fini.name}</span>
        <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 12px", borderRadius: 100, background: color.bg, color: "#fff" }}>
          {fini.traits.family}
        </span>
      </div>
    </div>
  );
}

function InfoPanel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ borderRadius: 14, background: "#f9f9f9", padding: "10px 12px" }}>
      <div style={{ fontSize: 10, color: "#bbb", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
}

function InlineFiniViewer({ clan, familyLabel, familyCode, familyColor, tokens, videoTokens, finiIdx, setFiniIdx, timeTab, setTimeTab, passiveLabel }: {
  clan: ClanEntry | VirtualClan; familyLabel: string; familyCode: CoinFamily; familyColor: string;
  tokens: string[]; videoTokens?: string[]; finiIdx: number; setFiniIdx: (i: number) => void;
  timeTab: string; setTimeTab: (t: string) => void; passiveLabel?: string;
}) {
  const vc = clan as VirtualClan;
  const isSpecial = vc.isSpecial; const isMythical = vc.isMythical;
  const clanSlug = isSpecial || isMythical ? "special" : slugify(clan.clan);
  const palette = clanPalette(clanSlug, isSpecial, isMythical);
  const token = tokens[finiIdx];
  // MP4 previews only exist for the original manifest samples.
  const videoUrl = token && (videoTokens ?? []).includes(token) ? finiVideoUrl(clanSlug, token) : null;
  const videoRef = useRef<HTMLVideoElement>(null);
  const accentColor = isSpecial ? "#ffd700" : isMythical ? "#c0a0ff" : familyColor;
  const displayName = isSpecial ? "Specials" : isMythical ? "Mythicals" : clan.clan;

  useEffect(() => { videoRef.current?.load(); }, [videoUrl]);

  // Live link to this Fini's currency (the original Finiliar mechanism):
  // api-public.finiliar.com serves latestPrice + latestDelta over the token's
  // Frequency window; mood follows the delta.
  const [live, setLive] = useState<OwnedFini | null>(null);
  useEffect(() => {
    let on = true;
    setLive(null);
    if (!token) return;
    fetchOwnedFini(Number(token)).then(f => { if (on) setLive(f); }).catch(() => {});
    return () => { on = false; };
  }, [token]);
  // The selected time tab drives the displayed % shift AND the Fini's mood.
  // Falls back to the metadata API's own frequency-window delta until the
  // per-timeframe markets feed loads.
  const fam = useFamilyDeltas();
  const tabDelta = fam?.[familyCode]?.[timeTab as TimeWindow];
  const displayDelta = (typeof tabDelta === "number" ? tabDelta : undefined) ?? live?.latestDelta;
  const displayPrice = fam?.[familyCode]?.price ?? live?.latestPrice;
  const mood = displayDelta != null ? moodFromDeltaPct(displayDelta) : undefined;
  const deltaUp = (displayDelta ?? 0) >= 0;

  return (
    <div style={{ borderRadius: 24, overflow: "hidden", background: palette.bg, display: "flex", flexDirection: "column", height: 600 }}>
      <div style={{ padding: "18px 20px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <span style={{ width: 30, height: 30, borderRadius: "50%", background: "#111", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
            {COIN_GLYPH[familyCode] ?? familyCode.slice(0, 1)}
          </span>
          <span style={{ fontSize: 15, fontWeight: 800, color: "#222", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{familyLabel}: {displayName}</span>
        </div>
        {token && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, background: "rgba(255,255,255,0.92)", borderRadius: 14, padding: "8px 14px" }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: "#222" }}>Fini #{token}</span>
              {displayDelta != null && (
                <span title={`${timeTab} change${mood ? ` · ${MOOD_META[mood].label}` : ""}`} style={{ fontSize: 12, fontWeight: 800, color: deltaUp ? "#16a34a" : "#dc2626" }}>
                  {deltaUp ? "↗" : "↘"} {fmtDeltaPct(displayDelta)}
                </span>
              )}
              {displayPrice != null && (
                <span style={{ fontSize: 12, fontWeight: 700, color: "#444" }}>{fmtUsd(displayPrice)}</span>
              )}
            </div>
            <a href={finiModelUrl(token)} download={`fini-${token}.glb`} title="Download 3D model"
              style={{ width: 34, height: 34, borderRadius: 12, background: "rgba(255,255,255,0.92)", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", color: "#222", fontSize: 15, fontWeight: 800 }}>
              ↓
            </a>
          </div>
        )}
      </div>
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {/* Market graph backdrop — the linked coin's recent performance, behind
            the Fini so its mood and its chart read together. */}
        {live?.priceHistory && live.priceHistory.length > 1 && (
          <PriceSparkline prices={live.priceHistory.map(p => p.price)} up={deltaUp} />
        )}
        {(() => {
          // Old media kept as the progressive fallback: it plays while the GLB
          // streams in and stays if WebGL/the model fails.
          const media = videoUrl ? (
            <video ref={videoRef} key={videoUrl} autoPlay loop muted playsInline
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }}>
              <source src={videoUrl} type="video/mp4" />
            </video>
          ) : (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <img src={asset(`/clan-art/${clanSlug}.gif`)} alt={clan.clan} style={{ height: "80%", width: "auto", objectFit: "contain" }} />
            </div>
          );
          return token ? <Fini3DPreview tokenId={token} fallback={media} mood={mood} workout /> : media;
        })()}
      </div>
      <div style={{ padding: "12px 20px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.6)", backdropFilter: "blur(8px)" }}>
        <NavBtn dir="<" disabled={finiIdx === 0 || !tokens.length} onClick={() => setFiniIdx(Math.max(0, finiIdx - 1))} size={36} />
        <div style={{ display: "flex", gap: 4, background: "rgba(0,0,0,0.08)", borderRadius: 100, padding: 3 }}>
          {TIME_TABS.map(t => (
            <button key={t} onClick={() => setTimeTab(t)} style={{
              padding: "5px 12px", borderRadius: 100, border: "none", cursor: "pointer",
              fontSize: 12, fontWeight: 700,
              background: timeTab === t ? accentColor : "transparent",
              color: timeTab === t ? "#fff" : "#666", transition: "all 0.15s",
            }}>{t}</button>
          ))}
        </div>
        <NavBtn dir=">" disabled={finiIdx >= tokens.length - 1 || !tokens.length} onClick={() => setFiniIdx(Math.min(tokens.length - 1, finiIdx + 1))} size={36} />
      </div>
      {tokens.length > 0 && (
        <div style={{ textAlign: "center", paddingBottom: 8, fontSize: 11, color: "rgba(0,0,0,0.35)", fontWeight: 600 }}>
          Fini {finiIdx + 1} of {tokens.length} in clan
          {mood && <> &middot; {MOOD_META[mood].emoji} {MOOD_META[mood].label}</>}
          {passiveLabel && <> &middot; {passiveLabel}</>}
        </div>
      )}
    </div>
  );
}

function NavBtn({ dir, disabled, onClick, size = 32 }: { dir: string; disabled: boolean; onClick: () => void; size?: number }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: size, height: size, borderRadius: "50%", border: "1.5px solid #e5e7eb",
      background: disabled ? "transparent" : "#fff", cursor: disabled ? "default" : "pointer",
      opacity: disabled ? 0.3 : 1, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center",
    }}>{dir}</button>
  );
}
