import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Group } from "three";
import { SkeletonUtils } from "three-stdlib";
import { useGLTF, useAnimations } from "@react-three/drei";
import { finiModelUrl } from "../../lib/finiAssets";
import { applyMoodFace } from "../../lib/finiFaceMood";
import type { FiniLiveMood } from "../../lib/finiMood";

const LOOK_AT: [number, number, number] = [0, 0.85, 0];

/**
 * Deliberately standalone — does NOT import FiniModel/FiniStage. Loads exactly
 * one character + one experimental clip GLB and plays it. The whole point is
 * that a broken clip is contained here.
 */
function LabModel({ tokenId, clipUrl, clipName, mood }: { tokenId: string; clipUrl: string; clipName: string; mood: FiniLiveMood }) {
  const groupRef = useRef<Group>(null);
  const char = useGLTF(finiModelUrl(tokenId), true);
  const extra = useGLTF(clipUrl);

  const sceneClone = useMemo(() => SkeletonUtils.clone(char.scene), [char.scene]);

  // Coordinate the face with the body: a moping Fini gets a sad mouth, etc.
  useEffect(() => { applyMoodFace(sceneClone, mood); }, [sceneClone, mood]);

  const clips = useMemo(
    () => [...char.animations, ...extra.animations],
    [char.animations, extra.animations],
  );
  const { actions, names } = useAnimations(clips, groupRef);

  useEffect(() => {
    if (!actions || names.length === 0) return;
    const target = actions[clipName] ? clipName : names[0];
    const action = actions[target];
    if (!action) return;
    action.reset().fadeIn(0.2).play();
    return () => { action.fadeOut(0.2); };
  }, [actions, names, clipName]);

  return (
    <group ref={groupRef}>
      <primitive object={sceneClone} />
    </group>
  );
}

export default function AnimLabStage({ tokenId, clipUrl, clipName, mood }: { tokenId: string; clipUrl: string; clipName: string; mood: FiniLiveMood }) {
  return (
    <Canvas camera={{ fov: 40, position: [0, 1.0, 4.2] }} dpr={[1, 1.5]} style={{ width: "100%", height: "100%" }}
      onCreated={({ camera }) => camera.lookAt(...LOOK_AT)}>
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 5, 4]} intensity={1.1} />
      <directionalLight position={[-4, 2, -3]} intensity={0.6} />
      <Suspense fallback={null}>
        {/* key remounts the whole rig when token or clip changes, so no stale
            mixer state leaks between experiments. */}
        <LabModel key={`${tokenId}:${clipName}`} tokenId={tokenId} clipUrl={clipUrl} clipName={clipName} mood={mood} />
      </Suspense>
      <OrbitControls makeDefault enablePan={false} enableZoom target={LOOK_AT} />
    </Canvas>
  );
}
