# Product image fill and admin crop — design

Date: 2026-09-08
Status: approved, not yet implemented

## Problem

A wide image used as a product photo renders badly everywhere. The storefront
is standardised on 3:4 portrait — `ProductCard`, the product-detail gallery
main image, both skeletons and `ServerFeaturedCategories` all use
`aspect-3/4` — and every one of them fills that frame with `object-cover`.
`object-cover` on a 3.9:1 banner keeps a narrow vertical slice through the
middle and throws away most of the picture. The observed case is the
`coming-soon` wordmark (2040×528) used as a product image, which reduces to an
unreadable fragment of two letters.

There is no admin-side control over framing at all: `UploadDropzone` uploads
the moment a file is chosen, so nobody sees the image inside the frame it will
actually occupy until after it is published.

## Approach

Two independent changes.

1. **Rendering.** Never crop at render. Show the whole image inside the 3:4
   frame with `object-contain`, and fill the resulting bars with a blurred,
   scaled-up copy of the same image. Any aspect ratio then reads as a
   deliberate, solid tile.
2. **Upload.** Give the admin a preview with an _optional_ 3:4 crop before the
   file is uploaded, so a photo that deserves tight framing can get it.

The rendering change is the one that fixes the reported problem, and it fixes
it for the 36 products already in the database without anyone re-uploading
anything. The cropper is polish on top; it is never mandatory.

### Why the fill is self-disabling

For an image already at ~3:4 there are no bars, so `object-contain` and
`object-cover` paint identical pixels and the blur layer is completely
occluded. That means **no aspect detection, no conditional rendering, no new
columns, and no per-image configuration.** The component behaves correctly for
a square, a portrait, a panorama and a 3:4 product shot with one code path.

## Component: `src/components/shared/ProductImage.tsx`

`shared/` rather than `products/` because cart, search, wishlist, checkout and
two admin screens all render product imagery; `src/components/shared/` already
holds cross-area components (`ComingSoon.tsx`).

### API

```tsx
interface ProductImageProps {
  src: string;
  alt: string;
  /** Passed to BOTH layers unchanged. See "one download" below. */
  sizes: string;
  priority?: boolean;
  /** Extra classes for the foreground layer only, e.g. hover transforms. */
  className?: string;
}
```

The caller supplies the frame. Every call site already has one
(`relative aspect-3/4 overflow-hidden` or `relative aspect-square …`), so this
component renders only the two absolutely-positioned layers and adds no wrapper
element of its own.

### Structure

```tsx
<>
  <Image
    src={src}
    alt=""
    aria-hidden
    fill
    sizes={sizes}
    className="object-cover scale-110 blur-2xl"
    unoptimized={unoptimizedFor(src)}
  />
  <Image
    src={src}
    alt={alt}
    fill
    sizes={sizes}
    priority={priority}
    loading={priority ? "eager" : "lazy"}
    className={cn("object-contain", className)}
    unoptimized={unoptimizedFor(src)}
  />
</>
```

- `scale-110` hides the soft, semi-transparent edge that `blur-2xl` leaves at
  the boundary of the element. Without it a pale halo traces the frame.
- The blur layer is `alt=""` **and** `aria-hidden` — it is the same picture
  twice, and a screen reader announcing it twice is a defect.
- `unoptimizedFor` is carried over from `src/lib/image-hosts.ts` unchanged.
  Dropping it breaks picsum seed imagery, which 503s through Next's optimiser.

### One download, not two — a load-bearing constraint

Both layers **must** receive the identical `src` and the identical `sizes`.
Next generates the same `srcset` for both, the browser selects the same
candidate URL for both, and the second request is served from cache — so the
two layers cost one download.

The tempting "optimisation" is to give the blur layer something like
`sizes="64px"`, on the reasoning that a blurred backdrop does not need
resolution. That selects a _different_ srcset entry, which is a genuinely
different URL, which is a second network request. It makes the page slower
while looking like it made it faster. **This must be stated in a comment in
the file**, because it is the change a future reader will make on sight.

### Performance note

`blur-2xl` across a 24-card grid is compositor work on every scroll frame. It
is expected to be fine — the blurred layer is static and gets its own layer —
but if a grid ever feels janky on a low-end device, this is the first thing to
measure, not the last.

## Consumers to migrate

Each of these currently renders a product image with `object-cover` and must
switch to `<ProductImage>`. The surrounding frame, badges, links and hover
behaviour stay exactly as they are.

| File                                                             | Frame                                      |
| ---------------------------------------------------------------- | ------------------------------------------ |
| `src/components/products/ProductCard.tsx`                        | `aspect-3/4`                               |
| `src/components/products/product-detail/ProductImageGallery.tsx` | `aspect-3/4` main + `aspect-square` thumbs |
| `src/components/account/wishlist/WishlistGrid.tsx`               | `aspect-square`                            |
| `src/components/cart/CartItem.tsx`                               | small square                               |
| `src/components/cart/CartStockDialog.tsx`                        | small square                               |
| `src/components/checkout/CheckoutOrderSummary.tsx`               | small square                               |
| `src/components/search/SearchDialog.tsx`                         | small square                               |
| `src/components/home/ServerFeaturedCategories.tsx`               | `aspect-3/4`                               |
| `src/components/admin/products/list/ProductsTable.tsx`           | small square                               |
| `src/components/admin/products/create/ImageUploadSection.tsx`    | `aspect-square` preview                    |

`ProductCard` keeps `group-hover:scale-105` — it passes through `className` to
the foreground layer, so the photo scales on hover and the blurred backdrop
stays still. That is the correct effect, not a compromise.

Out of scope: `ServerHeroSection`, `PromoBanner`, `BrandStory`, `Navbar`,
`Footer`, `MobileMenu`, `UserDialog`, `AppearanceSettings`,
`CloseOrderDialog`. These render CMS art direction, brand assets or avatars,
not product photography, and their framing is already deliberate.

## Admin crop

### Why `UploadDropzone` has to go

`UploadDropzone` begins uploading as soon as a file is selected. There is no
seam between "file chosen" and "bytes sent" in which to open a cropper. Its
`onBeforeUploadBegin` hook can technically host a promise resolved by a modal,
but building a dialog interaction inside an upload lifecycle callback is the
kind of cleverness that is unreadable six months later.

Instead, drive the upload explicitly with `useUploadThing`, which must be added
to `src/components/ui/upload.tsx`:

```ts
export const { useUploadThing } = generateReactHelpers<OurFileRouter>();
```

### Flow

```
admin picks N files (plain <input type="file" multiple accept="image/*">)
  │
  └─ for each file, in sequence, a dialog:
       ┌──────────────────────────────────────────┐
       │  preview inside a locked 3:4 frame       │
       │  drag to reposition, slider to zoom      │
       │                                          │
       │  [ Use as-is ]  [ Apply crop ]  [ Skip ] │
       └──────────────────────────────────────────┘
         "Use as-is"   → the original File, untouched
         "Apply crop"  → canvas → toBlob → new File(...)
         "Skip"        → dropped, not uploaded
  │
  └─ startUpload(collectedFiles)
       → existing handleUploadComplete, unchanged
       → existing admin.images.add / local-image path, unchanged
```

Nothing downstream of `startUpload` changes: `product_images`, the images
router, `ProductImageEntity`, `AddProductImageUseCase` and the
`revalidateCatalogue()` calls are all untouched. This is purely a change to how
the bytes are chosen before they are sent.

### Dependency

`react-easy-crop` — drag + zoom within a fixed aspect frame, touch support,
returns a pixel-space crop rectangle. It does not produce the cropped image
itself; drawing to canvas is the consumer's job, which is what keeps the maths
testable.

### `src/lib/image-crop.ts` — the testable half

The repo has no DOM testing library, and the convention is that client logic
worth testing is extracted into a plain module and tested there
(`src/lib/variant-stock-registry.ts` is the precedent). So the pure maths lives
here and the React component is a shell over it.

```ts
/** A crop rectangle in the source image's own pixel space. */
export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Given a crop area and the natural size of the source, produce the canvas
 * width/height and the drawImage source/destination rectangles, with the
 * output capped so the encoded result stays under UploadThing's 4MB limit.
 */
export function resolveCropDraw(
  natural: { width: number; height: number },
  crop: CropArea,
  maxEdge: number
): {
  canvas: { width: number; height: number };
  source: CropArea;
  scale: number;
};
```

`image-crop.test.ts` covers:

- a crop of a wide source to 3:4 produces a 3:4 canvas
- a crop area larger than the source is clamped to the source bounds
- a crop whose long edge exceeds `maxEdge` is scaled down, preserving 3:4
- a crop already within bounds is passed through at `scale === 1`
- zero/negative dimensions are rejected rather than producing a 0×0 canvas

Encoding is `canvas.toBlob(blob => …, "image/webp", 0.9)`, wrapped into a
`File` so `startUpload` accepts it. WebP at 0.9 from a bounded crop lands far
under the 4MB route limit; `maxEdge` is the belt-and-braces guard for a
40-megapixel source.

## Product page zoom

`ProductImageGallery`'s main image becomes a `<ProductImage>` and gains a
click-to-open lightbox: a full-screen dialog showing the image at
`object-contain`, with wheel/pinch zoom and drag-to-pan.

**The portal trap applies.** The lightbox is a Radix portal, so it attaches to
`<body>` and escapes any theme wrapper. It must set **both** halves of a colour
pair — `bg-black/95 text-white` for a storefront surface — never a background
alone. `AlertDialogContent` set only `bg-background` and rendered white-on-white
in the admin; that is the same mistake one layer down.

The existing `selectedImage` / `onSelectImage` props and the thumbnail strip
are unchanged. `product/[slug]` itself needs no changes, which matches the
original read of the problem.

## Testing

- `pnpm vitest run src/lib/image-crop.test.ts` — the new unit tests
- `pnpm test` — full unit suite, must stay green (469 passing baseline)
- `rm -rf .next && pnpm type-check` — the `.next` clear is required or stale
  route types produce phantom errors
- `pnpm lint` — baseline is 0 problems, keep it there
- `pnpm build` — 98 static pages baseline
- Manual: upload the 2040×528 `coming-soon` wordmark as a product image and
  confirm it is fully legible in the card grid, the gallery and the cart line.

## Out of scope

- Storing crop parameters, original dimensions, or re-croppable state in
  `product_images`. The crop is destructive at upload by choice; the fill is
  what makes that safe.
- Server-side image processing (`sharp`). All cropping is client-side canvas.
- Reordering images by drag, which the gallery still cannot do.
