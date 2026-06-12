import { useEffect, useMemo, useRef } from "react";
import { Group, Vector3, AnimationClip, Mesh, Material } from "three";
import { useFrame } from "@react-three/fiber";
import { SkeletonUtils } from "three-stdlib";
import { useGLTF, useAnimations } from "@react-three/drei";
import { FINI_ANIMATIONS_URL, FINI_IDLE_CLIP, FINI_MOOD_IDLE_URL, finiModelUrl } from "../../lib/finiAssets";
import { applyMoodFace } from "../../lib/finiFaceMood";
import type { FiniLiveMood } from "../../lib/finiMood";

useGLTF.preload(FINI_ANIMATIONS_URL);

const MOOD_CLIP: Record<FiniLiveMood, string> = {
  happy: FINI_MOOD_IDLE_URL.happy.clip,
  neutral: FINI_MOOD_IDLE_URL.neutral.clip,
  sad: FINI_MOOD_IDLE_URL.sad.clip,
  sick: FINI_MOOD_IDLE_URL.sick.clip,
};

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
  /** KO'd fighters turn semi-transparent. */
  ko?: boolean;
  /** Opening ceremony: glide in from offstage x, then bow. Staggered per slot. */
  intro?: { fromX: number; delayMs?: number } | null;
  /** Live mood — plays the matching body clip + face when no explicit clip. */
  mood?: FiniLiveMood;
};

// Opening-ceremony timings (ms): glide in, beat, bow down + up.
const WALK_MS = 1500;
const BOW_PAUSE_MS = 150;
const BOW_MS = 950;
const BOW_LEAN_RAD = 0.5;

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

function forEachMaterial(root: Group, fn: (m: Material) => void) {
  root.traverse(o => {
    const mesh = o as Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach(fn);
  });
}

export function FiniFighter({
  tokenId,
  clip,
  scale = 1.5,
  homePosition = [0, 0, 0],
  lungeTo = null,
  rotation = [0, 0, 0],
  ko = false,
  intro = null,
  mood,
}: FiniFighterProps) {
  const groupRef = useRef<Group>(null);
  const innerRef = useRef<Group>(null);
  const char = useGLTF(finiModelUrl(tokenId), true);
  const anims = useGLTF(FINI_ANIMATIONS_URL);
  // Mood body clips (only loaded/merged when a mood is in play — Fight Club
  // passes explicit clips and no mood, so this stays inert there).
  const moodHappy = useGLTF(FINI_MOOD_IDLE_URL.happy.url);
  const moodNeutral = useGLTF(FINI_MOOD_IDLE_URL.neutral.url);
  const moodSad = useGLTF(FINI_MOOD_IDLE_URL.sad.url);
  const moodSick = useGLTF(FINI_MOOD_IDLE_URL.sick.url);

  // Clone the scene so multiple fighters get independent skeletons, and clone
  // materials so per-fighter opacity (KO fade) can't bleed into other clones
  // sharing the same source GLB.
  const sceneClone = useMemo(() => {
    const c = SkeletonUtils.clone(char.scene);
    c.traverse(o => {
      const mesh = o as Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map(m => m.clone())
        : mesh.material.clone();
    });
    return c;
  }, [char.scene]);

  // KO → ghost out. transparent only while faded so normal render sorting is
  // untouched for living fighters.
  useEffect(() => {
    forEachMaterial(sceneClone as unknown as Group, m => {
      m.transparent = ko;
      m.opacity = ko ? 0.3 : 1;
      m.depthWrite = !ko;
    });
  }, [ko, sceneClone]);

  const mergedClips = useMemo<AnimationClip[]>(
    () => [
      ...char.animations, ...anims.animations,
      ...moodHappy.animations, ...moodNeutral.animations, ...moodSad.animations, ...moodSick.animations,
    ],
    [char.animations, anims.animations, moodHappy.animations, moodNeutral.animations, moodSad.animations, moodSick.animations],
  );

  // Mood face (mouth) tracks the body, like the Explore/wallet Finis.
  useEffect(() => {
    if (mood) applyMoodFace(sceneClone, mood);
  }, [sceneClone, mood]);

  const { actions, names } = useAnimations(mergedClips, groupRef);

  useEffect(() => {
    if (!actions || names.length === 0) return;
    // Explicit battle clip → mood body clip → idle.
    const moodClip = mood ? MOOD_CLIP[mood] : undefined;
    const target = (clip && actions[clip] ? clip : null)
      ?? (moodClip && actions[moodClip] ? moodClip : null)
      ?? (actions[FINI_IDLE_CLIP] ? FINI_IDLE_CLIP : names[0]);
    const action = actions[target];
    if (!action) return;
    action.reset().fadeIn(0.25).play();
    return () => {
      action.fadeOut(0.25);
    };
  }, [actions, names, clip, mood]);

  // Opening ceremony clock — starts on mount, per-fighter delay staggers the
  // team's entrance.
  const introStartRef = useRef<number | null>(null);
  const introDoneRef = useRef(!intro);

  // Lunge: exponential lerp toward lungeTo (or back to home). k=10 reaches ~95%
  // in ~0.3s, which matches the attacker-window the BattleView sets per turn.
  const targetVec = useRef(new Vector3(...homePosition));
  useFrame((state, dt) => {
    const g = groupRef.current;
    if (!g) return;

    // ── Intro: glide in from offstage, pause, bow. Overrides lunging. ──
    if (!introDoneRef.current && intro) {
      if (introStartRef.current === null) introStartRef.current = state.clock.elapsedTime * 1000;
      const t = state.clock.elapsedTime * 1000 - introStartRef.current - (intro.delayMs ?? 0);
      if (t < 0) {
        g.position.set(intro.fromX, homePosition[1], homePosition[2]);
        return;
      }
      if (t < WALK_MS) {
        const p = easeInOut(t / WALK_MS);
        // Walk-in: a stepping bob + slight forward lean reads as marching in,
        // even without a dedicated walk clip. ~5 steps across the entrance.
        const steps = Math.abs(Math.sin((t / WALK_MS) * Math.PI * 5));
        const moving = 1 - Math.abs(p - 0.5) * 2; // fade the bob in/out at ends
        g.position.set(
          intro.fromX + (homePosition[0] - intro.fromX) * p,
          homePosition[1] + steps * 0.12 * moving,
          homePosition[2],
        );
        if (innerRef.current) innerRef.current.rotation.x = 0.12 * moving;
        return;
      }
      g.position.set(...homePosition);
      if (innerRef.current) innerRef.current.rotation.x = 0;
      const bt = t - WALK_MS - BOW_PAUSE_MS;
      if (bt >= 0 && bt < BOW_MS) {
        // Lean toward the opponent (inner group: local +Z is the facing
        // direction after the parent's Y-rotation), down then back up.
        if (innerRef.current) innerRef.current.rotation.x = Math.sin((bt / BOW_MS) * Math.PI) * BOW_LEAN_RAD;
        return;
      }
      if (bt >= BOW_MS) {
        if (innerRef.current) innerRef.current.rotation.x = 0;
        introDoneRef.current = true;
      }
      return;
    }

    // ── Normal combat easing ──
    if (lungeTo) {
      targetVec.current.set(lungeTo[0], lungeTo[1], lungeTo[2]);
    } else {
      targetVec.current.set(homePosition[0], homePosition[1], homePosition[2]);
    }
    const alpha = 1 - Math.exp(-dt * 10);
    g.position.lerp(targetVec.current, alpha);
  });

  return (
    <group
      ref={groupRef}
      position={intro ? [intro.fromX, homePosition[1], homePosition[2]] : homePosition}
      rotation={rotation}
      scale={scale}
    >
      <group ref={innerRef}>
        <primitive object={sceneClone} />
      </group>
    </group>
  );
}
