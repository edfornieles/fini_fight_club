import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { FiniFighter } from "./FiniFighter";
import { FINI_IDLE_CLIP, FINI_STATE_CLIPS } from "../../lib/finiAssets";

export type Side = "you" | "them";
export type ArenaFighter = { tokenId: number | string };

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

// Per-team slots, depth-staggered in a shallow arc so all three read distinctly
// from the 3/4 camera once the fighters are in profile.
const TEAM_POS: Vec3[] = [
  [-5.0, 0, -2.2],
  [-5.5, 0,  0.0],
  [-5.0, 0,  2.2],
];
const OPP_POS: Vec3[] = [
  [ 5.0, 0, -2.2],
  [ 5.5, 0,  0.0],
  [ 5.0, 0,  2.2],
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
  attacker: FightClubArena3DProps["attacker"],
  defender: FightClubArena3DProps["defender"],
  outcome: FightClubArena3DProps["outcome"],
): string {
  if (outcome && outcome !== "draw") {
    if (hp <= 0) return FINI_STATE_CLIPS.loser;
    return outcome === side ? FINI_STATE_CLIPS.winner : FINI_STATE_CLIPS.loser;
  }
  if (hp <= 0) return FINI_STATE_CLIPS.loser;
  if (attacker && attacker.side === side && attacker.idx === idx) return FINI_STATE_CLIPS.attack;
  if (defender && defender.side === side && defender.idx === idx) return FINI_STATE_CLIPS.defend;
  return FINI_IDLE_CLIP;
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
  return (
    <Canvas shadows dpr={[1, 2]} style={{ width: "100%", height: "100%" }}>
      {/* Zoomed-in 3/4 hero angle — fixed, no Bounds auto-frame. */}
      <PerspectiveCamera makeDefault fov={45} position={[7, 4.5, 11]} />

      {/* Reference lighting rig from Jakub's build. */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[8, 15, 5]} intensity={1} castShadow />
      <directionalLight position={[-8, 5, -5]} intensity={0.4} />
      <pointLight position={[0, 10, 0]} intensity={0.5} />

      {/* Soft floor + global contact shadow. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 24]} />
        <meshStandardMaterial color="#fce8f3" />
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
            clip={clipFor("you", i, teamHp[i] ?? 0, attacker, defender, outcome)}
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
            clip={clipFor("them", i, oppHp[i] ?? 0, attacker, defender, outcome)}
          />
        ))}
      </Suspense>

      <OrbitControls
        makeDefault
        enablePan={false}
        target={[0, 1.2, 0]}
        minDistance={6}
        maxDistance={30}
      />
    </Canvas>
  );
}
