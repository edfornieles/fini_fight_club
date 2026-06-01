import type { Team } from "../game/types";
import { DEATH_MODE_CONFIRM_PHRASE } from "../game/deathMode";
import { FiniAvatar } from "./FiniAvatar";

export function DeathModeModal(props: {
  open: boolean;
  onClose: () => void;
  playerTeam: Team;
  opponentTeam: Team;
  stakeA?: string;
  stakeB?: string;
  confirmedA: boolean;
  confirmedB: boolean;
  confirmInput: string;
  onConfirmInput: (s: string) => void;
  onPickStake: (side: "teamA" | "teamB", finiId: string) => void;
  onConfirm: (side: "teamA" | "teamB") => void;
  onProceed: () => void;
  startError?: string | null;
}) {
  if (!props.open) return null;
  const phraseOk = props.confirmInput.trim() === DEATH_MODE_CONFIRM_PHRASE;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-grape/30 backdrop-blur-sm p-3 overflow-y-auto">
      <div className="kcard p-5 max-w-3xl w-full my-6 !border-coral/50" style={{ boxShadow: "0 0 0 3px rgba(255,138,138,0.4), 0 20px 50px -20px rgba(240,89,90,0.6)" }}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="chip bg-coral/20 text-coral">💀 warning · death mode</div>
            <h2 className="text-2xl font-display font-bold mt-2 text-ink">
              This is not a normal battle.
            </h2>
            <p className="text-ink/70 mt-2 max-w-prose text-sm leading-relaxed font-semibold">
              In Death Mode each side places one Fini at risk. The winner claims the
              loser's staked Fini. In this MVP, transfer is{" "}
              <span className="text-coral font-display font-bold">SIMULATED</span> only —
              your mock ownership ledger updates locally. No mainnet NFT transfer occurs.
              Real Death Mode requires audited escrow.
            </p>
          </div>
          <button onClick={props.onClose} className="kbtn kbtn-ghost text-xs px-3 py-1.5">
            Close
          </button>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 mb-3">
          {(["teamA", "teamB"] as const).map((side) => {
            const team = side === "teamA" ? props.playerTeam : props.opponentTeam;
            const stake = side === "teamA" ? props.stakeA : props.stakeB;
            const confirmed = side === "teamA" ? props.confirmedA : props.confirmedB;
            return (
              <div key={side} className="kcard-soft p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="label-soft">
                    {side === "teamA" ? "Your" : "Opponent"} stake
                  </div>
                  <div className={`chip text-[10px] ${confirmed ? "bg-mint/20 text-mintDark" : "bg-coral/20 text-coral"}`}>
                    {confirmed ? "✓ confirmed" : "unconfirmed"}
                  </div>
                </div>
                <div className="space-y-1.5">
                  {team.finis.map((f) => {
                    const selected = stake === f.id;
                    return (
                      <button
                        key={f.id}
                        onClick={() => props.onPickStake(side, f.id)}
                        className={`w-full text-left rounded-xl px-2 py-1.5 flex items-center gap-2 transition ${
                          selected
                            ? "bg-coral/15 ring-2 ring-coral/60"
                            : "hover:bg-grape/5 ring-1 ring-cloud"
                        }`}
                      >
                        <FiniAvatar family={f.family} mood={selected ? "sad" : "ok"} size={26} />
                        <div className="flex-1 text-xs">
                          <div className="font-display font-bold text-ink">{f.name}</div>
                          <div className="text-[10px] text-inkSoft font-semibold">
                            #{f.tokenId ?? "—"} · Lv {f.level}
                          </div>
                        </div>
                        {selected && (
                          <span className="chip bg-coral/20 text-coral text-[9px]">exposed</span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => props.onConfirm(side)}
                  disabled={!stake || (side === "teamA" && !phraseOk)}
                  className={`mt-3 w-full kbtn py-2 text-xs ${
                    !stake || (side === "teamA" && !phraseOk)
                      ? "kbtn-ghost"
                      : confirmed
                        ? "kbtn-mint"
                        : "kbtn-primary"
                  }`}
                >
                  {confirmed
                    ? "✓ Confirmed"
                    : side === "teamA"
                      ? "Confirm stake"
                      : "Opponent auto-confirm (sim)"}
                </button>
              </div>
            );
          })}
        </div>

        <div className="kcard-soft p-3 mb-3 !bg-coral/8 !border-coral/30">
          <p className="text-sm text-ink font-semibold mb-2">
            Type the phrase below to enable confirmation for your team.
          </p>
          <div className="font-mono text-xs text-coral font-bold mb-2">
            {DEATH_MODE_CONFIRM_PHRASE}
          </div>
          <input
            type="text"
            value={props.confirmInput}
            onChange={(e) => props.onConfirmInput(e.target.value)}
            placeholder="Type here…"
            className="w-full rounded-xl bg-white border-2 border-cloud px-3 py-2 text-sm text-ink focus:outline-none focus:border-coral"
          />
          <div
            className={`mt-2 text-[10px] font-display font-bold tracking-widest ${
              phraseOk ? "text-mintDark" : "text-inkSoft"
            }`}
          >
            {phraseOk ? "✓ phrase accepted" : "awaiting phrase"}
          </div>
        </div>

        {props.startError && (
          <div className="mb-3 kcard-soft px-3 py-2 text-sm text-coral font-semibold !border-coral/40 !bg-coral/10">
            {props.startError}
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row gap-2 justify-end">
          <button onClick={props.onClose} className="kbtn kbtn-ghost px-4 py-2">
            Cancel
          </button>
          <button
            onClick={props.onProceed}
            disabled={!props.confirmedA || !props.confirmedB}
            className="kbtn kbtn-primary px-5 py-2"
          >
            💀 Begin Death Mode
          </button>
        </div>

        <p className="text-[10px] text-inkSoft mt-3 leading-relaxed font-semibold">
          MVP behaviour: this transfer is local only. Real Death Mode requires audited NFT
          escrow, oracle-verified results, explicit both-party signatures, no post-lock
          cancellation, testnet first, and external audit. See{" "}
          <code className="text-grape">src/game/deathMode.ts</code> for extension points.
        </p>
      </div>
    </div>
  );
}
