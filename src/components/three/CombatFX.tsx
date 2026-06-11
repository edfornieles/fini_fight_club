import { Html } from "@react-three/drei";

/**
 * Floating combat text, the convention from Pokémon / Super Auto Pets / classic
 * RPGs: numbers pop at the struck fighter and drift up while fading.
 *
 *  - damage  → red "-12", bigger with 💥 on crit
 *  - heal    → green "+8 💚"
 *  - item    → gold "✨ Item"
 *  - ko      → dark-red "KO!" stamp
 *
 * Rendered as DOM via drei <Html> anchored to 3D slot positions, so the text
 * stays crisp at any zoom and animates with plain CSS.
 */

export type FxKind = "damage" | "heal" | "item" | "ko";

export type FxEvent = {
  key: number;
  position: [number, number, number];
  kind: FxKind;
  text: string;
};

const FX_STYLE: Record<FxKind, { color: string; size: number; anim: string }> = {
  damage: { color: "#dc2626", size: 24, anim: "fini-fct" },
  heal:   { color: "#16a34a", size: 22, anim: "fini-fct" },
  item:   { color: "#b45309", size: 20, anim: "fini-fct" },
  ko:     { color: "#7f1d1d", size: 30, anim: "fini-fct-ko" },
};

const KEYFRAMES = `
@keyframes fini-fct {
  0%   { opacity: 0; transform: translateY(10px) scale(0.6); }
  14%  { opacity: 1; transform: translateY(0) scale(1.18); }
  28%  { transform: translateY(-4px) scale(1); }
  100% { opacity: 0; transform: translateY(-48px) scale(0.95); }
}
@keyframes fini-fct-ko {
  0%   { opacity: 0; transform: scale(2.2) rotate(-6deg); }
  18%  { opacity: 1; transform: scale(1) rotate(-6deg); }
  70%  { opacity: 1; transform: scale(1) rotate(-6deg); }
  100% { opacity: 0; transform: scale(0.9) rotate(-6deg) translateY(-20px); }
}`;

export function CombatFX({ events }: { events: FxEvent[] }) {
  return (
    <>
      {events.map(e => {
        const s = FX_STYLE[e.kind];
        return (
          <Html key={e.key} position={e.position} center zIndexRange={[40, 0]} style={{ pointerEvents: "none" }}>
            <style>{KEYFRAMES}</style>
            <div style={{
              animation: `${s.anim} 1.15s ease-out forwards`,
              fontWeight: 900,
              fontSize: s.size,
              color: s.color,
              fontFamily: "'Nunito', system-ui, sans-serif",
              whiteSpace: "nowrap",
              textShadow: "0 1px 0 rgba(255,255,255,0.9), 0 2px 8px rgba(255,255,255,0.55)",
              WebkitTextStroke: "0.5px rgba(255,255,255,0.6)",
            }}>
              {e.text}
            </div>
          </Html>
        );
      })}
    </>
  );
}
