# Product Image Fill and Crop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A wide or oddly-shaped product photo renders as a deliberate, full-bleed tile everywhere on the site instead of being chopped by `object-cover`, and an admin can optionally crop to 3:4 before publishing.

**Architecture:** One shared `<ProductImage>` renders two stacked `next/image` layers into the caller's existing frame — a blurred `object-cover` backdrop and the whole photo on `object-contain`. Ten consumers switch to it. Separately, the admin upload flow moves off `UploadDropzone` onto an explicit `useUploadThing` flow with an optional 3:4 cropper, whose maths live in a pure, unit-tested module.

**Tech Stack:** Next.js 16 App Router, React 19 (React Compiler on), TypeScript strict, Tailwind 4, UploadThing v7, `react-easy-crop`, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-08-product-image-fill-and-crop-design.md`

## Global Constraints

- **Do not commit.** Every task ends at "verification green". The repo owner reviews and commits. This overrides any habit of committing per task.
- Package manager is **pnpm**. Never `npm`/`yarn`.
- Prettier: double quotes, semicolons, 80 columns, es5 trailing commas, LF endings. `lint-staged` will reformat, but write it correctly.
- `pnpm lint` baseline is **0 problems**. Any new warning is a regression.
- `pnpm test` baseline is **469 passing across 37 files**. Never let that number drop.
- Before trusting `pnpm type-check`, run `rm -rf .next` first. A stale `.next/dev/types/routes.d.ts` invents errors about routes that no longer exist.
- Unit tests are colocated: `src/lib/foo.ts` → `src/lib/foo.test.ts`. There is **no DOM testing library** — do not add one, and do not write component tests. Logic worth testing gets extracted into a plain module.
- Import alias is `@/*` → `src/*`.
- Do **not** modify `product_images`, `src/server/routers/admin/images.ts`, `ProductImageEntity`, or any use case. This work is rendering and upload-flow only.

---

### Task 1: Crop maths module

The pure half of the cropper, built first and alone so it is testable without a browser.

**Files:**

- Create: `src/lib/image-crop.ts`
- Test: `src/lib/image-crop.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `interface CropArea { x: number; y: number; width: number; height: number }`
  - `interface CropDraw { canvas: { width: number; height: number }; source: CropArea; scale: number }`
  - `function resolveCropDraw(natural: { width: number; height: number }, crop: CropArea, maxEdge: number): CropDraw`
  - `const MAX_CROP_EDGE = 1600`

- [ ] **Step 1: Write the failing test**

Create `src/lib/image-crop.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { MAX_CROP_EDGE, resolveCropDraw } from "./image-crop";

describe("resolveCropDraw", () => {
  it("produces a 3:4 canvas from a 3:4 crop of a wide source", () => {
    const draw = resolveCropDraw(
      { width: 2040, height: 528 },
      { x: 822, y: 0, width: 396, height: 528 },
      MAX_CROP_EDGE
    );

    expect(draw.scale).toBe(1);
    expect(draw.canvas).toEqual({ width: 396, height: 528 });
    expect(draw.canvas.width / draw.canvas.height).toBeCloseTo(0.75, 5);
  });

  it("clamps a crop that runs past the source bounds", () => {
    const draw = resolveCropDraw(
      { width: 100, height: 100 },
      { x: 50, y: 50, width: 200, height: 200 },
      MAX_CROP_EDGE
    );

    expect(draw.source).toEqual({ x: 50, y: 50, width: 50, height: 50 });
    expect(draw.canvas).toEqual({ width: 50, height: 50 });
  });

  it("clamps a negative origin to zero without losing the far edge", () => {
    const draw = resolveCropDraw(
      { width: 100, height: 100 },
      { x: -10, y: -10, width: 50, height: 50 },
      MAX_CROP_EDGE
    );

    expect(draw.source).toEqual({ x: 0, y: 0, width: 50, height: 50 });
  });

  it("scales down a crop whose long edge exceeds maxEdge, preserving ratio", () => {
    const draw = resolveCropDraw(
      { width: 4000, height: 5000 },
      { x: 0, y: 0, width: 3000, height: 4000 },
      1600
    );

    expect(draw.scale).toBeCloseTo(0.4, 5);
    expect(draw.canvas).toEqual({ width: 1200, height: 1600 });
    expect(draw.canvas.width / draw.canvas.height).toBeCloseTo(0.75, 5);
  });

  it("leaves a crop already within maxEdge at scale 1", () => {
    const draw = resolveCropDraw(
      { width: 2000, height: 2000 },
      { x: 0, y: 0, width: 600, height: 800 },
      1600
    );

    expect(draw.scale).toBe(1);
    expect(draw.canvas).toEqual({ width: 600, height: 800 });
  });

  it("rejects a source with no area", () => {
    expect(() =>
      resolveCropDraw(
        { width: 0, height: 100 },
        { x: 0, y: 0, width: 10, height: 10 },
        MAX_CROP_EDGE
      )
    ).toThrow(/source/i);
  });

  it("rejects a crop with no area rather than returning a 0x0 canvas", () => {
    expect(() =>
      resolveCropDraw(
        { width: 100, height: 100 },
        { x: 0, y: 0, width: 0, height: 10 },
        MAX_CROP_EDGE
      )
    ).toThrow(/crop/i);
  });

  it("rejects a crop that starts outside the source entirely", () => {
    expect(() =>
      resolveCropDraw(
        { width: 100, height: 100 },
        { x: 200, y: 0, width: 50, height: 50 },
        MAX_CROP_EDGE
      )
    ).toThrow(/crop/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/lib/image-crop.test.ts`
Expected: FAIL — cannot resolve `./image-crop`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/image-crop.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/lib/image-crop.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Verify nothing else moved**

Run: `pnpm test`
Expected: 469 + 8 = **477 passing**, 0 failing.

---

### Task 2: The `ProductImage` component

**Files:**

- Create: `src/components/shared/ProductImage.tsx`

**Interfaces:**

- Consumes: `unoptimizedFor` from `@/lib/image-hosts`, `cn` from `@/lib/utils`.
- Produces: `function ProductImage(props: ProductImageProps)` where

  ```ts
  interface ProductImageProps {
    src: string;
    alt: string;
    sizes: string;
    priority?: boolean;
    className?: string;
  }
  ```

  It renders only absolutely-positioned layers and adds **no wrapper element**. The caller keeps supplying `relative … overflow-hidden` on its own frame.

- [ ] **Step 1: Write the component**

Create `src/components/shared/ProductImage.tsx`:

```tsx
import Image from "next/image";
import { cn } from "@/lib/utils";
import { unoptimizedFor } from "@/lib/image-hosts";

interface ProductImageProps {
  src: string;
  alt: string;
  /**
   * Passed to BOTH layers unchanged. See "one download, not two" below —
   * this is not an oversight.
   */
  sizes: string;
  priority?: boolean;
  /** Extra classes for the foreground layer only, e.g. hover transforms. */
  className?: string;
}

/**
 * A product photo that fills a fixed-aspect frame without ever cropping it.
 *
 * The storefront is standardised on 3:4 portrait, and every frame used to
 * fill itself with `object-cover`. On a 3.9:1 source — the `coming-soon`
 * wordmark used as a product image is the case that prompted this — that
 * keeps a narrow vertical slice and throws the picture away.
 *
 * Instead: the whole image on `object-contain`, over a blurred, scaled copy
 * of itself on `object-cover` filling the letterbox bars. Any aspect ratio
 * then reads as a deliberate tile.
 *
 * **It is self-disabling.** For a source already at the frame's ratio there
 * are no bars, `object-contain` and `object-cover` paint identically, and the
 * blur layer is completely occluded. So there is no aspect detection, no
 * conditional, and no per-image configuration — one code path is correct for
 * a square, a portrait, a panorama and a 3:4 product shot alike.
 *
 * ## One download, not two
 *
 * Both layers take the identical `src` AND the identical `sizes`. Next then
 * generates the same `srcset` for both, the browser picks the same candidate
 * URL for both, and the second request is served from cache — two layers,
 * one download.
 *
 * The tempting change is to give the blur layer something like
 * `sizes="64px"`, reasoning that a blurred backdrop needs no resolution.
 * That selects a *different* srcset entry, which is a different URL, which
 * is a second network request. It makes the page slower while looking like
 * an optimisation. Do not make it.
 *
 * `scale-110` is also load-bearing: `blur-2xl` leaves a soft translucent
 * edge, and without the overscan a pale halo traces the frame.
 */
export function ProductImage({
  src,
  alt,
  sizes,
  priority,
  className,
}: ProductImageProps) {
  const unoptimized = unoptimizedFor(src);

  return (
    <>
      <Image
        src={src}
        alt=""
        aria-hidden
        fill
        sizes={sizes}
        className="object-cover scale-110 blur-2xl"
        unoptimized={unoptimized}
      />
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        loading={priority ? "eager" : "lazy"}
        className={cn("object-contain", className)}
        unoptimized={unoptimized}
      />
    </>
  );
}
```

- [ ] **Step 2: Verify it compiles and lints**

Run: `rm -rf .next && pnpm type-check && pnpm lint`
Expected: type-check clean, lint **0 problems**.

---

### Task 3: Migrate the storefront surfaces

The four places a customer browsing the catalogue sees a product photo.

**Files:**

- Modify: `src/components/products/ProductCard.tsx` (the `<Image>` inside the `aspect-3/4` frame)
- Modify: `src/components/products/product-detail/ProductImageGallery.tsx` (main image and thumbnails)
- Modify: `src/components/home/ServerFeaturedCategories.tsx`
- Modify: `src/components/account/wishlist/WishlistGrid.tsx`

**Interfaces:**

- Consumes: `ProductImage` from Task 2.
- Produces: nothing new.

- [ ] **Step 1: ProductCard**

Replace the `<Image>` inside `<div className="relative aspect-3/4 overflow-hidden bg-val-steel">` with:

```tsx
<ProductImage
  src={primaryImage}
  alt={name}
  sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
  priority={priority}
  className="transition-transform duration-300 group-hover:scale-105"
/>
```

Add `import { ProductImage } from "@/components/shared/ProductImage";` and remove the now-unused `Image` / `unoptimizedFor` imports **only if nothing else in the file uses them** — check before deleting.

Keep the `: (` gradient fallback branch for a missing `primaryImage` exactly as it is. Keep the badges and wishlist button, which are siblings, unchanged.

Note the hover effect now scales the photo while the blurred backdrop stays still. That is the intended result, not a regression.

- [ ] **Step 2: ProductImageGallery — main image**

Replace the main `<Image>` (inside the `aspect-3/4` frame) with:

```tsx
<ProductImage
  src={selectedImage}
  alt={productName}
  sizes="(max-width: 768px) 100vw, 50vw"
  priority
/>
```

- [ ] **Step 3: ProductImageGallery — thumbnails**

Replace the thumbnail `<Image>` inside the `aspect-square` button with:

```tsx
<ProductImage
  src={img}
  alt={`${productName} thumbnail ${i + 1}`}
  sizes="(max-width: 768px) 25vw, 12vw"
/>
```

- [ ] **Step 4: ServerFeaturedCategories and WishlistGrid**

Same substitution in each: keep the existing frame div and its classes, swap the `<Image>` for a `<ProductImage>` carrying the same `src`, `alt` and `sizes` that `<Image>` had.

- [ ] **Step 5: Verify**

Run: `rm -rf .next && pnpm type-check && pnpm lint && pnpm test`
Expected: type-check clean, lint 0 problems, 477 tests passing.

- [ ] **Step 6: Look at it**

Run: `pnpm dev`, open `/` and any `/collections/*`, and confirm a wide image now shows in full against a blurred backdrop rather than a cropped strip. This is a visual change; every previous bug in this area was found by a person looking at a screen, not by a test.

---

### Task 4: Migrate the small-frame surfaces

Cart, checkout, search and the two admin screens. Mechanical, and separated from Task 3 so a reviewer can accept the storefront change independently.

**Files:**

- Modify: `src/components/cart/CartItem.tsx`
- Modify: `src/components/cart/CartStockDialog.tsx`
- Modify: `src/components/checkout/CheckoutOrderSummary.tsx`
- Modify: `src/components/search/SearchDialog.tsx`
- Modify: `src/components/admin/products/list/ProductsTable.tsx`
- Modify: `src/components/admin/products/create/ImageUploadSection.tsx` (the gallery preview tiles only — not the upload dropzone, which Task 5 replaces)

**Interfaces:**

- Consumes: `ProductImage` from Task 2.
- Produces: nothing new.

- [ ] **Step 1: Substitute in each file**

For each: keep the existing frame element and its classes; replace the `<Image … className="object-cover" />` with a `<ProductImage>` carrying the same `src`, `alt` and `sizes`. Drop `unoptimized` / `unoptimizedFor` at the call site — `ProductImage` decides that internally now.

If a file has no `sizes` on its `<Image>`, add one appropriate to the rendered box (e.g. `sizes="64px"` for a 64px cart thumbnail). `sizes` is required by `ProductImage`.

- [ ] **Step 2: Verify**

Run: `rm -rf .next && pnpm type-check && pnpm lint && pnpm test`
Expected: type-check clean, lint 0 problems, 477 tests passing.

---

### Task 5: Admin crop before upload

**Files:**

- Modify: `src/components/ui/upload.tsx` (add the `useUploadThing` helper)
- Create: `src/components/admin/products/create/CropDialog.tsx`
- Modify: `src/components/admin/products/create/ImageUploadSection.tsx` (replace `UploadDropzone`)
- Modify: `package.json` (add `react-easy-crop`)

**Interfaces:**

- Consumes: `resolveCropDraw`, `MAX_CROP_EDGE` from Task 1.
- Produces:
  - `export const { useUploadThing } = generateReactHelpers<OurFileRouter>();` from `@/components/ui/upload`
  - `function CropDialog(props: { file: File | null; onResolve: (file: File | null) => void }): JSX.Element` — `onResolve` receives the (possibly cropped) `File`, or `null` when the admin skips that file.

- [ ] **Step 1: Add the dependency**

Run: `pnpm add react-easy-crop`

- [ ] **Step 2: Expose `useUploadThing`**

In `src/components/ui/upload.tsx`, add `generateReactHelpers` to the existing import from `@uploadthing/react` and append:

```ts
export const { useUploadThing } = generateReactHelpers<OurFileRouter>();
```

- [ ] **Step 3: Write the crop dialog**

Create `src/components/admin/products/create/CropDialog.tsx`. It is a client component. Structure:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import Cropper from "react-easy-crop";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  MAX_CROP_EDGE,
  resolveCropDraw,
  type CropArea,
} from "@/lib/image-crop";

interface CropDialogProps {
  file: File | null;
  onResolve: (file: File | null) => void;
}

export function CropDialog({ file, onResolve }: CropDialogProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<CropArea | null>(null);
  const [busy, setBusy] = useState(false);

  // An object URL is a live handle into the browser's blob store; leaking
  // one per upload holds the whole file in memory for the tab's lifetime.
  useEffect(() => {
    if (!file) {
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setArea(null);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const applyCrop = useCallback(async () => {
    if (!file || !objectUrl || !area) return;
    setBusy(true);
    try {
      onResolve(await cropToFile(file, objectUrl, area));
    } finally {
      setBusy(false);
    }
  }, [file, objectUrl, area, onResolve]);

  return (
    <Dialog open={!!file} onOpenChange={(open) => !open && onResolve(null)}>
      <DialogContent className="bg-background text-foreground sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Frame this image</DialogTitle>
          <DialogDescription>
            The storefront shows product photos in a 3:4 frame. Crop to fit it,
            or use the image as-is — an uncropped image is shown whole against a
            blurred backdrop, never cut off.
          </DialogDescription>
        </DialogHeader>

        <div className="relative h-80 w-full bg-muted">
          {objectUrl && (
            <Cropper
              image={objectUrl}
              crop={crop}
              zoom={zoom}
              aspect={3 / 4}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_, pixels) => setArea(pixels)}
            />
          )}
        </div>

        <Slider
          value={[zoom]}
          min={1}
          max={3}
          step={0.01}
          onValueChange={([z]) => setZoom(z)}
          aria-label="Zoom"
        />

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onResolve(null)}
            disabled={busy}
          >
            Skip this image
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="bg-transparent"
              onClick={() => file && onResolve(file)}
              disabled={busy}
            >
              Use as-is
            </Button>
            <Button type="button" onClick={applyCrop} disabled={busy || !area}>
              Apply crop
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

`DialogContent` is a Radix portal: it attaches to `<body>` and escapes the admin's `ThemeProvider`. It must set **both** halves of a colour pair — `bg-background text-foreground` above — never a background alone. `variant="outline"` needs the explicit `bg-transparent` or it renders as a white pill. Both are documented traps in `CLAUDE.md`.

Then, in the same file, the canvas half:

```tsx
async function cropToFile(
  file: File,
  objectUrl: string,
  area: CropArea
): Promise<File> {
  const img = await loadImage(objectUrl);
  const draw = resolveCropDraw(
    { width: img.naturalWidth, height: img.naturalHeight },
    area,
    MAX_CROP_EDGE
  );

  const canvas = document.createElement("canvas");
  canvas.width = draw.canvas.width;
  canvas.height = draw.canvas.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get a 2D canvas context");

  ctx.drawImage(
    img,
    draw.source.x,
    draw.source.y,
    draw.source.width,
    draw.source.height,
    0,
    0,
    draw.canvas.width,
    draw.canvas.height
  );

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.9)
  );
  if (!blob) throw new Error("Could not encode the cropped image");

  const name = file.name.replace(/\.[^.]+$/, "") + ".webp";
  return new File([blob], name, { type: "image/webp" });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read the image"));
    img.src = src;
  });
}
```

- [ ] **Step 4: Check the Slider primitive exists**

Run: `ls src/components/ui/slider.tsx`
If absent, run `pnpm dlx shadcn@latest add slider`. Six shadcn primitives were deleted from this repo, so do not assume any of them is present.

- [ ] **Step 5: Rewire `ImageUploadSection`**

Replace the `<UploadDropzone …>` block with a file input plus the queue:

```tsx
const { startUpload, isUploading } = useUploadThing("productImage", {
  onClientUploadComplete: (res) =>
    handleUploadComplete(res.map((f) => ({ url: f.ufsUrl, name: f.name }))),
  onUploadError: (error: Error) =>
    toast.error(`Upload failed: ${error.message}`),
});

const [queue, setQueue] = useState<File[]>([]);
const [ready, setReady] = useState<File[]>([]);

// Files are reviewed one at a time; the head of the queue is what the
// dialog is showing.
const handleResolve = (result: File | null) => {
  const rest = queue.slice(1);
  const collected = result ? [...ready, result] : ready;
  setQueue(rest);
  if (rest.length === 0) {
    setReady([]);
    if (collected.length > 0) void startUpload(collected);
  } else {
    setReady(collected);
  }
};
```

with a `<input type="file" multiple accept="image/*">` (styled as a button) that sets `queue` from `Array.from(e.target.files ?? [])`, and `<CropDialog file={queue[0] ?? null} onResolve={handleResolve} />` rendered alongside.

`handleUploadComplete` keeps its existing body **unchanged** — including the comment explaining why `isPrimary` is decided by index rather than by reading `images.length` in the loop. Do not touch that logic.

Reset the input's `value` after reading the files, or picking the same file twice in a row fires no `change` event.

- [ ] **Step 6: Verify**

Run: `rm -rf .next && pnpm type-check && pnpm lint && pnpm test`
Expected: type-check clean, lint 0 problems, 477 tests passing.

- [ ] **Step 7: Exercise it by hand**

With `pnpm dev`, as an admin: upload the 2040×528 `public/brand/coming-soon.png` to a product. Confirm all three paths — "Use as-is", "Apply crop", "Skip" — and that a multi-file selection walks the dialog once per file and uploads a single batch at the end.

---

### Task 6: Product page zoom

**Files:**

- Create: `src/components/products/product-detail/ImageLightbox.tsx`
- Modify: `src/components/products/product-detail/ProductImageGallery.tsx`

**Interfaces:**

- Consumes: `ProductImage` from Task 2.
- Produces: `function ImageLightbox(props: { src: string | null; alt: string; onClose: () => void })`

- [ ] **Step 1: Write the lightbox**

Create `ImageLightbox.tsx` as a client component: a `Dialog` whose content is full-screen, showing the image at `object-contain`, with

- wheel to zoom between 1× and 4×, clamped
- pointer-drag to pan while zoomed, with pan reset when zoom returns to 1
- a close button, and `onOpenChange` closing on Escape

The dialog is a portal on the storefront, so its content sets **both** halves explicitly:

```tsx
<DialogContent className="max-w-none w-screen h-screen bg-black/95 text-white border-0 p-0">
```

A background alone would inherit whichever foreground colour happens to be on `<body>`; that is the bug `AlertDialogContent` shipped with.

- [ ] **Step 2: Wire it into the gallery**

Make the main image frame a `<button>` opening the lightbox with `selectedImage`, add `cursor-zoom-in`, and give it an accessible label (`aria-label={`Zoom ${productName}`}`). The existing `selectedImage` / `onSelectImage` props and the thumbnail strip do not change. `src/app/(main)/products/[slug]/page.tsx` needs no changes at all.

- [ ] **Step 3: Verify**

Run: `rm -rf .next && pnpm type-check && pnpm lint && pnpm test && pnpm build`
Expected: type-check clean, lint 0 problems, 477 tests passing, build produces **98 static pages**.

- [ ] **Step 4: Look at it in both themes**

Open a product page, zoom, pan, close with Escape. Then confirm the crop dialog in the admin (light theme) has readable text — the two-themes-one-`:root` trap has produced six separate white-on-white bugs in this codebase and every one was caught by eye.

---

## Definition of done

- `pnpm test` → 477 passing, 0 failing
- `rm -rf .next && pnpm type-check` → clean
- `pnpm lint` → 0 problems
- `pnpm build` → 98 static pages
- A 2040×528 image renders whole, against a blurred backdrop, in the card grid, the product gallery, the cart line and the admin table
- All work left **uncommitted** for the repo owner to review
