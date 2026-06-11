import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { FiniFighter } from "./FiniFighter";
import { CombatFX, type FxEvent } from "./CombatFX";
import { FINI_STATE_CLIPS, FINI_EMOTE_CLIPS } from "../../lib/finiAssets";

export type Side = "you" | "them";
export type ArenaFighter = { tokenId: number | string; maxHp?: number };

type FightClubArena3DProps = {
  team: ArenaFighter[];
  opponent: ArenaFighter[];
  teamHp: number[];
  oppHp: number[];
  attacker: { side: Side; idx: number } | null;
  defender: { side: Side; idx: number } | null;
  outcome?: "you" | "them" | "draw" | null;
};

type Vec3 = [number, number, number];

// Per-team slots in a reversed fan (front fighter on the OUTSIDE, line
// receding inward toward the center gap) with generous spacing, so all six
// fighters read separately from the frontal camera — none occlude a teammate.
const TEAM_POS: Vec3[] = [
  [-5.6, 0,  2.0],
  [-3.9, 0,  0.0],
  [-2.2, 0, -2.0],
];
const OPP_POS: Vec3[] = [
  [ 5.6, 0,  2.0],
  [ 3.9, 0,  0.0],
  [ 2.2, 0, -2.0],
];

// Jakub's facing formula: rotation Y = faceDirection * π/2.
// Your team faces +X (toward opponent), opponent faces -X.
const TEAM_ROT: Vec3 = [0,  Math.PI / 2, 0];
const OPP_ROT:  Vec3 = [0, -Math.PI / 2, 0];

// Fraction of the gap an attacker lunges toward its target before easing back.
const LUNGE_FRAC = 0.4;

function slotFor(side: Side, idx: number): Vec3 {
  const arr = side === "you" ? TEAM_POS : OPP_POS;
  return arr[idx] ?? arr[arr.length - 1];
}

function lungeTargetFor(
  side: Side,
  idx: number,
  attacker: FightClubArena3DProps["attacker"],
  defender: FightClubArena3DProps["defender"],
): Vec3 | null {
  if (!attacker || !defender) return null;
  if (attacker.side !== side || attacker.idx !== idx) return null;
  const home = slotFor(side, idx);
  const targetHome = slotFor(defender.side, defender.idx);
  return [
    home[0] + (targetHome[0] - home[0]) * LUNGE_FRAC,
    home[1] + (targetHome[1] - home[1]) * LUNGE_FRAC,
    home[2] + (targetHome[2] - home[2]) * LUNGE_FRAC,
  ];
}

function clipFor(
  side: Side,
  idx: number,
  hp: number,
  maxHp: number,
  attacker: FightClubArena3DProps["attacker"],
  defender: FightClubArena3DProps["defender"],
  outcome: FightClubArena3DProps["outcome"],
): string {
  // End of battle: real victory / defeated emotes from the original rig.
  if (outcome && outcome !== "draw") {
    if (hp <= 0) return FINI_EMOTE_CLIPS.defeated.clip;
    return outcome === side ? FINI_EMOTE_CLIPS.victory.clip : FINI_EMOTE_CLIPS.defeated.clip;
  }
  if (hp <= 0) return FINI_EMOTE_CLIPS.defeated.clip;
  // Mid-attack/defend keep the punchy move clips for readability.
  if (attacker && attacker.side === side && attacker.idx === idx) return FINI_STATE_CLIPS.attack;
  if (defender && defender.side === side && defender.idx === idx) return FINI_STATE_CLIPS.defend;
  // Resting state emotes the fighter's HP: hurt when low, confident when high.
  const pct = maxHp > 0 ? hp / maxHp : 1;
  if (pct <= 0.33) return FINI_EMOTE_CLIPS.doingbadly.clip;
  if (pct >= 0.85) return FINI_EMOTE_CLIPS.winning.clip;
  return FINI_EMOTE_CLIPS.doingok.clip;
}

export default function FightClubArena3D({
  team,
  opponent,
  teamHp,
  oppHp,
  attacker,
  defender,
  outcome = null,
}: FightClubArena3DProps) {
  // ── Floating combat text, driven by HP deltas (covers damage AND heals,
  //    including future in-battle item/heal mechanics automatically). ──
  const [fx, setFx] = useState<FxEvent[]>([]);
  const prevHp = useRef<{ you: number[]; them: number[] } | null>(null);
  const fxKey = useRef(0);
  useEffect(() => {
    const prev = prevHp.current;
    prevHp.current = { you: [...teamHp], them: [...oppHp] };
    if (!prev) return;
    const spawned: FxEvent[] = [];
    const scan = (side: Side, curr: number[], old: number[]) => {
      curr.forEach((hp, i) => {
        const before = old[i];
        if (before === undefined || hp === before) return;
        const pos = slotFor(side, i);
        const head: [number, number, number] = [pos[0], 2.9, pos[2]];
        if (hp < before) {
          spawned.push({ key: ++fxKey.current, position: head, kind: "damage", text: `-${before - hp}` });
          if (hp <= 0) {
            spawned.push({ key: ++fxKey.current, position: [pos[0], 2.1, pos[2]], kind: "ko", text: "KO!" });
          }
        } else {
          spawned.push({ key: ++fxKey.current, position: head, kind: "heal", text: `+${hp - before} 💚` });
        }
      });
    };
    scan("you", teamHp, prev.you);
    scan("them", oppHp, prev.them);
    if (!spawned.length) return;
    setFx(f => [...f.slice(-8), ...spawned]);
    const keys = spawned.map(s => s.key);
    const t = setTimeout(() => setFx(f => f.filter(e => !keys.includes(e.key))), 1300);
    return () => clearTimeout(t);
  }, [teamHp, oppHp]);

  return (
    <Canvas shadows dpr={[1, 2]} style={{ width: "100%", height: "100%" }}>
      {/* Low, near-frontal hero angle — wide enough that the whole reversed
          fan is on screen, close enough that fighters stay big. */}
      <PerspectiveCamera makeDefault fov={42} position={[0, 2.0, 10.4]} />

      {/* Reference lighting rig from Jakub's build. */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[8, 15, 5]} intensity={1} castShadow />
      <directionalLight position={[-8, 5, -5]} intensity={0.4} />
      <pointLight position={[0, 10, 0]} intensity={0.5} />

      {/* Soft gray floor (reference-build palette) + global contact shadow. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 24]} />
        <meshStandardMaterial color="#c9c2c6" />
      </mesh>
      <ContactShadows
        position={[0, 0.01, 0]}
        opacity={0.5}
        scale={28}
        blur={2.4}
        far={6}
      />

      <Suspense fallback={null}>
        {team.map((f, i) => (
          <FiniFighter
            key={`you-${i}-${f.tokenId}`}
            tokenId={f.tokenId}
            homePosition={slotFor("you", i)}
            lungeTo={lungeTargetFor("you", i, attacker, defender)}
            rotation={TEAM_ROT}
            scale={1.5}
            clip={clipFor("you", i, teamHp[i] ?? 0, f.maxHp ?? teamHp[i] ?? 1, attacker, defender, outcome)}
            ko={(teamHp[i] ?? 0) <= 0}
            intro={{ fromX: -11, delayMs: i * 220 }}
          />
        ))}
        {opponent.map((f, i) => (
          <FiniFighter
            key={`them-${i}-${f.tokenId}`}
            tokenId={f.tokenId}
            homePosition={slotFor("them", i)}
            lungeTo={lungeTargetFor("them", i, attacker, defender)}
            rotation={OPP_ROT}
            scale={1.5}
            clip={clipFor("them", i, oppHp[i] ?? 0, f.maxHp ?? oppHp[i] ?? 1, attacker, defender, outcome)}
            ko={(oppHp[i] ?? 0) <= 0}
            intro={{ fromX: 11, delayMs: i * 220 }}
          />
        ))}
      </Suspense>

      <CombatFX events={fx} />

      <OrbitControls
        makeDefault
        enablePan={false}
        target={[0, 1.05, 0]}
        minDistance={4}
        maxDistance={30}
      />
    </Canvas>
  );
}
