import { useState, useEffect } from "react";
import { useUIStore } from "../state/uiStore";
import { WalletRosterPanel } from "./WalletRosterPanel";
import type { OwnedFini } from "../game/wallet";
import { ownedFinisToBattleFinis } from "../game/wallet";
import {
  traitsToStats,
  getFamilyArchetype,
  countSpecialFinis,
  SPECIAL_PERKS,
  MYTHICAL_PERKS,
} from "../game/attributes";
import { useGameStore } from "../state/gameStore";
import { FAMILY_COLOR } from "./familyColors";

/**
 * Self-contained entry point for the wallet-ownership roster. A floating button
 * opens an overlay with the read-only stable. Kept separate from the run/phase
 * screens so the ownership work doesn't collide with the in-flux UI + store.
 *
 * When the player confirms 3 owned Finis, we currently just surface them; wiring
 * the chosen roster into a real ranked team is the next integration step (after
 * the attributes stream's `traitsToStats()` lands).
 */
export function StableOverlay() {
  const { stableOpen, closeStable } = useUIStore();
  const [open, setOpen] = useState(false);

  // sync with uiStore
  useEffect(() => { if (stableOpen) setOpen(true); }, [stableOpen]);
  const handleClose = () => { setOpen(false); closeStable(); };
  const [picked, setPicked] = useState<OwnedFini[] | null>(null);
  const [wallet, setWallet] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const fieldOwnedTeam = useGameStore((s) => s.fieldOwnedTeam);
  const clearOwnedTeam = useGameStore((s) => s.clearOwnedTeam);
  const savedTeam = useGameStore((s) => s.savedOwnedTeam);

  const battleFinis = picked ? ownedFinisToBattleFinis(picked) : [];
  const specialCount = countSpecialFinis(battleFinis);
  const tooManySpecials = specialCount > 1;

  const enterRanked = () => {
    if (!picked || picked.length === 0) return;
    const err = fieldOwnedTeam(battleFinis, wallet || undefined);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setOpen(false);
    setPicked(null);
  };

  const reEnterSaved = () => {
    if (!savedTeam) return;
    // Re-field the already-built battle Finis directly — no wallet reload.
    fieldOwnedTeam(savedTeam.finis, savedTeam.wallet || undefined);
    setOpen(false);
  };

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-grape/25 backdrop-blur-sm p-3 sm:p-6">
          <div className="w-full max-w-4xl my-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-2xl text-ink drop-shadow-sm">
                The Stable
              </h2>
              <button
                onClick={handleClose}
                className="kbtn kbtn-ghost px-3 py-1.5 text-sm"
              >
                ✕ Close
              </button>
            </div>

            {savedTeam && savedTeam.finis.length > 0 && (
              <div className="kcard p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="label-soft">🏆 Your fielded team</div>
                  {savedTeam.wallet && (
                    <span className="chip bg-grape/15 text-grape text-[10px] font-mono">
                      {savedTeam.wallet.slice(0, 6)}…{savedTeam.wallet.slice(-4)}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {savedTeam.finis.map((f) => (
                    <span key={f.id} className="chip bg-bubble/15 text-bubbleDark text-[11px]">
                      {f.name} · {f.family} #{f.tokenId}
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={reEnterSaved}
                    className="kbtn kbtn-primary flex-1 py-2 text-sm"
                  >
                    ⚔️ Re-enter Ranked
                  </button>
                  <button
                    onClick={clearOwnedTeam}
                    className="kbtn kbtn-ghost px-3 py-2 text-sm"
                    title="Forget this team"
                  >
                    🗑 Forget
                  </button>
                </div>
              </div>
            )}

            <WalletRosterPanel
              onConfirm={(finis, addr) => {
                setPicked(finis);
                setWallet(addr);
                setError(null);
              }}
            />

            {picked && picked.length > 0 && (
              <div className="kcard p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="label-soft">🎀 Your battle team</div>
                  <span className="chip bg-grape/15 text-grape text-[10px]">
                    stats from on-chain traits
                  </span>
                </div>
                <div className="grid sm:grid-cols-3 gap-2">
                  {picked.map((f) => (
                    <StatCard key={f.tokenId} fini={f} />
                  ))}
                </div>
                {(tooManySpecials || error) && (
                  <div className="chip bg-coral/15 text-coral w-full justify-center py-1.5">
                    ⚠️ {error ?? "Only one Special or Mythical Fini per team."}
                  </div>
                )}
                <button
                  onClick={enterRanked}
                  disabled={tooManySpecials}
                  className="kbtn kbtn-primary w-full py-2.5 text-sm disabled:opacity-50"
                >
                  ⚔️ Enter Ranked Battle
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function StatCard(props: { fini: OwnedFini }) {
  const { fini } = props;
  const stats = traitsToStats(fini.traits);
  const color = FAMILY_COLOR[fini.traits.family];
  const archetype = getFamilyArchetype(fini.traits.family);
  const perk = stats.mythicalPerk
    ? MYTHICAL_PERKS[stats.mythicalPerk]
    : stats.specialPerk
      ? SPECIAL_PERKS[stats.specialPerk]
      : null;

  return (
    <div className="kcard-soft p-2.5 space-y-1.5">
      <div className="flex items-center justify-between gap-1">
        <span className={`chip ${color.bg} text-white text-[10px] px-1.5`}>
          {fini.traits.family}
        </span>
        <span className="text-[10px] text-inkSoft font-semibold">{archetype}</span>
      </div>
      <div className="grid grid-cols-4 gap-1 text-center">
        <Stat label="STR" value={stats.strength} />
        <Stat label="HP" value={stats.maxHealth} />
        <Stat label="SPD" value={stats.speed} />
        <Stat label="DEF" value={stats.defense} />
      </div>
      <div className="text-[10px] text-inkSoft font-semibold truncate" title={stats.passiveAbility}>
        ✦ {stats.passiveAbility.replace(/_/g, " ").toLowerCase()}
      </div>
      {perk && (
        <div
          className={`chip text-[10px] ${stats.mythicalPerk ? "bg-lemon/30 text-ink" : "bg-bubble/15 text-bubbleDark"}`}
          title={perk.description}
        >
          {stats.mythicalPerk ? "★ " : "◆ "}
          {perk.displayName}
        </div>
      )}
    </div>
  );
}

function Stat(props: { label: string; value: number }) {
  return (
    <div className="lcd px-1 py-1 leading-none">
      <div className="text-[8px] text-inkSoft">{props.label}</div>
      <div className="text-sm font-display font-bold text-ink">{props.value}</div>
    </div>
  );
}
