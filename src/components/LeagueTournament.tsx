import { useEffect, useMemo, useRef, useState } from "react";
import { useLeagueStore, money, PLAYER_ID } from "../state/leagueStore";
import { ThreeBattleStage } from "./ThreeBattleStage";
import { BattleLog } from "./BattleLog";
import { FiniBattleCard } from "./FiniBattleCard";
import { deriveLiveTeams, animFromEvent } from "../game/playback";
import { STAGE_LABEL, type Bracket, type BracketMatch } from "../game/bracket";

const PLAYBACK_MS = 650;

type Phase = "intro" | "playing" | "result" | "champion";

/**
 * The watchable League: an 8-team knockout bracket that reveals stage by
 * stage. You watch your own matches play out in the arena; if you're knocked
 * out, you still get to watch the grand Final. Ends on a champion screen.
 */
export function LeagueTournament() {
  const active = useLeagueStore((s) => s.activeTournament);
  const lastResult = useLeagueStore((s) => s.lastResult);
  const close = useLeagueStore((s) => s.closeTournament);

  if (!active) return null;
  return (
    <TournamentInner
      bracket={active.bracket}
      leagueName={
        useLeagueStore.getState().leagues.find((l) => l.config.id === active.leagueId)
          ?.config.name ?? "League"
      }
      onClose={close}
      placement={lastResult?.result}
    />
  );
}

function TournamentInner(props: {
  bracket: Bracket;
  leagueName: string;
  onClose: () => void;
  placement?: { standings: { playerId: string; rank: number }[]; payouts: { playerId: string; amount: number }[] };
}) {
  const { bracket, onClose } = props;
  const rounds = bracket.rounds;

  // Stage the player actually watches: their match this round, else (for the
  // final round) the championship match, else "no feature → auto-advance".
  const matchesByRound = useMemo(() => {
    const out: BracketMatch[][] = [];
    for (let r = 0; r < rounds; r++) out.push(bracket.matches.filter((m) => m.round === r));
    return out;
  }, [bracket, rounds]);

  const featuredFor = (round: number): BracketMatch | null => {
    const ms = matchesByRound[round]?.filter((m) => !m.isBye) ?? [];
    const pm = ms.find((m) => m.aPlayerId === PLAYER_ID || m.bPlayerId === PLAYER_ID);
    if (pm) return pm;
    if (round === rounds - 1) return ms[0] ?? null;
    return null;
  };

  const [stage, setStage] = useState(0);
  const [phase, setPhase] = useState<Phase>("intro");
  const [featuredDone, setFeaturedDone] = useState(false);

  const featured = featuredFor(stage);

  // Intro banner → begin playing (or auto-advance stages with no feature).
  useEffect(() => {
    if (phase !== "intro") return;
    const t = window.setTimeout(() => {
      if (featured) {
        setFeaturedDone(false);
        setPhase("playing");
      } else {
        // No match to watch this stage — reveal & move on.
        advanceStage();
      }
    }, 1100);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, stage]);

  function advanceStage() {
    let next = stage + 1;
    while (next < rounds && !featuredFor(next)) next += 1;
    if (next >= rounds) {
      setPhase("champion");
    } else {
      setStage(next);
      setPhase("intro");
    }
  }

  const championName = bracket.championId ? bracket.nameById[bracket.championId] : "—";
  const playerIsChampion = bracket.championId === PLAYER_ID;
  const myRank = props.placement?.standings.find((s) => s.playerId === PLAYER_ID)?.rank;
  const myWinnings = props.placement?.payouts.find((p) => p.playerId === PLAYER_ID)?.amount ?? 0;

  // Which matches show their winner: earlier rounds, this round's non-featured
  // matches, byes, and the featured match once it has finished playing.
  const isRevealed = (m: BracketMatch): boolean => {
    if (m.isBye) return true;
    if (m.round < stage) return true;
    if (phase === "champion") return true;
    if (m.round === stage) {
      if (featured && m.id === featured.id) return featuredDone;
      return true;
    }
    return false;
  };

  const playerInFeatured =
    !!featured && (featured.aPlayerId === PLAYER_ID || featured.bPlayerId === PLAYER_ID);
  const playerWonFeatured = featured?.winnerPlayerId === PLAYER_ID;

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-grape/30 backdrop-blur-sm p-3 sm:p-6">
      <div className="w-full max-w-5xl mx-auto my-2 space-y-3">
        {/* header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-display font-bold text-2xl text-ink drop-shadow-sm">
            🏆 {props.leagueName} — Tournament
          </h2>
          <button onClick={onClose} className="kbtn kbtn-ghost px-3 py-1.5 text-sm">
            {phase === "champion" ? "✓ Done" : "✕ Skip tournament"}
          </button>
        </div>

        {/* bracket */}
        <BracketView bracket={bracket} isRevealed={isRevealed} currentStage={stage} />

        {/* stage banner */}
        {phase === "intro" && featured && (
          <StageBanner stage={featured.stage} />
        )}

        {/* featured match playback */}
        {phase === "playing" && featured && (
          <FeaturedMatch
            bracket={bracket}
            match={featured}
            onDone={() => {
              setFeaturedDone(true);
              setPhase("result");
            }}
          />
        )}

        {/* stage result → continue */}
        {phase === "result" && featured && (
          <div className="kcard p-5 text-center space-y-3">
            <div className="text-2xl font-display font-bold">
              {playerInFeatured ? (
                playerWonFeatured ? (
                  <span className="text-mintDark">
                    {featured.stage === "FINAL" ? "🏆 You are the CHAMPION!" : "💚 You advance!"}
                  </span>
                ) : (
                  <span className="text-coral">💔 Knocked out</span>
                )
              ) : (
                <span className="text-ink">
                  {bracket.nameById[featured.winnerPlayerId!]} take the {STAGE_LABEL[featured.stage]}!
                </span>
              )}
            </div>
            <button onClick={advanceStage} className="kbtn kbtn-primary px-6 py-2.5 text-sm">
              {featured.stage === "FINAL" ? "See final standings →" : "Continue →"}
            </button>
          </div>
        )}

        {/* champion screen */}
        {phase === "champion" && (
          <ChampionScreen
            championName={championName ?? "—"}
            playerIsChampion={playerIsChampion}
            myRank={myRank}
            myWinnings={myWinnings}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}

function StageBanner(props: { stage: BracketMatch["stage"] }) {
  return (
    <div className="kcard p-6 text-center animate-pulse">
      <div className="label-soft">now entering</div>
      <div className="font-display font-bold text-3xl text-grape drop-shadow-sm mt-1">
        {props.stage === "FINAL" ? "🏆 THE FINAL" : `⚔️ ${STAGE_LABEL[props.stage].toUpperCase()}`}
      </div>
    </div>
  );
}

function FeaturedMatch(props: {
  bracket: Bracket;
  match: BracketMatch;
  onDone: () => void;
}) {
  const { bracket, match } = props;
  const teamA = bracket.teamsById[match.aPlayerId!]!;
  const teamB = bracket.teamsById[match.bPlayerId!]!;
  const events = match.events;

  const [index, setIndex] = useState(0);
  const [autoplay, setAutoplay] = useState(true);
  const doneRef = useRef(false);

  // Reset when the match changes.
  useEffect(() => {
    setIndex(0);
    setAutoplay(true);
    doneRef.current = false;
  }, [match.id]);

  useEffect(() => {
    if (!autoplay) return;
    if (index >= events.length) return;
    const t = window.setTimeout(() => setIndex((i) => Math.min(events.length, i + 1)), PLAYBACK_MS);
    return () => clearTimeout(t);
  }, [autoplay, index, events.length]);

  useEffect(() => {
    if (index >= events.length && !doneRef.current) {
      doneRef.current = true;
      const t = window.setTimeout(() => props.onDone(), 600);
      return () => clearTimeout(t);
    }
  }, [index, events.length, props]);

  const { liveA, liveB } = deriveLiveTeams(teamA, teamB, events, index);
  const { animA, animB } = animFromEvent(events[index - 1], liveA);
  const activeA = liveA.finis.find((f) => !f.fainted && f.currentHealth > 0);
  const activeB = liveB.finis.find((f) => !f.fainted && f.currentHealth > 0);

  const aIsPlayer = match.aPlayerId === PLAYER_ID;
  const bIsPlayer = match.bPlayerId === PLAYER_ID;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center gap-3 text-sm font-display font-bold">
        <span className={aIsPlayer ? "text-mintDark" : "text-ink"}>{match.aName}</span>
        <span className="chip bg-coral/15 text-coral text-[11px]">VS</span>
        <span className={bIsPlayer ? "text-mintDark" : "text-ink"}>{match.bName}</span>
      </div>

      <ThreeBattleStage
        teamA={liveA}
        teamB={liveB}
        animA={animA}
        animB={animB}
        activeAId={activeA?.id}
        activeBId={activeB?.id}
      />

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <div className="label-soft">{match.aName}{aIsPlayer ? " (you)" : ""}</div>
          {liveA.finis.map((f) => (
            <FiniBattleCard key={f.id} fini={f} active={f.id === activeA?.id} compact />
          ))}
        </div>
        <div className="space-y-1.5">
          <div className="label-soft">{match.bName}{bIsPlayer ? " (you)" : ""}</div>
          {liveB.finis.map((f) => (
            <FiniBattleCard key={f.id} fini={f} active={f.id === activeB?.id} compact />
          ))}
        </div>
      </div>

      <div className="kcard p-3 flex flex-wrap gap-2 items-center">
        <button onClick={() => setAutoplay((a) => !a)} className="kbtn kbtn-ghost px-4 py-2 text-sm">
          {autoplay ? "⏸ Pause" : "▶ Resume"}
        </button>
        <button
          onClick={() => setIndex((i) => Math.min(events.length, i + 1))}
          className="kbtn kbtn-ghost px-4 py-2 text-sm"
        >
          👣 Step
        </button>
        <button onClick={() => setIndex(events.length)} className="kbtn kbtn-grape px-4 py-2 text-sm">
          ⏭ Skip
        </button>
        <span className="ml-auto lcd px-3 py-1 text-xs">
          {Math.min(index, events.length)} / {events.length}
        </span>
      </div>

      <BattleLog events={events} visibleCount={index} />
    </div>
  );
}

function BracketView(props: {
  bracket: Bracket;
  isRevealed: (m: BracketMatch) => boolean;
  currentStage: number;
}) {
  const { bracket } = props;
  const rounds = Array.from({ length: bracket.rounds }, (_, r) =>
    bracket.matches.filter((m) => m.round === r),
  );

  return (
    <div className="kcard p-3 overflow-x-auto">
      <div className="flex gap-3 min-w-[640px]">
        {rounds.map((ms, r) => (
          <div key={r} className="flex-1 flex flex-col justify-around gap-2">
            <div className="label-soft text-center text-[10px]">
              {STAGE_LABEL[ms[0]?.stage ?? "QUARTER"]}
            </div>
            {ms.map((m) => (
              <MiniMatch
                key={m.id}
                match={m}
                revealed={props.isRevealed(m)}
                live={r === props.currentStage}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniMatch(props: { match: BracketMatch; revealed: boolean; live: boolean }) {
  const { match, revealed, live } = props;
  const row = (pid: string | null, name: string | null, survivors: number) => {
    const isWinner = revealed && match.winnerPlayerId === pid;
    const isLoser = revealed && match.winnerPlayerId && match.winnerPlayerId !== pid && pid;
    const isYou = pid === PLAYER_ID;
    return (
      <div
        className={`flex items-center justify-between px-2 py-1 rounded-md text-[11px] ${
          isWinner ? "bg-mint/25 font-bold text-mintDark" : isLoser ? "opacity-40 line-through" : ""
        }`}
      >
        <span className="truncate">
          {isYou ? "★ " : ""}
          {name ?? "—"}
        </span>
        {isWinner && <span className="text-[10px]">✓ {survivors}♥</span>}
      </div>
    );
  };
  return (
    <div
      className={`rounded-lg border bg-white/50 ${
        live ? "border-grape/60 ring-1 ring-grape/30" : "border-cloud/70"
      } ${match.aPlayerId === PLAYER_ID || match.bPlayerId === PLAYER_ID ? "shadow-puff" : ""}`}
    >
      {row(match.aPlayerId, match.aName, match.aSurvivors)}
      <div className="h-px bg-cloud/70 mx-2" />
      {row(match.bPlayerId, match.bName, match.bSurvivors)}
    </div>
  );
}

function ChampionScreen(props: {
  championName: string;
  playerIsChampion: boolean;
  myRank?: number;
  myWinnings: number;
  onClose: () => void;
}) {
  const confetti = ["🎉", "✨", "🏆", "🎊", "💖", "⭐"];
  return (
    <div className="kcard p-8 text-center space-y-4 relative overflow-hidden">
      {/* confetti */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 24 }).map((_, i) => (
          <span
            key={i}
            className="absolute animate-bounce text-xl"
            style={{
              left: `${(i * 37) % 100}%`,
              top: `${(i * 53) % 90}%`,
              animationDelay: `${(i % 6) * 0.15}s`,
              animationDuration: `${1 + (i % 4) * 0.25}s`,
            }}
          >
            {confetti[i % confetti.length]}
          </span>
        ))}
      </div>

      <div className="relative space-y-2">
        <div className="label-soft">champion</div>
        <div className="font-display font-bold text-4xl text-grape drop-shadow-sm">
          🏆 {props.championName}
        </div>
        {props.playerIsChampion ? (
          <div className="text-mintDark font-display font-bold text-xl">
            That's you. You ran the whole bracket. 👑
          </div>
        ) : props.myRank ? (
          <div className="text-ink font-semibold">
            You finished{" "}
            <span className="font-display font-bold text-bubbleDark">#{props.myRank}</span>.
          </div>
        ) : null}

        {props.myWinnings > 0 && (
          <div className="chip bg-lemon/40 text-ink inline-flex text-sm py-1.5 px-3">
            💰 You won {money(props.myWinnings)}
          </div>
        )}

        <div className="pt-2">
          <button onClick={props.onClose} className="kbtn kbtn-primary px-8 py-2.5">
            Collect & exit
          </button>
        </div>
      </div>
    </div>
  );
}
