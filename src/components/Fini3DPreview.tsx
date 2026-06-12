import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
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
 *
 * Viewport-gated: the WebGL canvas only mounts when the card scrolls on screen
 * (and unmounts when it leaves), so a wallet collection of hundreds of Finis
 * never spawns hundreds of live GL contexts — only the visible handful render.
 */
export function Fini3DPreview({ tokenId, fallback, interactive = true, mood }: {
  tokenId: string | number;
  fallback?: ReactNode;
  interactive?: boolean;
  /** Live price mood — drives the body clip, face, and playback speed. */
  mood?: FiniLiveMood;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => setVisible(e.isIntersecting),
      { rootMargin: "200px" },  // warm up just before it scrolls in
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={hostRef} style={{ position: "absolute", inset: 0, ...(interactive ? {} : { pointerEvents: "none" as const }) }}>
      {visible ? (
        <ArenaErrorBoundary fallback={fallback} resetKey={tokenId}>
          <Suspense fallback={fallback ?? null}>
            <div style={{ position: "absolute", inset: 0 }}>
              <FiniStage tokenId={tokenId} interactive={interactive} timeScale={mood ? MOOD_META[mood].timeScale : 1} mood={mood} compact={!interactive} />
            </div>
          </Suspense>
        </ArenaErrorBoundary>
      ) : (
        fallback ?? null
      )}
    </div>
  );
}
