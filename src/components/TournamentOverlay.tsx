import { useEffect, useMemo, useState } from "react";
import { useUIStore } from "../state/uiStore";
import {
  useTournamentStore,
  championPrize,
  roundName,
  PLAYER_ID,
} from "../state/tournamentStore";
import { ThreeBattleStage as BattleStage } from "./ThreeBattleStage";
import { FAMILY_COLOR } from "./familyColors";
import { useGameStore } from "../state/gameStore";
import { makeSeedSnapshots, teamFromSnapshot } from "../game/pvp";
import { createRng } from "../game/rng";
import type { Team } from "../game/types";
import type { Bracket, BracketMatch } from "../game/tournament";

const TICK_MS = 430;

/** Player's fielded team, or a practice squad so it's playable with no wallet. */
function usePlayerTeam(): Team {
  const saved = useGameStore((s) => s.savedOwnedTeam);
  return useMemo(() => {
    if (saved && saved.finis.length >= 3) {
      return { id: "you", playerId: PLAYER_ID, name: "Your Team", finis: [saved.finis[0], saved.finis[1], saved.finis[2]] };
    }
    const snap = makeSeedSnapshots(createRng(99))[3];
    const t = teamFromSnapshot({ ...snap, name: "Your Team" });
    return { ...t, playerId: PLAYER_ID };
  }, [saved]);
}

export function TournamentOverlay() {
  const [open, setOpen] = useState(false);
  const { tournamentOpen, closeTournament } = useUIStore();
  useEffect(() => { if (tournamentOpen) setOpen(true); }, [tournamentOpen]);
  const handleClose = () => { setOpen(false); closeTournament(); };
  const s = useTournamentStore();
  const team = usePlayerTeam();

  // auto-advance playback while a match is playing
  useEffect(() => {
    if (s.status !== "playing") return;
    const id = setInterval(() => useTournamentStore.getState().tick(), TICK_MS);
    return () => clearInterval(id);
  }, [s.status, s.matchId]);

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-grape/30 backdrop-blur-sm p-3 sm:p-6">
          <div className="w-full max-w-4xl my-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-2xl text-ink drop-shadow-sm">🏟️ Knockout Cup</h2>
              <button onClick={handleClose} className="kbtn kbtn-ghost px-3 py-1.5 text-sm">Close</button>
            </div>

            {s.status === "idle" && (
              <div className="kcard p-6 text-center space-y-3">
                <p className="text-ink font-semibold">8 teams. Single elimination. Quarterfinals → Semifinals → Final.</p>
                <p className="text-[12px] text-inkSoft">Prize pool ${s.prizePool} · champion takes ${championPrize(s.prizePool)}</p>
                <button onClick={() => s.start(team)} className="kbtn kbtn-primary px-6 py-2.5 text-sm">
                  ▶ Enter the Cup
                </button>
              </div>
            )}

            {(s.status === "playing" || s.status === "matchOver") && s.bracket && (
              <MatchStage />
            )}

            {s.status === "champion" && s.champion && (
              <div className="kcard p-6 text-center space-y-3 kglow">
                <div className="text-5xl animate-bobby">🏆</div>
                <div className="font-display font-bold text-2xl text-ink">{s.champion.snapshot.name}</div>
                <div className="text-sm text-inkSoft">
                  Champion of the Knockout Cup · wins <b className="text-sol">${championPrize(s.prizePool)}</b>
                  {s.champion.playerId === PLAYER_ID && " — that's you! 🎉"}
                </div>
                <button onClick={() => s.start(team)} className="kbtn kbtn-grape px-5 py-2 text-sm">↻ New Cup</button>
              </div>
            )}

            {(s.status === "bracket" || s.status === "matchOver" || s.status === "champion") && s.bracket && (
              <BracketView bracket={s.bracket} />
            )}

            {s.status === "bracket" && (
              <div className="flex justify-center">
                <button onClick={() => s.playNext()} className="kbtn kbtn-primary px-6 py-2.5 text-sm shimmer">
                  ▶ Play {nextLabel(s.bracket)}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function nextLabel(bracket: Bracket | null): string {
  if (!bracket) return "match";
  const total = bracket.rounds.length;
  const m = bracket.rounds.flat().find((x) => x.aId && x.bId && !x.winnerId);
  if (!m) return "match";
  return `${roundName(m.round, total)}${bracket.rounds[m.round].length > 1 ? ` ${m.slot + 1}` : ""}`;
}

function MatchStage() {
  const { liveA, liveB, message, floatDmg, status, bracket, matchId } = useTournamentStore();
  const cont = useTournamentStore((st) => st.continueAfterMatch);
  const skip = useTournamentStore((st) => st.skipMatch);
  if (!liveA || !liveB || !bracket) return null;
  const match = bracket.rounds.flat().find((m) => m.id === matchId);
  const total = bracket.rounds.length;

  const hp = (live: typeof liveA) => {
    const f = live.team.finis.find((x) => x.id === live.activeId) ?? live.team.finis[0];
    return Math.round((f.currentHealth / f.maxHealth) * 100);
  };

  return (
    <div className="kcard p-3 space-y-2.5">
      <div className="text-center">
        <span className="chip bg-lemon/40 text-ink font-bold">
          {match ? roundName(match.round, total) : "Match"}
        </span>
      </div>

      {/* score bar */}
      <div className="flex items-center justify-between gap-3">
        <Side live={liveA} align="left" />
        <div className="flex items-center gap-2 font-display font-bold text-2xl text-ink">
          <span className="text-sol">{liveA.score}</span>
          <span className="text-inkSoft text-sm">vs</span>
          <span className="text-bubbleDark">{liveB.score}</span>
        </div>
        <Side live={liveB} align="right" />
      </div>

      {/* stage */}
      <div className="relative">
        <BattleStage
          teamA={liveA.team}
          teamB={liveB.team}
          animA={liveA.anim}
          animB={liveB.anim}
          activeAId={liveA.activeId}
          activeBId={liveB.activeId}
        />
        {floatDmg && (
          <div
            key={floatDmg.key}
            className={`absolute top-8 ${floatDmg.side === "a" ? "left-[20%]" : "right-[20%]"} font-display font-bold text-2xl text-coral animate-bobby drop-shadow`}
          >
            -{floatDmg.amount}
          </div>
        )}
      </div>

      {/* hp bars */}
      <div className="grid grid-cols-2 gap-3">
        <HpBar pct={hp(liveA)} color="#5fd6a4" />
        <HpBar pct={hp(liveB)} color="#ff8fc7" right />
      </div>

      <p className="text-center text-[12px] text-inkSoft min-h-[1.2em]">{message}</p>

      <div className="flex justify-center gap-2">
        {status === "playing" && (
          <button onClick={skip} className="kbtn kbtn-ghost px-4 py-1.5 text-xs">⏭ Skip</button>
        )}
        {status === "matchOver" && (
          <button onClick={cont} className="kbtn kbtn-primary px-5 py-2 text-sm">Continue →</button>
        )}
      </div>
    </div>
  );
}

function Side({ live, align }: { live: { team: Team; score: number }; align: "left" | "right" }) {
  const fam = live.team.finis[0].family;
  return (
    <div className={`flex-1 min-w-0 ${align === "right" ? "text-right" : ""}`}>
      <div className="font-display font-bold text-ink truncate text-sm">{live.team.name}</div>
      <span className={`chip ${FAMILY_COLOR[fam].bg} text-white text-[10px] px-1.5`}>{fam}</span>
    </div>
  );
}

function HpBar({ pct, color, right }: { pct: number; color: string; right?: boolean }) {
  return (
    <div className={`h-2.5 rounded-full bg-cloud/60 overflow-hidden ${right ? "scale-x-[-1]" : ""}`}>
      <div className="h-full rounded-full transition-[width] duration-200" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

function BracketView({ bracket }: { bracket: Bracket }) {
  const total = bracket.rounds.length;
  return (
    <div className="kcard p-3 overflow-x-auto">
      <div className="flex gap-3 min-w-max">
        {bracket.rounds.map((round, r) => (
          <div key={r} className="flex flex-col justify-around gap-2 min-w-[150px]">
            <div className="label-soft text-center">{roundName(r, total)}</div>
            {round.map((m) => (
              <MatchCard key={m.id} bracket={bracket} match={m} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function MatchCard({ bracket, match }: { bracket: Bracket; match: BracketMatch }) {
  const name = (id: string | null) => (id ? bracket.byId[id]?.snapshot.name ?? "—" : "TBD");
  const fam = (id: string | null) => (id && bracket.byId[id] ? bracket.byId[id].snapshot.finis[0].family : null);
  const isPlayer = (id: string | null) => id === PLAYER_ID;
  const row = (id: string | null) => {
    const won = match.winnerId === id;
    const f = fam(id);
    return (
      <div className={`flex items-center gap-1.5 text-[11px] ${won ? "font-bold text-ink" : "text-inkSoft"} ${isPlayer(id) ? "underline decoration-bubble decoration-2" : ""}`}>
        {f && <span className={`w-2 h-2 rounded-full ${FAMILY_COLOR[f].bg}`} />}
        <span className="truncate">{name(id)}</span>
        {won && <span className="ml-auto">✓</span>}
      </div>
    );
  };
  return (
    <div className={`kcard-soft p-2 space-y-1 ${match.winnerId ? "opacity-90" : ""}`}>
      {row(match.aId)}
      <div className="kdivider" />
      {row(match.bId)}
    </div>
  );
}
