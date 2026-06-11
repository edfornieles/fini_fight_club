import { useEffect, useMemo, useRef } from "react";
import { Group } from "three";
import { SkeletonUtils } from "three-stdlib";
import { useGLTF, useAnimations } from "@react-three/drei";
import { FINI_ANIMATIONS_URL, FINI_IDLE_CLIP, FINI_MOOD_IDLE_URL, FINI_EMOTE_CLIPS, finiModelUrl } from "../../lib/finiAssets";

const EMOTE_URLS = Object.values(FINI_EMOTE_CLIPS).map(e => e.url);
import { applyMoodFace } from "../../lib/finiFaceMood";
import type { FiniLiveMood } from "../../lib/finiMood";

useGLTF.preload(FINI_ANIMATIONS_URL);

// Mood idle clip name for a given mood (happy uses the character's own clip).
const MOOD_IDLE_CLIP: Partial<Record<FiniLiveMood, string>> = {
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
};

export function FiniModel({ tokenId, clip, scale = 1, timeScale = 1, mood }: FiniModelProps) {
  const groupRef = useRef<Group>(null);
  const char = useGLTF(finiModelUrl(tokenId), true);
  const anims = useGLTF(FINI_ANIMATIONS_URL);
  // Mood idle clips (converted from the original rig FBX). Loaded once and
  // cached globally by drei; clips retarget by bone name onto any character.
  const moodNeutral = useGLTF(FINI_MOOD_IDLE_URL.neutral.url);
  const moodSad = useGLTF(FINI_MOOD_IDLE_URL.sad.url);
  const moodSick = useGLTF(FINI_MOOD_IDLE_URL.sick.url);
  // Battle emotional-state clips, so the test page (and any caller) can play
  // entrance / doingok / doingbadly / winning / victory / defeated by name.
  const emotes = useGLTF(EMOTE_URLS);

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
      ...moodNeutral.animations,
      ...moodSad.animations,
      ...moodSick.animations,
      ...emotes.flatMap(g => g.animations),
    ],
    [char.animations, anims.animations, moodNeutral.animations, moodSad.animations, moodSick.animations, emotes],
  );

  const { actions, names } = useAnimations(mergedClips, groupRef);

  useEffect(() => {
    if (!actions || names.length === 0) return;
    // Priority: explicit clip prop (battle states) → mood idle → happy idle.
    const moodClip = mood ? MOOD_IDLE_CLIP[mood] : undefined;
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
  }, [actions, names, clip, timeScale, mood]);

  return (
    <group ref={groupRef} scale={scale}>
      <primitive object={sceneClone} />
    </group>
  );
}
