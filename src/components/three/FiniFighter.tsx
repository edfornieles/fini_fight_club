import { useEffect, useMemo, useRef } from "react";
import { Group, Vector3, AnimationClip } from "three";
import { useFrame } from "@react-three/fiber";
import { SkeletonUtils } from "three-stdlib";
import { useGLTF, useAnimations } from "@react-three/drei";
import { FINI_ANIMATIONS_URL, FINI_IDLE_CLIP, finiModelUrl } from "../../lib/finiAssets";

useGLTF.preload(FINI_ANIMATIONS_URL);

type Vec3 = [number, number, number];

type FiniFighterProps = {
  tokenId: number | string;
  clip?: string;
  scale?: number;
  homePosition?: Vec3;
  // When non-null, the fighter eases toward this point (caller picks a position
  // ~40% of the way across the gap toward the target). When null, eases back home.
  lungeTo?: Vec3 | null;
  rotation?: Vec3;
};

export function FiniFighter({
  tokenId,
  clip,
  scale = 1.5,
  homePosition = [0, 0, 0],
  lungeTo = null,
  rotation = [0, 0, 0],
}: FiniFighterProps) {
  const groupRef = useRef<Group>(null);
  const char = useGLTF(finiModelUrl(tokenId), true);
  const anims = useGLTF(FINI_ANIMATIONS_URL);

  // Clone the scene so multiple fighters get independent skeletons.
  const sceneClone = useMemo(() => SkeletonUtils.clone(char.scene), [char.scene]);

  const mergedClips = useMemo<AnimationClip[]>(
    () => [...char.animations, ...anims.animations],
    [char.animations, anims.animations],
  );

  const { actions, names } = useAnimations(mergedClips, groupRef);

  useEffect(() => {
    if (!actions || names.length === 0) return;
    const target = (clip && actions[clip] ? clip : null)
      ?? (actions[FINI_IDLE_CLIP] ? FINI_IDLE_CLIP : names[0]);
    const action = actions[target];
    if (!action) return;
    action.reset().fadeIn(0.25).play();
    return () => {
      action.fadeOut(0.25);
    };
  }, [actions, names, clip]);

  // Lunge: exponential lerp toward lungeTo (or back to home). k=10 reaches ~95%
  // in ~0.3s, which matches the attacker-window the BattleView sets per turn.
  const targetVec = useRef(new Vector3(...homePosition));
  useFrame((_, dt) => {
    if (!groupRef.current) return;
    if (lungeTo) {
      targetVec.current.set(lungeTo[0], lungeTo[1], lungeTo[2]);
    } else {
      targetVec.current.set(homePosition[0], homePosition[1], homePosition[2]);
    }
    const alpha = 1 - Math.exp(-dt * 10);
    groupRef.current.position.lerp(targetVec.current, alpha);
  });

  return (
    <group ref={groupRef} position={homePosition} rotation={rotation} scale={scale}>
      <primitive object={sceneClone} />
    </group>
  );
}
