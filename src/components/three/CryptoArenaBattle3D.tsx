import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, PerspectiveCamera } from "@react-three/drei";
import { FiniFighter } from "./FiniFighter";
import { asset } from "../../lib/assetUrl";
import { FINI_STATE_CLIPS } from "../../lib/finiAssets";

/**
 * The Crypto Arena duel: one Fini per competing coin, a randomly-drawn member
 * of that coin's family. They walk in, bow, then FIGHT — trading lunging
 * attacks (the side that's ahead presses the advantage and lands more) until
 * the battle resolves, at which point the winner celebrates and the loser
 * collapses.
 */

type FamilyTokens = Record<string, number[]>;
let _cache: FamilyTokens | null = null;

// Deterministic pick from a family so the same battle always fields the same
// two Finis (stable across re-renders / reloads of the same battle id).
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function pickToken(family: string, seed: string, table: FamilyTokens): number | null {
  const list = table[family];
  if (!list || !list.length) return null;
  return list[hash(seed + family) % list.length];
}

const POS_LEFT: [number, number, number] = [-2.2, 0, 0];
const POS_RIGHT: [number, number, number] = [2.2, 0, 0];
// 3/4 hero stance, not pure profile. The Fini's face is a flat board on its
// local +Z (it faces the camera at rotation 0 — see FiniModel). A full ±90°
// turned it edge-on, and an attacker lunging inward showed its back. ~40° keeps
// each fighter angled toward its opponent (the lunge + bow sell the face-off)
// while the face stays toward the camera and clearly readable.
const FACE_TURN = Math.PI * 0.22; // ≈ 40°
const ROT_LEFT: [number, number, number] = [0, FACE_TURN, 0];
const ROT_RIGHT: [number, number, number] = [0, -FACE_TURN, 0];
// Attacker lunges a short jab toward the opponent (not all the way in).
const LUNGE = 0.22;
const lerp3 = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] =>
  [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

const CEREMONY_MS = 3300;  // walk-in + bow before the first blow
const SWING_MS = 1100;     // cadence of attacks

export default function CryptoArenaBattle3D({ battleId, familyA, familyB, sideAPct, sideBPct, resolved = false }: {
  battleId: string;
  familyA: string;
  familyB?: string;
  sideAPct: number;
  sideBPct: number;
  /** When true the duel stops and freezes to the outcome (winner / loser). */
  resolved?: boolean;
}) {
  const [table, setTable] = useState<FamilyTokens | null>(_cache);
  // Whose turn to strike: "A", "B", or null (between swings / pre-fight).
  const [attacker, setAttacker] = useState<"A" | "B" | null>(null);
  const fighting = useRef(false);
  const pctRef = useRef({ a: sideAPct, b: sideBPct });
  pctRef.current = { a: sideAPct, b: sideBPct };

  useEffect(() => {
    if (_cache) { setTable(_cache); return; }
    fetch(asset("/data/familyTokens.json")).then(r => r.json()).then((t: FamilyTokens) => { _cache = t; setTable(t); }).catch(() => {});
  }, []);

  // Fight loop: after the ceremony, alternate strikes — the leading side
  // attacks more often (presses its advantage). Stops once resolved.
  useEffect(() => {
    if (!table || resolved) { setAttacker(null); fighting.current = false; return; }
    let alive = true;
    let swing: ReturnType<typeof setTimeout>;
    let clear: ReturnType<typeof setTimeout>;
    const start = setTimeout(() => { fighting.current = true; tick(); }, CEREMONY_MS);

    function tick() {
      if (!alive) return;
      const { a, b } = pctRef.current;
      const total = a + b || 1;
      const next: "A" | "B" = Math.random() < a / total ? "A" : "B";
      setAttacker(next);
      clear = setTimeout(() => alive && setAttacker(null), SWING_MS * 0.55);
      swing = setTimeout(tick, SWING_MS);
    }
    return () => { alive = false; clearTimeout(start); clearTimeout(swing); clearTimeout(clear); };
  }, [table, resolved]);

  if (!table) return null;
  const tokenA = pickToken(familyA, battleId, table);
  // Up/Down battles have one coin: field two of the same family, different draws.
  const tokenB = familyB ? pickToken(familyB, battleId, table) : pickToken(familyA, battleId + "b", table);
  if (tokenA == null || tokenB == null) return null;

  const winnerA = sideAPct >= sideBPct;

  // Per-fighter clip + lunge. While fighting: attacker swings + lunges, the
  // other braces (defend). On resolve: winner celebrates, loser slumps — using
  // the camera-facing MOOD clips (fin_dance / fin_mope) instead of the battle
  // victory/defeat clips, which were authored facing away from the camera.
  const WIN_CLIP = "fin_dance";   // happy celebration, faces camera (see FiniModel)
  const LOSE_CLIP = "fin_mope";   // dejected, upright, faces camera
  const aClip = resolved ? (winnerA ? WIN_CLIP : LOSE_CLIP)
    : attacker === "A" ? FINI_STATE_CLIPS.attack
    : attacker === "B" ? FINI_STATE_CLIPS.defend
    : FINI_STATE_CLIPS.idle;
  const bClip = resolved ? (winnerA ? LOSE_CLIP : WIN_CLIP)
    : attacker === "B" ? FINI_STATE_CLIPS.attack
    : attacker === "A" ? FINI_STATE_CLIPS.defend
    : FINI_STATE_CLIPS.idle;
  const aLunge = !resolved && attacker === "A" ? lerp3(POS_LEFT, POS_RIGHT, LUNGE) : null;
  const bLunge = !resolved && attacker === "B" ? lerp3(POS_RIGHT, POS_LEFT, LUNGE) : null;

  return (
    <Canvas shadows dpr={[1, 2]} style={{ width: "100%", height: "100%" }} gl={{ alpha: true }}>
      {/* Pulled back + tilted down a touch so both full bodies (feet to head)
          read in a wide hero. */}
      <PerspectiveCamera makeDefault fov={38} position={[0, 1.9, 9.5]} onUpdate={c => c.lookAt(0, 1.0, 0)} />
      <ambientLight intensity={0.65} />
      <directionalLight position={[6, 12, 6]} intensity={1} castShadow />
      <directionalLight position={[-6, 5, -4]} intensity={0.35} />
      <ContactShadows position={[0, 0.01, 0]} opacity={0.45} scale={20} blur={2.4} far={5} />
      <Suspense fallback={null}>
        <FiniFighter
          key={`a-${tokenA}`}
          tokenId={tokenA}
          homePosition={POS_LEFT}
          rotation={ROT_LEFT}
          scale={1.5}
          clip={aClip}
          lungeTo={aLunge}
          ko={resolved && !winnerA}
          intro={{ fromX: -9, delayMs: 0 }}
        />
        <FiniFighter
          key={`b-${tokenB}`}
          tokenId={tokenB}
          homePosition={POS_RIGHT}
          rotation={ROT_RIGHT}
          scale={1.5}
          clip={bClip}
          lungeTo={bLunge}
          ko={resolved && winnerA}
          intro={{ fromX: 9, delayMs: 200 }}
        />
      </Suspense>
    </Canvas>
  );
}
