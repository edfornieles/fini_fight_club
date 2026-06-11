import { lazy, Suspense, type ReactNode } from "react";
import { ArenaErrorBoundary } from "./three/ArenaErrorBoundary";
import { MOOD_META, type FiniLiveMood } from "../lib/finiMood";

// Lazy so three.js stays out of the landing/explore bundle until a Fini is viewed.
const FiniStage = lazy(() => import("./three/FiniStage"));

/**
 * Animated 3D preview of a single Fini, sized to fill its (position: relative)
 * parent. Progressive: `fallback` (the old MP4/GIF) renders while the GLB
 * loads and stays if WebGL or the asset fails, so the panel never goes blank.
 *
 * `interactive: false` disables drag-to-rotate AND pointer events entirely so
 * thumbnails inside buttons/cards don't swallow clicks.
 */
export function Fini3DPreview({ tokenId, fallback, interactive = true, mood }: {
  tokenId: string | number;
  fallback?: ReactNode;
  interactive?: boolean;
  /** Live price mood — drives animation playback speed. */
  mood?: FiniLiveMood;
}) {
  return (
    <ArenaErrorBoundary fallback={fallback} resetKey={tokenId}>
      <Suspense fallback={fallback ?? null}>
        <div style={{ position: "absolute", inset: 0, ...(interactive ? {} : { pointerEvents: "none" as const }) }}>
          <FiniStage tokenId={tokenId} interactive={interactive} timeScale={mood ? MOOD_META[mood].timeScale : 1} mood={mood} />
        </div>
      </Suspense>
    </ArenaErrorBoundary>
  );
}
