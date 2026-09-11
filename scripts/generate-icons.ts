/**
 * Generate every app icon and social image from the brand logos.
 *
 * Run with `pnpm icons` after changing anything in `public/logo/`. It is a
 * script rather than a one-off because the outputs are derived artefacts: if
 * the logo is ever redrawn, eleven files have to change together, and doing
 * that by hand is how a site ends up with a new logo in the header and the old
 * one in the browser tab.
 *
 * Two source files, two different jobs:
 *
 * - `Val-full-logo.png` — the winged V mark. Square-ish enough to be an icon.
 * - `VAL-LOGO.png` — the wordmark. Far too wide for an icon (~3.9:1), so it is
 *   only used on the 1200x630 social card, under the mark.
 *
 * ## Why the background is keyed out rather than trimmed
 *
 * Both logos are renders sitting on their own background — the mark on a dark
 * charcoal (~#1b1e23), the wordmark on near-black — and those two backgrounds
 * do not match each other or the storefront's pure black. Compositing either
 * one as an opaque rectangle leaves a visible panel behind the artwork, which
 * is exactly the kind of thing nobody notices until it is on a phone home
 * screen.
 *
 * `sharp.trim()` does not solve it: it crops to a bounding box, so the
 * background inside the box survives, and these renders have enough noise in
 * the backdrop that the box it finds is loose anyway.
 *
 * So the alpha channel is rebuilt from luminance instead. Both marks are
 * bright brushed metal on a dark ground, which makes luminance an almost
 * perfect matte: below `KEY_FLOOR` is background and goes fully transparent,
 * above `KEY_CEIL` is metal and stays fully opaque, and the ramp between them
 * keeps the edges anti-aliased rather than jagged.
 *
 * The engraved detail *inside* the mark is dark too, and this punches it
 * through to transparency as well. That is fine, and deliberate: every surface
 * these icons land on is dark, so a hole reads identically to the shadow it
 * replaced — while the silhouette is now correct against any background a
 * platform might choose to put behind it.
 */

import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

// Resolved from the working directory, matching `seed-legal.ts` and
// `seed-products.ts` — every script here is run from the repo root via pnpm.
const ROOT = process.cwd();
const MARK_SRC = path.join(ROOT, "public/logo/Val-full-logo.png");
const WORDMARK_SRC = path.join(ROOT, "public/logo/VAL-LOGO.png");

const APP_DIR = path.join(ROOT, "src/app");
const ICONS_DIR = path.join(ROOT, "public/icons");

/** The storefront's background. Icons match it so they sit flush on the tab. */
const BG = { r: 0, g: 0, b: 0, alpha: 1 };

/** Rec. 709 luminance — the perceptual one, on 0-255. */
function luminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * How far above the measured background the ramp finishes.
 *
 * Deliberately narrow. The ramp exists only to keep the artwork's anti-aliased
 * edge smooth, not to matte softly — a wide ramp would drag the mark's
 * mid-tone brushed metal (luma 60-90) down to semi-transparent and leave the
 * wings looking washed out.
 */
const KEY_RAMP = 15;

/**
 * Rebuild the alpha channel from luminance, so the artwork lifts off its
 * backdrop. Returns a trimmed, transparent-background PNG buffer.
 *
 * The threshold is measured per image rather than shared, because the two
 * source logos do not agree on what "background" is: the mark sits on a
 * charcoal that peaks around luma 46, the wordmark on a near-black that peaks
 * around 3. A single constant tuned for one leaves a visible rectangular panel
 * behind the other — which is exactly what the first attempt at this did.
 *
 * The measurement is the image's own one-pixel border ring, which for a
 * centred logo on a plain ground is background by definition. The 99th
 * percentile rather than the maximum, so one stray bright pixel in the corner
 * cannot drag the threshold up and dissolve half the artwork.
 */
async function keyOutBackground(src: string): Promise<Buffer> {
  const { data, info } = await sharp(src)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const at = (x: number, y: number) => (y * width + x) * channels;

  const ring: number[] = [];
  for (let x = 0; x < width; x++) {
    for (const y of [0, height - 1]) {
      const i = at(x, y);
      ring.push(luminance(data[i], data[i + 1], data[i + 2]));
    }
  }
  for (let y = 1; y < height - 1; y++) {
    for (const x of [0, width - 1]) {
      const i = at(x, y);
      ring.push(luminance(data[i], data[i + 1], data[i + 2]));
    }
  }
  ring.sort((a, b) => a - b);

  const backdrop = ring[Math.floor((ring.length - 1) * 0.99)];
  const floor = backdrop + 2;
  const ceil = floor + KEY_RAMP;

  const out = Buffer.allocUnsafe(width * height * 4);

  for (let i = 0, o = 0; i < data.length; i += channels, o += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const ramp = (luminance(r, g, b) - floor) / (ceil - floor);
    const alpha = ramp <= 0 ? 0 : ramp >= 1 ? 255 : Math.round(ramp * 255);

    out[o] = r;
    out[o + 1] = g;
    out[o + 2] = b;
    // Respect a source that was already transparent.
    out[o + 3] = channels === 4 ? Math.min(alpha, data[i + 3]) : alpha;
  }

  console.log(
    `  keyed ${path.basename(src)}: backdrop luma ${backdrop.toFixed(1)}, ` +
      `alpha ramp ${floor.toFixed(0)}→${ceil.toFixed(0)}`
  );

  return sharp(out, { raw: { width, height, channels: 4 } })
    .trim({ threshold: 1 })
    .png()
    .toBuffer();
}

/**
 * How much the mark is brightened before it becomes an icon.
 *
 * Measured, not guessed. The logo is mid-grey brushed metal lit for a large
 * render — most of it sits around luma 60-140 — and a 2.5:1 mark letterboxed
 * into a square only fills about 40% of the height. At 16px the two combine
 * into an unreadable dark smear on a black tab bar; rendered side by side at
 * 16/32/48, a 1.9x lift is the difference between "grey blur" and "silver
 * wings".
 *
 * It applies to the square icons only. The social card is 1200x630 with the
 * mark at full size, has none of this problem, and should stay true to the
 * brand artwork.
 */
const ICON_BRIGHTNESS = 1.9;

/**
 * Fit `art` into a `size` square on the brand background.
 *
 * `padding` is the fraction of the square left empty on the longest edge.
 * `contain` rather than `cover` because the mark is ~2.5:1 — cropping it to
 * fill a square would cut the wings off, which is the whole logo.
 */
async function squareIcon(
  art: Buffer,
  size: number,
  padding: number
): Promise<Buffer> {
  const inner = Math.round(size * (1 - padding * 2));

  const fitted = await sharp(art)
    .linear(ICON_BRIGHTNESS, 0)
    .resize(inner, inner, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .toBuffer();

  return sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: fitted, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/**
 * Pack PNGs into an .ico container.
 *
 * sharp cannot write .ico, and the format is simple enough not to warrant a
 * dependency: a 6-byte header, a 16-byte directory entry per image, then the
 * image payloads. Every current browser and Windows 10+ reads PNG-compressed
 * entries, which is why each frame is embedded as a PNG rather than as a BMP
 * with the legacy AND-mask.
 */
function buildIco(frames: { size: number; png: Buffer }[]): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type 1 = icon
  header.writeUInt16LE(frames.length, 4);

  const directory = Buffer.alloc(frames.length * 16);
  let offset = header.length + directory.length;

  frames.forEach((frame, i) => {
    const at = i * 16;
    // 0 means 256 in this field; none of our frames are that large, but the
    // encoding is the same either way.
    directory[at] = frame.size >= 256 ? 0 : frame.size;
    directory[at + 1] = frame.size >= 256 ? 0 : frame.size;
    directory[at + 2] = 0; // palette size — 0 for truecolour
    directory[at + 3] = 0; // reserved
    directory.writeUInt16LE(1, at + 4); // colour planes
    directory.writeUInt16LE(32, at + 6); // bits per pixel
    directory.writeUInt32LE(frame.png.length, at + 8);
    directory.writeUInt32LE(offset, at + 12);
    offset += frame.png.length;
  });

  return Buffer.concat([header, directory, ...frames.map((f) => f.png)]);
}

/**
 * The 1200x630 card shown when a link is pasted into WhatsApp, Messenger,
 * Instagram DMs, X or Slack — which, for a store launching in Egypt, is most
 * of how anyone will first see the site.
 *
 * Mark above, wordmark below, both keyed so neither carries its own panel.
 */
async function socialCard(mark: Buffer, wordmark: Buffer): Promise<Buffer> {
  const W = 1200;
  const H = 630;

  const markLayer = await sharp(mark)
    .resize(620, 280, {
      fit: "inside",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .toBuffer();

  const wordLayer = await sharp(wordmark)
    .resize(560, 120, {
      fit: "inside",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .toBuffer();

  const markMeta = await sharp(markLayer).metadata();
  const wordMeta = await sharp(wordLayer).metadata();

  // Laid out as one optical group rather than two centred blocks: the mark and
  // the wordmark are measured together and the pair is centred, so the gap
  // between them stays constant even if a logo is later redrawn at a new ratio.
  const GAP = 48;
  const groupHeight = markMeta.height! + GAP + wordMeta.height!;
  const top = Math.round((H - groupHeight) / 2);

  return sharp({
    create: { width: W, height: H, channels: 4, background: BG },
  })
    .composite([
      {
        input: markLayer,
        top,
        left: Math.round((W - markMeta.width!) / 2),
      },
      {
        input: wordLayer,
        top: top + markMeta.height! + GAP,
        left: Math.round((W - wordMeta.width!) / 2),
      },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function main() {
  for (const src of [MARK_SRC, WORDMARK_SRC]) {
    if (!existsSync(src)) {
      throw new Error(`Missing source logo: ${path.relative(ROOT, src)}`);
    }
  }

  await mkdir(ICONS_DIR, { recursive: true });

  const mark = await keyOutBackground(MARK_SRC);
  const wordmark = await keyOutBackground(WORDMARK_SRC);

  const written: string[] = [];
  const write = async (target: string, data: Buffer) => {
    await writeFile(target, data);
    written.push(
      `  ${path.relative(ROOT, target).replace(/\\/g, "/")}  ` +
        `(${(data.length / 1024).toFixed(1)} kB)`
    );
  };

  // Padding is tighter on the small sizes on purpose. The mark is wide and
  // detailed, so at 16px every pixel spent on margin is a pixel not spent on
  // the wings — and the browser already insets a favicon within the tab.
  const ICO_PADDING = 0.02;
  const STANDARD_PADDING = 0.06;

  await write(
    path.join(APP_DIR, "favicon.ico"),
    buildIco(
      await Promise.all(
        [16, 32, 48].map(async (size) => ({
          size,
          png: await squareIcon(mark, size, ICO_PADDING),
        }))
      )
    )
  );

  await write(
    path.join(APP_DIR, "icon.png"),
    await squareIcon(mark, 512, STANDARD_PADDING)
  );

  // Apple does not round the corners of a home-screen icon it was given as a
  // full-bleed square, and it composites nothing behind it, so this one needs
  // its own opaque background — which `squareIcon` already supplies.
  await write(
    path.join(APP_DIR, "apple-icon.png"),
    await squareIcon(mark, 180, STANDARD_PADDING)
  );

  for (const size of [192, 512]) {
    await write(
      path.join(ICONS_DIR, `icon-${size}.png`),
      await squareIcon(mark, size, STANDARD_PADDING)
    );
  }

  // Android crops a maskable icon to whatever shape the launcher uses — a
  // circle on Pixel, a squircle on Samsung — and the spec only guarantees the
  // middle 80%. Everything outside that radius must be background, so this one
  // gets far more padding than looks right in isolation.
  await write(
    path.join(ICONS_DIR, "maskable-512.png"),
    await squareIcon(mark, 512, 0.2)
  );

  const card = await socialCard(mark, wordmark);
  await write(path.join(APP_DIR, "opengraph-image.png"), card);
  // Twitter/X reads `twitter:image` in preference to `og:image`. Same artwork,
  // separate file, because Next's file convention wires each one by name.
  await write(path.join(APP_DIR, "twitter-image.png"), card);

  console.log(`\nGenerated ${written.length} files:\n${written.join("\n")}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
