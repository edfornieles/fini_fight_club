import { useEffect, useMemo, useRef } from "react";
import { Group } from "three";
import { SkeletonUtils } from "three-stdlib";
import { useGLTF, useAnimations } from "@react-three/drei";
import { FINI_ANIMATIONS_URL, FINI_IDLE_CLIP, ALL_MOOD_CLIP_URLS, pickMoodClip, finiModelUrl } from "../../lib/finiAssets";
import { applyMoodFace } from "../../lib/finiFaceMood";
import type { FiniLiveMood } from "../../lib/finiMood";

useGLTF.preload(FINI_ANIMATIONS_URL);

type FiniModelProps = {
  tokenId: number | string;
  clip?: string;
  scale?: number;
  /** Animation playback speed — mood expression (sad Finis idle slowly). */
  timeScale?: number;
  /** Live price mood — swaps the face texture's mouth (frown/flat/squiggle). */
  mood?: FiniLiveMood;
  /** Small thumbnails: keep the mood FACE but use an upright body clip — the
   *  dramatic prone clips (near-dead collapse) read as a crumpled speck in a
   *  120px card. The big viewer / arena leave this off for the full drama. */
  compact?: boolean;
};

export function FiniModel({ tokenId, clip, scale = 1, timeScale = 1, mood, compact = false }: FiniModelProps) {
  const groupRef = useRef<Group>(null);
  const char = useGLTF(finiModelUrl(tokenId), true);
  const anims = useGLTF(FINI_ANIMATIONS_URL);
  // The whole mood-clip library, loaded once and cached globally by drei, so
  // any token can play any of its tier's animations.
  const moodGltfs = useGLTF(ALL_MOOD_CLIP_URLS);

  // Clone so the same token can render in several canvases at once (e.g. a
  // clan-card thumb and the big viewer) — a THREE object has one parent, so
  // sharing char.scene directly makes the last mount steal it from the first.
  const sceneClone = useMemo(() => SkeletonUtils.clone(char.scene), [char.scene]);

  // Mood face: redraw the mouth on this clone's face texture (and restore the
  // original when the mood returns to happy). applyMoodFace clones the face
  // material first, so the shared GLTF cache is never mutated.
  useEffect(() => {
    applyMoodFace(sceneClone, mood ?? "happy");
  }, [sceneClone, mood]);

  const mergedClips = useMemo(
    () => [
      ...char.animations,
      ...anims.animations,
      ...moodGltfs.flatMap(g => g.animations),
    ],
    [char.animations, anims.animations, moodGltfs],
  );

  const { actions, names } = useAnimations(mergedClips, groupRef);

  useEffect(() => {
    if (!actions || names.length === 0) return;
    // Priority: explicit battle clip → a random clip from the mood tier
    // (deterministic per token, so the collection varies) → happy idle.
    const moodClip = mood ? pickMoodClip(tokenId, mood, compact) : undefined;
    const target = (clip && actions[clip] ? clip : null)
      ?? (moodClip && actions[moodClip] ? moodClip : null)
      ?? (actions[FINI_IDLE_CLIP] ? FINI_IDLE_CLIP : names[0]);
    const action = actions[target];
    if (!action) return;
    action.reset().fadeIn(0.25).play();
    action.timeScale = timeScale;
    return () => {
      action.fadeOut(0.25);
    };
  }, [actions, names, clip, timeScale, mood, compact, tokenId]);

  return (
    <group ref={groupRef} scale={scale}>
      <primitive object={sceneClone} />
    </group>
  );
}
