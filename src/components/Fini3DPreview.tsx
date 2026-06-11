import { lazy, Suspense, type ReactNode } from "react";
import { ArenaErrorBoundary } from "./three/ArenaErrorBoundary";

// Lazy so three.js stays out of the landing/explore bundle until a Fini is viewed.
const FiniStage = lazy(() => import("./three/FiniStage"));

/**
 * Animated 3D preview of a single Fini, sized to fill its (position: relative)
 * parent. Progressive: `fallback` (the old MP4/GIF) renders while the GLB
 * loads and stays if WebGL or the asset fails, so the panel never goes blank.
 */
export function Fini3DPreview({ tokenId, fallback }: { tokenId: string | number; fallback?: ReactNode }) {
  return (
    <ArenaErrorBoundary fallback={fallback} resetKey={tokenId}>
      <Suspense fallback={fallback ?? null}>
        <div style={{ position: "absolute", inset: 0 }}>
          <FiniStage tokenId={tokenId} />
        </div>
      </Suspense>
    </ArenaErrorBoundary>
  );
}
