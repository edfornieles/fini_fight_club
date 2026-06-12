import { lazy, Suspense, useState } from "react";
import { asset } from "../lib/assetUrl";

// Fully isolated from FiniModel / FiniStage / Explore. A broken experimental
// clip here can only break THIS page — never the live mood system.
const AnimLabStage = lazy(() => import("../components/three/AnimLabStage"));

// Verified clips (retargeted via scripts/retarget.py, render-checked headless).
// Grouped by the mood tier they'd drive. { label, clip }.
const GROUPS: { mood: string; clips: { label: string; clip: string }[] }[] = [
  { mood: "😀 Happy / great", clips: [
    { label: "dance", clip: "fin_dance" },
    { label: "dancing w/ stars", clip: "fin_dancingwithstars" },
    { label: "huge surprise", clip: "fin_hugesurprise" },
  ]},
  { mood: "😐 Neutral", clips: [
    { label: "neutral idle", clip: "fin_neutral_idle" },
    { label: "bored", clip: "fin_bored" },
    { label: "hungry stomach", clip: "fin_hungrystomach" },
  ]},
  { mood: "🙁 Sad", clips: [
    { label: "sad idle", clip: "fin_sad_idle" },
    { label: "mope", clip: "fin_mope" },
    { label: "angry", clip: "fin_angry" },
    { label: "cough", clip: "fin_cough" },
    { label: "distress sway", clip: "fin_distresssway" },
  ]},
  { mood: "🤢 Very sad / dying", clips: [
    { label: "supersad idle", clip: "fin_supersad_idle" },
    { label: "near dead", clip: "fin_neardead" },
    { label: "rain crying", clip: "fin_raincrying" },
    { label: "rain desperate", clip: "fin_raindesperate" },
    { label: "rolling in rain", clip: "fin_rollingaroundtherain" },
    { label: "banging head", clip: "fin_banginghead" },
  ]},
];
const ALL = GROUPS.flatMap(g => g.clips);
const urlFor = (clip: string) => asset(`/anim/${clip.replace(/^fin_/, "fin_")}.glb`);

export function AnimLabPage() {
  const [tokenInput, setTokenInput] = useState("4104");
  const [tokenId, setTokenId] = useState("4104");
  const [clip, setClip] = useState("fin_dance");

  return (
    <div style={{ padding: 24, fontFamily: "system-ui, sans-serif", color: "#111" }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Animation Lab</h1>
      <p style={{ marginTop: 4, color: "#555", fontSize: 13 }}>
        {ALL.length} verified clips, grouped by the mood tier they'd drive. Isolated
        from Explore / Fight Club. Pick a token, then a clip.
      </p>

      <div style={{ display: "flex", gap: 12, alignItems: "center", margin: "12px 0 12px" }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Token ID</span>
        <input
          type="number" min={0} max={9999} value={tokenInput}
          onChange={(e) => setTokenInput(e.target.value)}
          style={{ padding: "6px 8px", border: "1px solid #ccc", borderRadius: 6, width: 90 }}
        />
        <button type="button"
          onClick={() => setTokenId(String(Math.max(0, Math.min(9999, Number(tokenInput) || 0))))}
          style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #333", background: "#111", color: "#fff", cursor: "pointer" }}>
          Load
        </button>
        <span style={{ fontSize: 12, color: "#777" }}>token #{tokenId} · {clip}</span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 14 }}>
        {GROUPS.map(g => (
          <div key={g.mood} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#444" }}>{g.mood}</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, maxWidth: 280 }}>
              {g.clips.map(c => (
                <button key={c.clip} type="button" onClick={() => setClip(c.clip)}
                  style={{
                    padding: "5px 10px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700,
                    border: clip === c.clip ? "1px solid #111" : "1px solid #ccc",
                    background: clip === c.clip ? "#111" : "#fff",
                    color: clip === c.clip ? "#fff" : "#333",
                  }}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ width: "100%", height: "62vh", background: "#0e0f12", borderRadius: 12, overflow: "hidden" }}>
        <Suspense fallback={<div style={{ padding: 16, color: "#bbb" }}>Loading 3D…</div>}>
          <AnimLabStage tokenId={tokenId} clipUrl={urlFor(clip)} clipName={clip} />
        </Suspense>
      </div>
    </div>
  );
}
