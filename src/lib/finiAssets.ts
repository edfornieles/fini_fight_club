const BASE = ((import.meta.env.VITE_FINI_ASSETS_URL as string | undefined) ??
  "https://pub-af40a5ba16d9438ab2141f56ff0bbcfe.r2.dev/raw/temp_fini_upload").replace(/\/$/, "");
export const finiModelUrl = (t: number | string) => `${BASE}/characters/${t}.glb`;
export const finiCharacterInfoUrl = (t: number | string) => `${BASE}/characters_info/${t}.json`;
export type FiniCharacterInfo = { family?: string; frequency?: string; clan?: string; background?: string };
export const FINI_ANIMATIONS_URL = `${BASE}/animations/all_animations-opt.glb`;
export const FINI_IDLE_CLIP = "fin_happy_idle";

// Mood idle clips converted from the original rig FBX (Finiliar Storage drive)
// and bundled locally. Same Fin_Bone_* skeleton as the characters → retarget
// onto any token. `happy` uses the character GLB's own baked fin_happy_idle.
import { asset } from "./assetUrl";
// Verified clips retargeted onto the character rig (the direct-export sad/
// supersad idles exploded — only neutral survived; sad/very-sad use the
// expressive retargeted clips that render clean).
export const FINI_MOOD_IDLE_URL: Record<"happy" | "neutral" | "sad" | "sick", { url: string; clip: string }> = {
  happy:   { url: asset("/anim/fin_dance.glb"),        clip: "fin_dance" },
  neutral: { url: asset("/anim/fin_neutral_idle.glb"), clip: "fin_neutral_idle" },
  sad:     { url: asset("/anim/fin_mope.glb"),         clip: "fin_mope" },
  sick:    { url: asset("/anim/fin_neardead.glb"),     clip: "fin_neardead" },
};

// Full verified clip library, grouped by mood tier. Each Fini draws a random
// clip from its tier (deterministic per token) so the collection feels alive —
// no two sad Finis do the exact same thing. `upright` flags clips that read at
// thumbnail size (the prone collapse anims only suit the big viewer / arena).
type MoodClip = { clip: string; upright: boolean };
const m = (name: string, upright = true): MoodClip => ({ clip: name, upright });
export const MOOD_CLIP_SETS: Record<"happy" | "neutral" | "sad" | "sick", MoodClip[]> = {
  happy:   [m("fin_happy_workout"), m("fin_dance"), m("fin_dancingwithstars"), m("fin_hugesurprise")],
  neutral: [m("fin_neutral_workout"), m("fin_neutral_idle"), m("fin_bored"), m("fin_hungrystomach")],
  sad:     [m("fin_mope"), m("fin_angry"), m("fin_cough"), m("fin_distresssway")],
  sick:    [m("fin_neardead", false), m("fin_raincrying", false), m("fin_raindesperate", false), m("fin_rollingaroundtherain", false), m("fin_banginghead", false)],
};

// Workout-themed mood: the coin's performance "over a time period" reads as a
// training session — winning trains hard and happy, losing struggles, crashing
// ends up collapsed on the floor. The COMPLETE authentic set (all four moods
// from the original workout animations, sad/supersad rescued via the
// assimp→GLB→object-retarget pipeline in scripts/retarget_assimp.py).
export const WORKOUT_MOOD_CLIP: Record<"happy" | "neutral" | "sad" | "sick", string> = {
  happy:   "fin_happy_workout",
  neutral: "fin_neutral_workout",
  sad:     "fin_sad_workout",
  sick:    "fin_supersad_workout",
};
// Every clip GLB url (deduped) — FiniModel loads the whole set once (cached
// globally by drei) so any token can play any mood clip.
export const ALL_MOOD_CLIP_URLS: string[] = Array.from(new Set([
  ...Object.values(MOOD_CLIP_SETS).flat().map(c => asset(`/anim/${c.clip}.glb`)),
  ...Object.values(WORKOUT_MOOD_CLIP).map(c => asset(`/anim/${c}.glb`)),
]));

// Deterministic per-token pick from a mood tier. `compact` thumbnails restrict
// to upright clips (very-sad falls back to the upright sad set).
function moodHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function pickMoodClip(tokenId: number | string, mood: "happy" | "neutral" | "sad" | "sick", compact: boolean): string {
  let pool = MOOD_CLIP_SETS[mood];
  if (compact) {
    pool = pool.filter(c => c.upright);
    if (!pool.length) pool = MOOD_CLIP_SETS.sad.filter(c => c.upright); // very-sad → upright mope/etc
  }
  if (!pool.length) return FINI_MOOD_IDLE_URL[mood].clip;
  return pool[moodHash(String(tokenId) + mood) % pool.length].clip;
}
// Battle-state → clip map (from the working reference build battles.pixelsolve.net):
export const FINI_STATE_CLIPS = { start:"fin_battle_A1", idle:"fin_battle_C1", attack:"fin_battle_B1", defend:"fin_battle_D3", winner:"fin_battle_F2", loser:"fin_battle_F3" } as const;
export const FINI_BATTLE_CLIPS = ["fin_battle_A1","fin_battle_A1_B1","fin_battle_A1_B2","fin_battle_A1_B3","fin_battle_B1","fin_battle_B1_C1","fin_battle_B1_C2","fin_battle_B2","fin_battle_B2_C1","fin_battle_B2_C2","fin_battle_B3","fin_battle_B3_C1","fin_battle_B3_C2","fin_battle_C1","fin_battle_C1_B1","fin_battle_C1_B2","fin_battle_C1_B3","fin_battle_C1_D2","fin_battle_C1_E1","fin_battle_C2","fin_battle_C2_B1","fin_battle_C2_B2","fin_battle_C2_B3","fin_battle_C2_D3","fin_battle_C2_E2","fin_battle_D1","fin_battle_D1_C1","fin_battle_D1_D1","fin_battle_D1_F1","fin_battle_D1_F2","fin_battle_D2","fin_battle_D2_C2","fin_battle_D2_D2","fin_battle_D2_E1","fin_battle_D2_F3","fin_battle_D3","fin_battle_D3_D3","fin_battle_D3_E2","fin_battle_D3_F3","fin_battle_E1","fin_battle_E1_D1","fin_battle_E2","fin_battle_E2_D2","fin_battle_F2","fin_battle_F3","fin_battle_SP1","fin_battle_SP1_env","fin_battle_SP2"] as const;
