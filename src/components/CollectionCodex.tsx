import { useCallback, useEffect, useState } from "react";
import {
  fetchOwnedFini,
  loadOwnershipSnapshot,
  type OwnedFini,
  type OwnershipSnapshot,
} from "../game/wallet";
import {
  traitsToStats,
  getFamilyArchetype,
  familyMatchup,
  SPECIAL_PERKS,
  MYTHICAL_PERKS,
} from "../game/attributes";
import { ALL_COIN_FAMILIES, type CoinFamily } from "../game/types";
import { getFiniRecord, winRate, type FiniRecord } from "../game/finiRecords";
import { FiniMedia } from "./FiniMedia";
import { type FiniMood } from "./FiniAvatar";
import { FAMILY_COLOR } from "./familyColors";

const MAX_TOKEN = 9999;

function moodFromDelta(delta: number): FiniMood {
  if (delta > 0.02) return "happy";
  if (delta >= -0.02) return "ok";
  if (delta > -0.1) return "sad";
  return "ko";
}

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

/** Families this family beats (matchup > 1) / loses to (< 1) when attacking. */
function familyEdges(family: CoinFamily): { strong: CoinFamily[]; weak: CoinFamily[] } {
  const strong: CoinFamily[] = [];
  const weak: CoinFamily[] = [];
  for (const other of ALL_COIN_FAMILIES) {
    if (other === family) continue;
    const m = familyMatchup(family, other);
    if (m > 1.001) strong.push(other);
    else if (m < 0.999) weak.push(other);
  }
  return { strong, weak };
}

/**
 * Collection Codex — search the full 10,000-Fini collection and inspect any
 * one: its trait-derived battle stats, family matchups, owner, live price, and
 * its battle record + level (accumulated locally as Finis fight). Read-only.
 */
export function CollectionCodex() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [tokenId, setTokenId] = useState<number | null>(null);
  const [fini, setFini] = useState<OwnedFini | null>(null);
  const [snapshot, setSnapshot] = useState<OwnershipSnapshot | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || snapshot) return;
    loadOwnershipSnapshot()
      .then(setSnapshot)
      .catch(() => {
        /* owner column degrades gracefully */
      });
  }, [open, snapshot]);

  const lookup = useCallback(async (id: number) => {
    if (!Number.isFinite(id) || id < 0 || id > MAX_TOKEN) {
      setStatus("error");
      setError(`Token must be 0–${MAX_TOKEN}.`);
      return;
    }
    setStatus("loading");
    setError(null);
    setTokenId(id);
    try {
      const owned = await fetchOwnedFini(id);
      setFini(owned);
      setStatus("idle");
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Failed to load this Fini.");
    }
  }, []);

  const submit = () => {
    const id = parseInt(query.trim(), 10);
    lookup(id);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-[4.25rem] right-4 z-40 kbtn kbtn-primary px-4 py-2.5 text-sm shadow-puff"
        title="Browse the full Finiliar collection"
      >
        📖 Codex
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-grape/25 backdrop-blur-sm p-3 sm:p-6">
          <div className="w-full max-w-3xl my-4 space-y-3">
            {/* header */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="font-display font-bold text-2xl text-ink drop-shadow-sm">
                📖 Collection Codex
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="kbtn kbtn-ghost px-3 py-1.5 text-sm"
              >
                ✕ Close
              </button>
            </div>

            {/* search */}
            <div className="kcard p-4 space-y-2">
              <div className="label-soft">🔍 Look up a Fini (#0–{MAX_TOKEN})</div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  inputMode="numeric"
                  placeholder="token id, e.g. 1024"
                  className="flex-1 rounded-2xl border-2 border-cloud bg-white/80 px-3 py-2 text-sm font-mono text-ink outline-none focus:border-grape/60"
                />
                <button onClick={submit} className="kbtn kbtn-primary px-4 py-2 text-sm">
                  Search
                </button>
                <button
                  onClick={() => {
                    const r = Math.floor(Math.random() * (MAX_TOKEN + 1));
                    setQuery(String(r));
                    lookup(r);
                  }}
                  className="kbtn kbtn-grape px-4 py-2 text-sm"
                >
                  🎲 Random
                </button>
              </div>
              {error && <div className="chip bg-coral/15 text-coral">⚠️ {error}</div>}
            </div>

            {status === "loading" && (
              <div className="kcard p-8 text-center text-inkSoft">✨ Summoning #{tokenId}…</div>
            )}

            {fini && status !== "loading" && (
              <CodexDetail
                fini={fini}
                snapshot={snapshot}
                record={getFiniRecord(fini.tokenId)}
                onNav={(d) => {
                  const next = Math.min(MAX_TOKEN, Math.max(0, fini.tokenId + d));
                  setQuery(String(next));
                  lookup(next);
                }}
              />
            )}

            {!fini && status === "idle" && (
              <div className="kcard p-8 text-center text-inkSoft space-y-1">
                <div className="text-4xl">🗂️</div>
                <div className="font-semibold text-ink">Search any of the 10,000 Finis</div>
                <div className="text-[12px]">
                  See stats, family matchups, owner, live price, and battle record.
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function CodexDetail(props: {
  fini: OwnedFini;
  snapshot: OwnershipSnapshot | null;
  record: FiniRecord | null;
  onNav: (delta: number) => void;
}) {
  const { fini, snapshot, record } = props;
  const stats = traitsToStats(fini.traits);
  const color = FAMILY_COLOR[fini.traits.family];
  const archetype = getFamilyArchetype(fini.traits.family);
  const mood = moodFromDelta(fini.latestDelta);
  const edges = familyEdges(fini.traits.family);

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

  return (
    <div className="kcard p-4 space-y-3">
      {/* nav */}
      <div className="flex items-center justify-between">
        <button onClick={() => props.onNav(-1)} className="kbtn kbtn-ghost px-3 py-1.5 text-xs">
          ‹ #{Math.max(0, fini.tokenId - 1)}
        </button>
        <span className="lcd px-3 py-1 text-sm">#{fini.tokenId}</span>
        <button onClick={() => props.onNav(1)} className="kbtn kbtn-ghost px-3 py-1.5 text-xs">
          #{Math.min(MAX_TOKEN, fini.tokenId + 1)} ›
        </button>
      </div>

      <div className="grid sm:grid-cols-[160px_1fr] gap-4">
        {/* art */}
        <div className="space-y-2">
          <div
            className="aspect-square rounded-2xl overflow-hidden flex items-center justify-center"
            style={{ background: fini.artwork.background ?? "#fae3eb" }}
          >
            <FiniMedia artwork={fini.artwork} family={fini.traits.family} mood={mood} animate />
          </div>
          <div className="flex flex-wrap gap-1 justify-center">
            <span className={`chip ${color.bg} text-white text-[10px]`}>{fini.traits.family}</span>
            <span className="chip bg-cloud/70 text-inkSoft text-[10px]">{fini.traits.frequency}</span>
          </div>
        </div>

        {/* facts */}
        <div className="space-y-2.5 min-w-0">
          <div>
            <div className="font-display font-bold text-xl text-ink truncate">{fini.name}</div>
            <div className="text-[12px] text-inkSoft font-semibold">
              {archetype} · {fini.traits.clan}
            </div>
          </div>

          {perk && (
            <div
              className={`chip text-[11px] ${perk.kind === "mythical" ? "bg-lemon/40 text-ink" : "bg-grape/15 text-grape"}`}
              title={perk.def.description}
            >
              {perk.kind === "mythical" ? "★" : "◆"} {perk.def.displayName} — {perk.def.description}
            </div>
          )}

          {/* stats */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
            <StatCell label="STR" value={stats.strength} />
            <StatCell label="HP" value={stats.maxHealth} />
            <StatCell label="SPD" value={stats.speed} />
            <StatCell label="DEF" value={stats.defense} />
            <StatCell label="VOL" value={Math.round(stats.volatilityAffinity * 100)} />
            <StatCell label="CUTE" value={stats.cuteness} />
          </div>
          <div className="text-[11px] text-inkSoft font-semibold">
            ✦ passive: {stats.passiveAbility.replace(/_/g, " ").toLowerCase()}
          </div>

          {/* matchups */}
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
            {edges.strong.length > 0 && (
              <span className="text-mintDark font-semibold">
                ⚔️ strong vs {edges.strong.join(", ")}
              </span>
            )}
            {edges.weak.length > 0 && (
              <span className="text-coral font-semibold">
                🛡 weak vs {edges.weak.join(", ")}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* bottom row: price, owner, record */}
      <div className="grid sm:grid-cols-3 gap-2">
        <Panel label="💹 Live price">
          <div className="font-display font-bold text-lg text-ink">
            {fini.latestPrice ? `$${fini.latestPrice.toLocaleString()}` : "—"}
          </div>
          <div
            className={`text-[12px] font-bold ${flat ? "text-inkSoft" : up ? "text-mintDark" : "text-coral"}`}
          >
            {flat ? "■" : up ? "▲" : "▼"} {deltaPct}%
          </div>
        </Panel>

        <Panel label="👛 Owner">
          {owner ? (
            <>
              <div className="font-mono text-[12px] text-ink truncate" title={owner}>
                {shortAddr(owner)}
              </div>
              <div className="text-[11px] text-inkSoft">holds {ownerHoldings} Fini{ownerHoldings === 1 ? "" : "s"}</div>
            </>
          ) : (
            <div className="text-[12px] text-inkSoft">{snapshot ? "unheld / unknown" : "loading…"}</div>
          )}
        </Panel>

        <Panel label="🏅 Battle record">
          {record && record.battles > 0 ? (
            <>
              <div className="font-display font-bold text-lg text-ink">Lvl {record.level}</div>
              <div className="text-[11px] text-inkSoft">
                {record.wins}W–{record.losses}L · {Math.round(winRate(record) * 100)}% over{" "}
                {record.battles} battle{record.battles === 1 ? "" : "s"}
              </div>
            </>
          ) : (
            <div className="text-[12px] text-inkSoft">Unbattled — no record yet.</div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function StatCell(props: { label: string; value: number }) {
  return (
    <div className="lcd px-1 py-1 text-center leading-none">
      <div className="text-[8px] text-inkSoft">{props.label}</div>
      <div className="text-sm font-display font-bold text-ink">{props.value}</div>
    </div>
  );
}

function Panel(props: { label: string; children: React.ReactNode }) {
  return (
    <div className="kcard-soft p-2.5 space-y-0.5">
      <div className="text-[10px] text-inkSoft font-semibold uppercase tracking-wide">
        {props.label}
      </div>
      {props.children}
    </div>
  );
}
