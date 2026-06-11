import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Bounds, Center, OrbitControls } from "@react-three/drei";
import { FiniModel } from "./FiniModel";

type FiniStageProps = {
  tokenId: number | string;
  clip?: string;
  /** Drag-to-rotate controls; turn off for small thumbnails. */
  interactive?: boolean;
};

export default function FiniStage({ tokenId, clip, interactive = true }: FiniStageProps) {
  return (
    <Canvas
      camera={{ fov: 40, position: [0, 0.6, 3.4] }}
      dpr={[1, 1.5]}
      style={{ width: "100%", height: "100%" }}
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 5, 4]} intensity={1.1} />
      <directionalLight position={[-4, 2, -3]} intensity={0.6} />
      <Suspense fallback={null}>
        {/* Auto-fit the camera to whatever model loads — token heights vary,
            so a fixed camera/target crops some Finis (cut off at the chest).
            key remounts Bounds per token so each new model re-frames. */}
        <Bounds key={String(tokenId)} fit clip observe margin={1.15}>
          <Center>
            <FiniModel tokenId={tokenId} clip={clip} />
          </Center>
        </Bounds>
      </Suspense>
      {interactive && <OrbitControls makeDefault enablePan={false} enableZoom={false} />}
    </Canvas>
  );
}
