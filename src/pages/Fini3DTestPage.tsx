import { lazy, Suspense, useState } from "react";
import { FINI_BATTLE_CLIPS, FINI_IDLE_CLIP } from "../lib/finiAssets";
import type { FiniLiveMood } from "../lib/finiMood";

const FiniStage = lazy(() => import("../components/three/FiniStage"));

// "" = let mood drive the idle; otherwise force a specific clip.
const CLIPS = ["", FINI_IDLE_CLIP, ...FINI_BATTLE_CLIPS] as const;
const MOODS: FiniLiveMood[] = ["happy", "neutral", "sad", "sick"];

export function Fini3DTestPage() {
  const [tokenInput, setTokenInput] = useState("1");
  const [tokenId, setTokenId] = useState("1");
  const [clip, setClip] = useState<string>("");
  const [mood, setMood] = useState<FiniLiveMood>("happy");

  return (
    <div style={{ padding: 24, fontFamily: "system-ui, sans-serif", color: "#111" }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Fini 3D Test</h1>
      <p style={{ marginTop: 4, color: "#555", fontSize: 13 }}>
        Token 0–9999. Switch clips to verify shared-animation retargeting.
      </p>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", margin: "12px 0 16px" }}>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Token ID</span>
          <input
            type="number"
            min={0}
            max={9999}
            value={tokenInput}
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

        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Clip</span>
          <select
            value={clip}
            onChange={(e) => setClip(e.target.value)}
            style={{ padding: "6px 8px", border: "1px solid #ccc", borderRadius: 6 }}
          >
            {CLIPS.map((name) => (
              <option key={name} value={name}>{name || "— (mood idle)"}</option>
            ))}
          </select>
        </label>

        {/* Mood drives the idle clip when Clip is "— (mood idle)":
            happy=character clip, neutral/sad/sick = converted FBX clips. */}
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <span style={{ fontSize: 13, fontWeight: 600, marginRight: 4 }}>Mood</span>
          {MOODS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMood(m); setClip(""); }}
              style={{
                padding: "6px 12px", borderRadius: 6, cursor: "pointer",
                border: mood === m ? "1px solid #111" : "1px solid #ccc",
                background: mood === m ? "#111" : "#fff",
                color: mood === m ? "#fff" : "#333", fontWeight: 700, fontSize: 12,
              }}
            >
              {m}
            </button>
          ))}
        </div>

        <span style={{ fontSize: 12, color: "#777" }}>token #{tokenId}</span>
      </div>

      <div style={{ width: "100%", height: "70vh", background: "#0e0f12", borderRadius: 12, overflow: "hidden" }}>
        <Suspense fallback={<div style={{ padding: 16, color: "#bbb" }}>Loading 3D…</div>}>
          <FiniStage tokenId={tokenId} clip={clip || undefined} mood={mood} />
        </Suspense>
      </div>
    </div>
  );
}
