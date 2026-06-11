/**
 * Mood faces via face-texture mouth swap.
 *
 * Every Fini GLB has a dedicated "faceMesh" material whose 512×512 texture is
 * the canonical happy face (pixel eyes + smile + blush). The original 2D
 * renders express mood by changing the face — neutral = flat mouth, sad =
 * frown (x_base_anims reference on the Finiliar Storage drive). We redraw ONLY
 * the mouth region on a canvas copy of each Fini's own texture, so per-token
 * eyes, cheeks and palette are preserved.
 */
import { CanvasTexture, type Material, Mesh, MeshStandardMaterial, type Object3D } from "three";
import type { FiniLiveMood } from "./finiMood";

// Mouth zone in the shared 512×512 face UV layout (clear of eyes and cheeks).
const MOUTH = { x: 178, y: 232, w: 156, h: 92 };

function drawMouth(ctx: CanvasRenderingContext2D, mood: FiniLiveMood) {
  ctx.strokeStyle = "#161616";
  ctx.lineWidth = 17;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  if (mood === "neutral") {
    ctx.moveTo(214, 272);
    ctx.lineTo(298, 272);
  } else if (mood === "sad") {
    // Frown — corners low, middle high (∩), per the x_base_sad reference.
    ctx.moveTo(208, 292);
    ctx.quadraticCurveTo(256, 246, 304, 292);
  } else if (mood === "sick") {
    // Queasy squiggle.
    ctx.moveTo(204, 278);
    ctx.lineTo(230, 262);
    ctx.lineTo(256, 282);
    ctx.lineTo(282, 262);
    ctx.lineTo(308, 278);
  }
  ctx.stroke();
}

// One redrawn texture per (source texture, mood) — shared across mounts.
const texCache = new Map<string, CanvasTexture>();

type FaceMesh = Mesh & { __origFaceMat?: Material | Material[] };

/**
 * Apply (or revert, for "happy") the mood face on a cloned Fini scene.
 * Clones the faceMesh material before touching it so the GLTF cache that
 * other canvases share is never mutated.
 */
export function applyMoodFace(root: Object3D, mood: FiniLiveMood) {
  root.traverse(o => {
    const mesh = o as FaceMesh;
    if (!mesh.isMesh || !mesh.material) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach((m, mi) => {
      const mat = m as MeshStandardMaterial;
      if (mat?.name !== "faceMesh") return;

      if (mood === "happy") {
        // The original texture IS the happy face — restore if we swapped.
        if (mesh.__origFaceMat) {
          mesh.material = mesh.__origFaceMat;
          delete mesh.__origFaceMat;
        }
        return;
      }
      const srcMap = (mesh.__origFaceMat
        ? ((Array.isArray(mesh.__origFaceMat) ? mesh.__origFaceMat[mi] : mesh.__origFaceMat) as MeshStandardMaterial).map
        : mat.map);
      const img = srcMap?.image as (CanvasImageSource & { width: number; height: number }) | undefined;
      if (!srcMap || !img?.width) return;

      const key = `${srcMap.uuid}:${mood}`;
      let tex = texCache.get(key);
      if (!tex) {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        ctx.save();
        ctx.scale(canvas.width / 512, canvas.height / 512);
        ctx.clearRect(MOUTH.x, MOUTH.y, MOUTH.w, MOUTH.h);
        drawMouth(ctx, mood);
        ctx.restore();
        tex = new CanvasTexture(canvas);
        tex.flipY = srcMap.flipY;
        tex.colorSpace = srcMap.colorSpace;
        texCache.set(key, tex);
      }
      mesh.__origFaceMat ??= mesh.material;
      const swapped = mat.clone();
      swapped.map = tex;
      if (Array.isArray(mesh.material)) {
        const arr = [...mesh.material];
        arr[mi] = swapped;
        mesh.material = arr;
      } else {
        mesh.material = swapped;
      }
    });
  });
}
