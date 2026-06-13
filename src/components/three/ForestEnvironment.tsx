/**
 * Forest backdrop for the Crypto Arena duel.
 *
 * Uses a real CC0 forest HDRI from Poly Haven (public/env/) as the scene
 * background + a gentle image-based fill, so the Finis fight in a sunlit forest
 * clearing instead of a blank void. A soft mossy ground patch grounds them on
 * the forest floor without a hard disc edge. The character KEY lighting stays
 * in CryptoArenaBattle3D (directional lights) — the HDRI only softens the fill,
 * so the Finis read the same as before, just in a richer world.
 *
 * Swap HDRI = change ENV_FILE: 'mossy_forest_2k.hdr' (lush green) or
 * 'forest_grove_2k.hdr' (brighter sunlit clearing). Both CC0, no attribution.
 */
import { useMemo } from "react";
import { Environment } from "@react-three/drei";
import { CanvasTexture } from "three";
import { asset } from "../../lib/assetUrl";

const ENV_FILE = "mossy_forest_2k.hdr";

export function ForestEnvironment() {
  // Soft, edge-faded mossy patch so the fighters stand on the forest floor
  // (the HDRI floor is at infinity) with no visible disc rim.
  const groundTex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const ctx = c.getContext("2d")!;
    const g = ctx.createRadialGradient(128, 128, 16, 128, 128, 128);
    g.addColorStop(0, "rgba(34,42,22,0.50)");
    g.addColorStop(0.55, "rgba(34,42,22,0.26)");
    g.addColorStop(1, "rgba(34,42,22,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    const t = new CanvasTexture(c);
    return t;
  }, []);

  return (
    <>
      <Environment
        files={asset(`/env/${ENV_FILE}`)}
        background
        backgroundBlurriness={0.22}   // gentle DOF so the duel pops, forest still legible
        backgroundIntensity={1.0}
        environmentIntensity={0.55}   // soft forest fill; key lights still define the Finis
      />
      {/* Forest-floor patch under the fighters. */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.015, -0.3]}>
        <planeGeometry args={[15, 13]} />
        <meshBasicMaterial map={groundTex} transparent depthWrite={false} />
      </mesh>
    </>
  );
}
