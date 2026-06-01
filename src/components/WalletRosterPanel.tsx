import { useCallback, useMemo, useState } from "react";
import type { OwnedFini, OwnershipProvider } from "../game/wallet";
import { normalizeAddress, resolveProvider } from "../game/wallet";
import { traitsToStats, SPECIAL_PERKS, MYTHICAL_PERKS } from "../game/attributes";
import { type FiniMood } from "./FiniAvatar";
import { FiniMedia } from "./FiniMedia";
import { FAMILY_COLOR } from "./familyColors";

const EXAMPLE_WALLET = "0xff3dc70f41c60008ea17b03dcbad843abec43ea3";

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function moodFromDelta(delta: number): FiniMood {
  if (delta > 0.02) return "happy";
  if (delta >= -0.02) return "ok";
  if (delta > -0.1) return "sad";
  return "ko";
}

/**
 * Read-only wallet roster: paste an address, see the Finis it owns (pulled
 * keyless from the prebuilt ownership snapshot + live Finiliar metadata), and
 * pick up to 3. No signing, no transfers — just ownership-gated team building.
 */
export function WalletRosterPanel(props: {
  /** Called when the player confirms a 3-Fini selection. */
  onConfirm?: (finis: OwnedFini[], wallet: string) => void;
  /** Verify each token on-chain (slower; reflects very recent transfers). */
  verifyOnChain?: boolean;
}) {
  const [address, setAddress] = useState(EXAMPLE_WALLET);
  const [roster, setRoster] = useState<OwnedFini[] | null>(null);
  const [loadedAddr, setLoadedAddr] = useState<string | null>(null);
  const [providerId, setProviderId] = useState<OwnershipProvider["id"] | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const valid = useMemo(() => normalizeAddress(address) != null, [address]);

  const load = useCallback(async () => {
    const addr = normalizeAddress(address);
    if (!addr) {
      setStatus("error");
      setError("That doesn't look like a wallet address (0x + 40 hex).");
      return;
    }
    setStatus("loading");
    setError(null);
    setSelected([]);
    setRoster(null);
    try {
      const provider = await resolveProvider({ verifyOnChain: props.verifyOnChain });
      setProviderId(provider.id);
      const finis = await provider.getRoster(addr);
      setRoster(finis);
      setLoadedAddr(addr);
      if (finis.length === 0) {
        setError("No Finis found for this wallet in the current snapshot.");
      }
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Failed to load roster.");
      return;
    }
    setStatus("idle");
  }, [address, props.verifyOnChain]);

  const toggle = useCallback((tokenId: number) => {
    setSelected((prev) => {
      if (prev.includes(tokenId)) return prev.filter((t) => t !== tokenId);
      if (prev.length >= 3) return prev;
      return [...prev, tokenId];
    });
  }, []);

  const confirm = useCallback(() => {
    if (!roster || selected.length !== 3 || !loadedAddr) return;
    const picked = selected
      .map((id) => roster.find((f) => f.tokenId === id))
      .filter((f): f is OwnedFini => !!f);
    props.onConfirm?.(picked, loadedAddr);
  }, [roster, selected, loadedAddr, props]);

  return (
    <div className="kcard p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="label-soft">👛 Your Finiliar Stable</div>
        {providerId && (
          <span className="chip bg-grape/15 text-grape text-[10px]">
            {providerId === "snapshot"
              ? "📸 snapshot"
              : providerId === "live"
                ? "⛓ live"
                : "🎲 demo"}
          </span>
        )}
      </div>

      {/* address entry */}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
          spellCheck={false}
          placeholder="0x… wallet address"
          className="flex-1 rounded-2xl border-2 border-cloud bg-white/80 px-3 py-2 text-sm font-mono text-ink outline-none focus:border-grape/60"
        />
        <button
          onClick={load}
          disabled={!valid || status === "loading"}
          className="kbtn kbtn-primary px-4 py-2 text-sm disabled:opacity-50"
        >
          {status === "loading" ? "✨ Summoning…" : "Load roster"}
        </button>
      </div>

      {error && (
        <div className="chip bg-coral/15 text-coral">⚠️ {error}</div>
      )}

      {/* roster header */}
      {roster && roster.length > 0 && loadedAddr && (
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="text-sm text-inkSoft font-semibold">
            <span className="font-mono text-ink">{shortAddr(loadedAddr)}</span> owns{" "}
            <span className="text-bubbleDark font-display font-bold">{roster.length}</span> Fini
            {roster.length === 1 ? "" : "s"}
          </div>
          <span className="lcd px-3 py-1 text-xs">{selected.length} / 3 chosen</span>
        </div>
      )}

      {/* roster list (Finiliar "Select your fini" split rows) */}
      {roster && roster.length > 0 && (
        <div className="flex flex-col gap-2 max-h-[52vh] overflow-y-auto -mx-1 px-1">
          {roster.map((f) => (
            <FiniSelectRow
              key={f.tokenId}
              fini={f}
              selected={selected.includes(f.tokenId)}
              dimmed={selected.length >= 3 && !selected.includes(f.tokenId)}
              onClick={() => toggle(f.tokenId)}
            />
          ))}
        </div>
      )}

      {/* loading skeleton */}
      {status === "loading" && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-[78px] rounded-2xl bg-cloud/50 animate-pulse"
            />
          ))}
        </div>
      )}

      {/* confirm bar */}
      {roster && roster.length > 0 && props.onConfirm && (
        <div className="flex items-center justify-between pt-1">
          <div className="text-xs text-inkSoft font-semibold">
            {selected.length < 3
              ? `Pick ${3 - selected.length} more to field a team`
              : "Team ready! 🎀"}
          </div>
          <button
            onClick={confirm}
            disabled={selected.length !== 3}
            className="kbtn kbtn-mint px-4 py-2 text-sm disabled:opacity-50"
          >
            Field these 3 ⚔️
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * The Finiliar "Select your fini" row: a split pill with the pastel family
 * tint + coin glyph + name + live delta on the left, and the 3D render in a
 * deeper family swatch on the right. Mirrors the product mockups.
 */
function FiniSelectRow(props: {
  fini: OwnedFini;
  selected: boolean;
  dimmed: boolean;
  onClick: () => void;
}) {
  const { fini, selected, dimmed } = props;
  const color = FAMILY_COLOR[fini.traits.family];
  const mood = moodFromDelta(fini.latestDelta);
  const deltaPct = Math.abs(fini.latestDelta * 100).toFixed(2);
  const up = fini.latestDelta > 0;
  const flat = Math.abs(fini.latestDelta) < 0.0001;

  // Resolve the scarce perk (if any) so we can badge it. Deterministic + cheap.
  const stats = traitsToStats(fini.traits);
  const perk = stats.mythicalPerk
    ? { kind: "mythical" as const, def: MYTHICAL_PERKS[stats.mythicalPerk] }
    : stats.specialPerk
      ? { kind: "special" as const, def: SPECIAL_PERKS[stats.specialPerk] }
      : null;

  const swatchBg = fini.artwork.background ?? color.swatch;

  return (
    <button
      onClick={props.onClick}
      className={`w-full h-[80px] rounded-2xl overflow-hidden flex items-stretch text-left transition-all relative ${
        dimmed ? "opacity-45" : "hover:-translate-y-0.5"
      }`}
      style={{
        boxShadow: selected
          ? "0 0 0 3px #5fd6a4, 0 12px 26px -12px rgba(95,214,164,0.6)"
          : "0 8px 18px -14px rgba(0,0,0,0.35)",
      }}
    >
      {/* left: pastel family panel */}
      <div
        className="flex-1 min-w-0 px-3.5 py-2 flex flex-col justify-center gap-1 leading-tight"
        style={{ background: color.soft }}
      >
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-ink text-white flex items-center justify-center text-[13px] font-bold shrink-0">
            {color.glyph}
          </span>
          <span className="font-display font-bold text-ink text-[15px] truncate">
            {color.label}
          </span>
          {perk && (
            <span
              className={`chip text-[9px] px-1.5 font-bold shrink-0 ${
                perk.kind === "mythical" ? "bg-lemon/90 text-ink" : "bg-grape/85 text-white"
              }`}
              title={`${perk.def.displayName} — ${perk.def.description}`}
            >
              {perk.kind === "mythical" ? "★" : "◆"} {perk.def.displayName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-[11px] min-w-0">
          <span
            className={`font-display font-bold shrink-0 ${
              flat ? "text-inkSoft" : up ? "text-mintDark" : "text-coral"
            }`}
          >
            {flat ? "■" : up ? "▲" : "▼"} {deltaPct}%
          </span>
          <span className="text-inkSoft font-semibold truncate" title={fini.traits.clan}>
            · #{fini.tokenId} · {fini.traits.clan}
          </span>
        </div>
      </div>

      {/* right: render swatch */}
      <div
        className="w-[104px] shrink-0 flex items-center justify-center overflow-hidden relative"
        style={{ background: swatchBg }}
      >
        <FiniMedia
          artwork={fini.artwork}
          family={fini.traits.family}
          mood={mood}
          animate={!dimmed}
        />
        {selected && (
          <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-mint text-white flex items-center justify-center text-[11px] font-bold shadow">
            ✓
          </div>
        )}
      </div>
    </button>
  );
}
