import { useEffect, useMemo, useRef } from "react";
import { Group } from "three";
import { SkeletonUtils } from "three-stdlib";
import { useGLTF, useAnimations } from "@react-three/drei";
import { FINI_ANIMATIONS_URL, FINI_IDLE_CLIP, finiModelUrl } from "../../lib/finiAssets";

useGLTF.preload(FINI_ANIMATIONS_URL);

type FiniModelProps = {
  tokenId: number | string;
  clip?: string;
  scale?: number;
  /** Animation playback speed — mood expression (sad Finis idle slowly). */
  timeScale?: number;
};

export function FiniModel({ tokenId, clip, scale = 1, timeScale = 1 }: FiniModelProps) {
  const groupRef = useRef<Group>(null);
  const char = useGLTF(finiModelUrl(tokenId), true);
  const anims = useGLTF(FINI_ANIMATIONS_URL);

  // Clone so the same token can render in several canvases at once (e.g. a
  // clan-card thumb and the big viewer) — a THREE object has one parent, so
  // sharing char.scene directly makes the last mount steal it from the first.
  const sceneClone = useMemo(() => SkeletonUtils.clone(char.scene), [char.scene]);

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
    action.timeScale = timeScale;
    return () => {
      action.fadeOut(0.25);
    };
  }, [actions, names, clip, timeScale]);

  return (
    <group ref={groupRef} scale={scale}>
      <primitive object={sceneClone} />
    </group>
  );
}
