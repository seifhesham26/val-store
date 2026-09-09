/**
 * Crop geometry, kept separate from React.
 *
 * The cropper UI (`react-easy-crop`) reports a rectangle in the *source
 * image's* pixel space. Turning that into canvas dimensions and a
 * `drawImage` source rectangle is arithmetic with several edge cases —
 * a rectangle that runs off the source, a 40-megapixel phone photo whose
 * crop would still encode past UploadThing's 4MB route limit — so it lives
 * here where it can be tested. There is no DOM testing library in this repo;
 * `src/lib/variant-stock-registry.ts` is the same pattern.
 */

/** A rectangle in the source image's own pixel space. */
export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CropDraw {
  /** The output canvas size. */
  canvas: { width: number; height: number };
  /** The `drawImage` source rectangle, clamped to the source bounds. */
  source: CropArea;
  /** canvas / source ratio. 1 when no downscale was needed. */
  scale: number;
}

/**
 * Longest edge of an encoded crop, in pixels.
 *
 * The `productImage` route caps uploads at 4MB. A 1600px-long-edge WebP at
 * quality 0.9 lands far under that even for a busy photograph, so this is a
 * guard against pathological sources rather than a quality decision.
 */
export const MAX_CROP_EDGE = 1600;

export function resolveCropDraw(
  natural: { width: number; height: number },
  crop: CropArea,
  maxEdge: number
): CropDraw {
  if (natural.width <= 0 || natural.height <= 0) {
    throw new Error("resolveCropDraw: source image has no area");
  }
  if (crop.width <= 0 || crop.height <= 0) {
    throw new Error("resolveCropDraw: crop has no area");
  }

  // Clamp the origin into the source, keeping the far edge where it was so
  // a rectangle dragged off the left does not also shrink on the right.
  const right = crop.x + crop.width;
  const bottom = crop.y + crop.height;

  const x = Math.max(0, Math.min(crop.x, natural.width));
  const y = Math.max(0, Math.min(crop.y, natural.height));
  const width = Math.min(right, natural.width) - x;
  const height = Math.min(bottom, natural.height) - y;

  if (width <= 0 || height <= 0) {
    throw new Error("resolveCropDraw: crop lies outside the source image");
  }

  const scale = Math.min(1, maxEdge / Math.max(width, height));

  return {
    canvas: {
      width: Math.round(width * scale),
      height: Math.round(height * scale),
    },
    source: { x, y, width, height },
    scale,
  };
}
