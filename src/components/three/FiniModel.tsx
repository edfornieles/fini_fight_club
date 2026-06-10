import { useEffect, useMemo, useRef } from "react";
import { Group } from "three";
import { useGLTF, useAnimations } from "@react-three/drei";
import { FINI_ANIMATIONS_URL, FINI_IDLE_CLIP, finiModelUrl } from "../../lib/finiAssets";

useGLTF.preload(FINI_ANIMATIONS_URL);

type FiniModelProps = {
  tokenId: number | string;
  clip?: string;
  scale?: number;
};

export function FiniModel({ tokenId, clip, scale = 1 }: FiniModelProps) {
  const groupRef = useRef<Group>(null);
  const char = useGLTF(finiModelUrl(tokenId), true);
  const anims = useGLTF(FINI_ANIMATIONS_URL);

  const mergedClips = useMemo(
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

  return (
    <group ref={groupRef} scale={scale}>
      <primitive object={char.scene} />
    </group>
  );
}
