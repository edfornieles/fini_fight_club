import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Center, OrbitControls } from "@react-three/drei";
import { FiniModel } from "./FiniModel";

type FiniStageProps = {
  tokenId: number | string;
  clip?: string;
};

export default function FiniStage({ tokenId, clip }: FiniStageProps) {
  return (
    <Canvas
      camera={{ fov: 40, position: [0, 1.1, 3.4] }}
      style={{ width: "100%", height: "100%" }}
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 5, 4]} intensity={1.1} />
      <directionalLight position={[-4, 2, -3]} intensity={0.6} />
      <Suspense fallback={null}>
        <Center>
          <FiniModel tokenId={tokenId} clip={clip} />
        </Center>
      </Suspense>
      <OrbitControls makeDefault enablePan={false} target={[0, 0.9, 0]} />
    </Canvas>
  );
}
