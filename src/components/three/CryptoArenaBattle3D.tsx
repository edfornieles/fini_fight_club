import { Suspense, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, PerspectiveCamera } from "@react-three/drei";
import { FiniFighter } from "./FiniFighter";
import { asset } from "../../lib/assetUrl";
import type { FiniLiveMood } from "../../lib/finiMood";

/**
 * The Crypto Arena duel: one Fini per competing coin, a randomly-drawn member
 * of that coin's family. They walk in, bow, then emote how their coin is doing
 * in this battle — the side that's ahead dances, the side that's behind mopes.
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

// Mood the fighter plays from its side's share of the pot (the live lead).
function moodForPct(pct: number): FiniLiveMood {
  if (pct >= 58) return "happy";
  if (pct >= 45) return "neutral";
  if (pct >= 30) return "sad";
  return "sick";
}

const POS_LEFT: [number, number, number] = [-2.2, 0, 0];
const POS_RIGHT: [number, number, number] = [2.2, 0, 0];
const ROT_LEFT: [number, number, number] = [0, Math.PI / 2, 0];
const ROT_RIGHT: [number, number, number] = [0, -Math.PI / 2, 0];

export default function CryptoArenaBattle3D({ battleId, familyA, familyB, sideAPct, sideBPct }: {
  battleId: string;
  familyA: string;
  familyB?: string;
  sideAPct: number;
  sideBPct: number;
}) {
  const [table, setTable] = useState<FamilyTokens | null>(_cache);
  useEffect(() => {
    if (_cache) return;
    fetch(asset("/data/familyTokens.json")).then(r => r.json()).then((t: FamilyTokens) => { _cache = t; setTable(t); }).catch(() => {});
  }, []);

  if (!table) return null;
  const tokenA = pickToken(familyA, battleId, table);
  // Up/Down battles have one coin: field two of the same family, different draws.
  const tokenB = familyB ? pickToken(familyB, battleId, table) : pickToken(familyA, battleId + "b", table);
  if (tokenA == null || tokenB == null) return null;

  const moodA = moodForPct(sideAPct);
  const moodB = moodForPct(sideBPct);

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
          mood={moodA}
          intro={{ fromX: -9, delayMs: 0 }}
        />
        <FiniFighter
          key={`b-${tokenB}`}
          tokenId={tokenB}
          homePosition={POS_RIGHT}
          rotation={ROT_RIGHT}
          scale={1.5}
          mood={moodB}
          intro={{ fromX: 9, delayMs: 200 }}
        />
      </Suspense>
    </Canvas>
  );
}
