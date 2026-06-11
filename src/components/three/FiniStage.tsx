import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { FiniModel } from "./FiniModel";

type FiniStageProps = {
  tokenId: number | string;
  clip?: string;
  /** Drag-to-rotate controls; turn off for small thumbnails. */
  interactive?: boolean;
  /** Animation playback speed — mood expression. */
  timeScale?: number;
  /** Live price mood — drives the face texture (mouth swap). */
  mood?: import("../../lib/finiMood").FiniLiveMood;
};

// Finis share one rig: origin at the feet, ~1.6–2 units tall. Fixed framing
// (same approach as FightClubArena3D) beats auto-fit here — skinned-mesh
// bounds report the bind pose, which made Bounds zoom onto heads.
const LOOK_AT: [number, number, number] = [0, 0.85, 0];

export default function FiniStage({ tokenId, clip, interactive = true, timeScale = 1, mood }: FiniStageProps) {
  return (
    <Canvas
      camera={{ fov: 40, position: [0, 1.0, 4.2] }}
      dpr={[1, 1.5]}
      style={{ width: "100%", height: "100%" }}
      onCreated={({ camera }) => camera.lookAt(...LOOK_AT)}
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 5, 4]} intensity={1.1} />
      <directionalLight position={[-4, 2, -3]} intensity={0.6} />
      <Suspense fallback={null}>
        <FiniModel tokenId={tokenId} clip={clip} timeScale={timeScale} mood={mood} />
      </Suspense>
      {interactive && <OrbitControls makeDefault enablePan={false} enableZoom={false} target={LOOK_AT} />}
    </Canvas>
  );
}
