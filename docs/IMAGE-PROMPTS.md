# Image prompts for Valkyrie — written for Gemini

Copy-paste prompts for Gemini's image generation (Google AI Studio,
aistudio.google.com — the image model is the one informally called Nano
Banana). Gemini responds to natural instruction-style prose rather than
comma-separated tag stacks, so every prompt below is written as complete
sentences and states its negatives explicitly. Do not compress them into
keywords; the detail is what stops the output looking generic.

---

## Before you generate anything

**Aspect ratio is not cosmetic.** The storefront frames product photography at
**3:4 portrait** — the product card, the detail gallery, the collection grid and
both loading skeletons all use it. Generate at 3:4 and the image fills the frame
exactly. Generate at anything else and it renders whole against a blurred copy
of itself, which is a deliberate, graceful fallback but not the intended look.

| Image                                       | Ratio    | Export size |
| ------------------------------------------- | -------- | ----------- |
| Product photos, category cards, placeholder | **3:4**  | 1200 × 1600 |
| Homepage hero                               | **16:9** | 2400 × 1350 |
| Promo banner                                | **1:1**  | 1600 × 1600 |
| Brand story                                 | **4:5**  | 1200 × 1500 |

**Hard limit: 4MB per upload.** That is the `productImage` route's cap, enforced
server-side. Export WebP or JPEG at quality 85 — a 1200 × 1600 photo lands
around 300–600KB, so you have plenty of headroom.

**Tell Gemini the ratio in words**, in the prompt itself — "a vertical
three-by-four portrait image" — and set the aspect ratio control in AI Studio as
well. Stating it only once tends to get ignored.

---

## The house style block

**Paste this into every prompt below.** It is the single most important thing
in this document: a catalogue where each photo was lit differently reads as a
collage of stock images, and no individual image being beautiful will rescue
that. Consistency beats quality here.

> HOUSE STYLE: Premium streetwear brand photography. Near-black and deep
> charcoal backgrounds. One soft key light from the upper left, and a cool
> steel-blue rim light tracing the right edge of the subject. Desaturated colour
> grade with cool shadows and slightly lifted blacks — never warm, never
> golden-hour. Matte finish, no glossy highlights, no lens flare. Quiet and
> restrained rather than dramatic.
>
> DO NOT INCLUDE: any text, letters, numbers, words or watermarks; any brand
> logo, swoosh, monogram or recognisable trademark; any white or light-coloured
> background; any props, furniture, plants or clutter; any visible camera
> equipment; any distorted or extra fingers, hands or limbs.

---

## 1. Coming-soon placeholder — generate this one first

This is the image standing in for every product until real photography exists.
It has to look deliberate, not like a missing asset.

> A single premium oversized hoodie in deep matte charcoal, folded neatly into a
> clean rectangle and resting on a seamless near-black surface. Photographed
> straight on from slightly above. The fabric is heavyweight brushed cotton with
> visible texture in the weave and soft natural creases where it is folded. A
> cool steel-blue rim light runs along the top-right edge of the fold,
> separating the garment from the background. The garment occupies the middle
> half of the frame with generous empty space above and below it, so the
> composition feels calm and intentional rather than cropped tight.
>
> Shot on a medium-format camera with an 85mm lens at f/4. Sharp focus across
> the garment, background falling softly to pure black at the edges of the
> frame.
>
> A vertical three-by-four portrait image.
>
> [PASTE HOUSE STYLE BLOCK HERE]

**Variations**, if you want a small set rather than one image — change only the
garment, keep every other sentence identical so they look like one shoot:
`an oversized boxy t-shirt`, `a pair of wide-leg cargo trousers`,
`a zip-through track jacket`, `a ribbed knit beanie`.

---

## 2. Homepage hero

Wide, atmospheric, and it has to survive a headline and a button laid over it —
so the centre of the frame must stay calm. The site darkens this by roughly 40%
by default, so choose a frame that still reads when dimmed.

> Two models in premium streetwear walking towards the camera through an empty
> concrete underpass at dusk. They are mid-stride, relaxed and unhurried, both
> looking slightly off-camera rather than at the lens. One wears an oversized
> charcoal hoodie, the other a long black coat over wide trousers. Cool blue
> evening light rakes in from the far end of the tunnel behind them, rimming
> their shoulders and separating them from the dark concrete. The foreground and
> the centre of the frame are open and uncluttered — the architecture frames the
> subjects from the left and right edges, leaving the middle of the image
> relatively empty so that overlaid text will remain readable.
>
> Cinematic anamorphic look, 35mm lens at f/2, natural available light only, no
> flash. Deep shadows with detail retained in them, muted palette,
> fine natural film grain.
>
> A wide sixteen-by-nine landscape image.
>
> [PASTE HOUSE STYLE BLOCK HERE]

---

## 3. Promo banner

Sits beside a block of text on the homepage, so it wants a single clear subject
rather than a busy scene.

> A single model from the shoulders down, standing square to the camera against
> a plain dark charcoal wall, wearing an oversized streetwear hoodie in deep
> black with the hands pushed into the front pocket. The crop begins at the
> collarbone and ends mid-thigh, so no face is visible. The fabric drapes
> heavily and naturally, with clear texture in the weave and soft folds at the
> pocket. A cool steel-blue rim light traces the left shoulder and arm. The
> background is a smooth, even, unlit dark grey that falls off gently towards
> the corners.
>
> 50mm lens at f/2.8, soft diffused key light, matte finish.
>
> A square one-by-one image.
>
> [PASTE HOUSE STYLE BLOCK HERE]

---

## 4. Brand story

The one image in the set that should feel human and unposed rather than
styled — it sits next to copy about how the clothes are made.

> A documentary-style photograph of a pair of hands guiding heavy black fabric
> through an industrial sewing machine in a small workshop. The hands are in
> sharp focus; the machine and the room behind fall away into soft darkness.
> A single warm task lamp lights the work surface from the left, and the rest of
> the room is unlit, so the light pools tightly around the hands and the fabric.
> Loose thread, fabric offcuts and a pair of shears sit just out of focus in the
> foreground. Nothing is arranged for the camera — it looks like a moment
> observed rather than staged.
>
> 35mm lens at f/2, available light only, natural grain, slight motion softness
> in the fabric.
>
> A vertical four-by-five portrait image.
>
> Note: this one image may use warm task lighting, as an intentional exception
> to the house style's cool grade — it is the only warm image on the site and
> that contrast is the point. Everything else in the house style block still
> applies.
>
> [PASTE HOUSE STYLE BLOCK HERE]

---

## 5. Category cards

One per collection. These sit in a row, so consistency between them matters more
than any single one — keep every sentence identical except the garment.

> A single [GARMENT] in deep black displayed on a matte black mannequin bust
> against a smooth graduated dark grey backdrop that falls to near-black at the
> edges. Lit with one soft key light from the left and a cool steel-blue rim
> light from the right, so the silhouette is cleanly separated from the
> background. The garment is centred with clear space above and below it. The
> lower third of the frame is slightly darker than the rest, so that overlaid
> white text will remain readable.
>
> 85mm lens at f/4, soft diffused studio lighting, sculptural and minimal.
>
> A vertical three-by-four portrait image.
>
> [PASTE HOUSE STYLE BLOCK HERE]

Substitute `[GARMENT]` with, one per card: `hooded sweatshirt`,
`boxy short-sleeve t-shirt`, `zip-through jacket`, `pair of wide-leg trousers`,
`canvas crossbody bag`, `pair of low-top sneakers`.

Upload these in **Admin → Categories** on each category. The card reads
`categories.image_url`, and with no image set it falls back to a brand gradient
rather than a stock photo.

---

## 6. Product photography — three shots per product

A listing with one photo looks unfinished. Three makes it look like a real shop.
Generate all three for each product, changing only `[GARMENT]` and `[COLOUR]`.

### 6a. On-model

> A full-length editorial fashion photograph of a model wearing a [GARMENT] in
> [COLOUR], standing against a plain unpainted concrete wall in soft overcast
> daylight. The posture is relaxed and confident, weight on one leg, with the
> face turned slightly away from the camera so the garment rather than the
> person is the subject. The full garment is visible from collar to hem, and the
> model is centred with even space on both sides. The fabric's drape and texture
> are clearly readable.
>
> 50mm lens at f/2.8, natural diffused daylight only, no flash, cool neutral
> colour grade with steel-blue tones in the shadows.
>
> A vertical three-by-four portrait image.
>
> [PASTE HOUSE STYLE BLOCK HERE]

### 6b. Flat-lay

> A [GARMENT] in [COLOUR] laid out flat and neatly styled on a smooth matte
> charcoal surface, photographed from directly overhead. The sleeves are folded
> inward in a clean symmetrical arrangement and the hem is straight. Even
> diffused lighting from above with no harsh shadows, and a subtle cool
> highlight along the raised folds. Every seam, drawcord and piece of hardware
> is crisp and legible. The garment is centred with an even margin of empty
> surface on all four sides.
>
> 50mm lens at f/8 for edge-to-edge sharpness, soft overhead studio lighting.
>
> A vertical three-by-four portrait image.
>
> [PASTE HOUSE STYLE BLOCK HERE]

### 6c. Detail / macro

> An extreme close-up of the stitching, fabric weave and hardware of a [GARMENT]
> in [COLOUR]. Raking light crosses the surface at a low angle to reveal the
> texture of the knit, the double-needle stitching along a seam, and the metal
> tip of a drawcord resting across the fabric. The near edge is in sharp focus
> and the background falls away quickly into darkness.
>
> 100mm macro lens at f/2.8, single soft raking light from the left, deep
> shadows, matte finish.
>
> A vertical three-by-four portrait image.
>
> [PASTE HOUSE STYLE BLOCK HERE]

---

---

## How many images per product, and in what order

**Four images per product.** Only 6a needs two versions — 6b and 6c have no
person in frame, so gender does not apply to them.

| Shot        | How many                     | Why                                  |
| ----------- | ---------------------------- | ------------------------------------ |
| 6a on-model | **2** — one male, one female | The pair the card crossfades between |
| 6b flat-lay | 1                            | No person in frame                   |
| 6c detail   | 1                            | No person in frame                   |

### Upload order decides the carousel

The product card animates between the **first two images by display order**, and
the first image uploaded becomes `isPrimary`. So upload in this order:

1. **on-model, first model** — becomes the primary. This is what shows in the
   cart, checkout, search results, wishlist and the admin table.
2. **on-model, second model** — the frame the card crossfades to.
3. flat-lay
4. detail

Get this wrong and the card will crossfade between an on-model shot and a
flat-lay, which reads as a glitch rather than as two views of a garment. The
product detail page shows all four in its thumbnail strip either way, so
nothing is wasted.

A product with only one image **never animates** — the card checks for a second
image and stays perfectly still without one. That is why the "Coming Soon"
placeholder sits motionless.

### Start with three products, not eight

Twelve images rather than thirty-two, and eight thinly-shot products look worse
than three properly shot ones. It also surfaces the thing you cannot judge from
a single image: whether the house style actually holds across a set. If the
ninth shot drifts in lighting or colour grade, it is much better to discover
that at twelve than at thirty-two.

Three that give the grid tonal variety rather than three near-blacks:

- heather charcoal hooded sweatshirt — female as the primary shot
- bone off-white boxy t-shirt — male as the primary shot
- washed olive wide-leg cargo trousers — female as the primary shot

### Model assignment across the full eight

Four and four, alternating down the grid so the collection page does not read as
one gender and then the other.

| #   | Garment                                 | Colour                | Primary model |
| --- | --------------------------------------- | --------------------- | ------------- |
| 1   | oversized heavyweight hooded sweatshirt | heather charcoal grey | female        |
| 2   | boxy short-sleeve t-shirt               | bone off-white        | male          |
| 3   | zip-through track jacket                | slate grey            | male          |
| 4   | wide-leg cargo trousers                 | washed olive green    | female        |
| 5   | long-sleeve ribbed thermal top          | faded charcoal black  | female        |
| 6   | canvas crossbody utility bag            | desert sand           | male          |
| 7   | ribbed knit beanie                      | deep steel blue       | female        |
| 8   | relaxed drawstring shorts               | stone grey            | male          |

Colours are chosen so the grid does not turn to mud: the house style puts
near-black behind everything, so a jet-black garment has almost nothing to
separate it. The bone off-white piece is the anchor — every dark-on-dark
catalogue needs one light item or the grid reads as a single grey smear at
thumbnail size.

### Keeping faces consistent

Gemini invents a different face every time unless told otherwise, and eight
different faces makes a small catalogue look like assembled stock photography.
Either add `her face turned away from the camera, features not visible` to the
on-model prompt, or crop at the collarbone as the promo-banner prompt does.
Most premium streetwear brands do the second.

## Why the negatives matter

Each of these has bitten real stores, which is why they are in the house style
block rather than left to chance:

- **Text and letters.** Image models invent garbled pseudo-text constantly. The
  site renders its own headings — baked-in text cannot be translated, cannot be
  read by a screen reader, and turns to mush when the image is scaled into a
  small card.
- **Brand logos.** Models will happily add a swoosh or a monogram unless told
  not to. You cannot sell a garment carrying someone else's trademark.
- **White backgrounds.** The storefront is near-black. A white cut-out reads as
  a hole punched in the page.
- **Wide crops.** A 16:9 image in a 3:4 frame is the exact bug that started this
  work — it used to be cropped to an unreadable vertical strip.
- **Inconsistent faces.** A different model per product makes a small catalogue
  look like assembled stock photography. Either keep one model throughout, or
  crop faces out entirely as the promo banner prompt does.

## After generating

1. **Check the aspect ratio before anything else.** If it came out 1:1 or 16:9,
   regenerate rather than crop — cropping to 3:4 loses the composition you asked
   for.
2. Export at quality 85, under 4MB.
3. Upload via **Admin → Products → [product] → Images**. The upload dialog
   offers an optional 3:4 crop with drag and zoom; a correctly generated image
   needs no cropping, so "Use as-is" is the right button.
4. **The first image uploaded becomes the primary** — that is the one the
   collection grid and cart show, so upload the on-model shot first.
