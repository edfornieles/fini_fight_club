import { useEffect, useMemo, useRef } from "react";
import { Group } from "three";
import { SkeletonUtils } from "three-stdlib";
import { useGLTF, useAnimations } from "@react-three/drei";
import { FINI_ANIMATIONS_URL, FINI_IDLE_CLIP, FINI_MOOD_IDLE_URL, finiModelUrl } from "../../lib/finiAssets";
import { applyMoodFace } from "../../lib/finiFaceMood";
import type { FiniLiveMood } from "../../lib/finiMood";

useGLTF.preload(FINI_ANIMATIONS_URL);

// Mood → body clip. Each Fini emotes its linked-coin mood: dancing when up,
// moping when down, collapsing when crashing.
const MOOD_IDLE_CLIP: Partial<Record<FiniLiveMood, string>> = {
  happy: FINI_MOOD_IDLE_URL.happy.clip,
  neutral: FINI_MOOD_IDLE_URL.neutral.clip,
  sad: FINI_MOOD_IDLE_URL.sad.clip,
  sick: FINI_MOOD_IDLE_URL.sick.clip,
};

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

// In compact (thumbnail) mode, the very-sad collapse stays upright as a mope.
const COMPACT_MOOD_CLIP: Partial<Record<FiniLiveMood, string>> = {
  ...MOOD_IDLE_CLIP,
  sick: FINI_MOOD_IDLE_URL.sad.clip,
};

export function FiniModel({ tokenId, clip, scale = 1, timeScale = 1, mood, compact = false }: FiniModelProps) {
  const groupRef = useRef<Group>(null);
  const char = useGLTF(finiModelUrl(tokenId), true);
  const anims = useGLTF(FINI_ANIMATIONS_URL);
  // Mood body clips (retargeted onto the rig). Loaded once and cached globally
  // by drei; retarget by bone name onto any character.
  const moodHappy = useGLTF(FINI_MOOD_IDLE_URL.happy.url);
  const moodNeutral = useGLTF(FINI_MOOD_IDLE_URL.neutral.url);
  const moodSad = useGLTF(FINI_MOOD_IDLE_URL.sad.url);
  const moodSick = useGLTF(FINI_MOOD_IDLE_URL.sick.url);

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
      ...moodHappy.animations,
      ...moodNeutral.animations,
      ...moodSad.animations,
      ...moodSick.animations,
    ],
    [char.animations, anims.animations, moodHappy.animations, moodNeutral.animations, moodSad.animations, moodSick.animations],
  );

  const { actions, names } = useAnimations(mergedClips, groupRef);

  useEffect(() => {
    if (!actions || names.length === 0) return;
    // Priority: explicit clip prop (battle states) → mood body clip → happy idle.
    const moodMap = compact ? COMPACT_MOOD_CLIP : MOOD_IDLE_CLIP;
    const moodClip = mood ? moodMap[mood] : undefined;
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
  }, [actions, names, clip, timeScale, mood, compact]);

  return (
    <group ref={groupRef} scale={scale}>
      <primitive object={sceneClone} />
    </group>
  );
}
