import { lazy, Suspense, useState } from "react";
import { asset } from "../lib/assetUrl";

// Fully isolated from FiniModel / FiniStage / Explore. A broken experimental
// clip here can only break THIS page — never the live mood system.
const AnimLabStage = lazy(() => import("../components/three/AnimLabStage"));

// Experimental clips bundled under public/anim/. { label, glb url, clip name }.
// Converted with the SAME direct-export pipeline as the proven mood idles
// (200 keyframes, 8.33s, source: Folder V2 gen1 shorts on Dropbox).
const LAB_CLIPS: { label: string; url: string; clip: string }[] = [
  { label: "mope (very sad)", url: asset("/anim/fin_mope.glb"),   clip: "fin_mope" },
  { label: "dance (happy)",   url: asset("/anim/fin_dance2.glb"), clip: "fin_dance2" },
];

export function AnimLabPage() {
  const [tokenInput, setTokenInput] = useState("4104");
  const [tokenId, setTokenId] = useState("4104");
  const [sel, setSel] = useState(0);

  const active = LAB_CLIPS[sel];

  return (
    <div style={{ padding: 24, fontFamily: "system-ui, sans-serif", color: "#111" }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Animation Lab</h1>
      <p style={{ marginTop: 4, color: "#555", fontSize: 13 }}>
        Isolated retarget test. Loads one experimental clip on a chosen token —
        no connection to Explore or Fight Club, so nothing here can break those.
      </p>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", margin: "12px 0 16px" }}>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Token ID</span>
          <input
            type="number" min={0} max={9999} value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            style={{ padding: "6px 8px", border: "1px solid #ccc", borderRadius: 6, width: 90 }}
          />
          <button
            type="button"
            onClick={() => setTokenId(String(Math.max(0, Math.min(9999, Number(tokenInput) || 0))))}
            style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #333", background: "#111", color: "#fff", cursor: "pointer" }}
          >
            Load
          </button>
        </label>

        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <span style={{ fontSize: 13, fontWeight: 600, marginRight: 4 }}>Clip</span>
          {LAB_CLIPS.map((c, i) => (
            <button
              key={c.clip}
              type="button"
              onClick={() => setSel(i)}
              style={{
                padding: "6px 12px", borderRadius: 6, cursor: "pointer",
                border: sel === i ? "1px solid #111" : "1px solid #ccc",
                background: sel === i ? "#111" : "#fff",
                color: sel === i ? "#fff" : "#333", fontWeight: 700, fontSize: 12,
              }}
            >
              {c.label}
            </button>
          ))}
        </div>

        <span style={{ fontSize: 12, color: "#777" }}>token #{tokenId} · {active.clip}</span>
      </div>

      <div style={{ width: "100%", height: "70vh", background: "#0e0f12", borderRadius: 12, overflow: "hidden" }}>
        <Suspense fallback={<div style={{ padding: 16, color: "#bbb" }}>Loading 3D…</div>}>
          <AnimLabStage tokenId={tokenId} clipUrl={active.url} clipName={active.clip} />
        </Suspense>
      </div>
    </div>
  );
}
