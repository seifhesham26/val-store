/**
 * Colour name resolution
 *
 * `product_variants.color` stores a free-text name ("Navy", "Heather
 * Charcoal") — there is no hex column in the schema. Swatches therefore have
 * to resolve a name to a displayable colour here.
 *
 * ## Why this is token-based rather than a lookup table
 *
 * It used to match the whole normalised name against a flat table, and fall
 * back to a hue derived from a hash of the name when that missed. That works
 * only for single-word colours, and almost no apparel colour is a single word:
 * of the eight names in this catalogue, exactly one ("Bone") matched. The
 * other seven rendered an arbitrary hash hue, so a charcoal hoodie showed a
 * tan swatch, "Faded Black" showed pinkish red and "Washed Olive" showed
 * purple.
 *
 * That is not a cosmetic miss. The swatch is what a customer picks a variant
 * by, and it sat directly under a label naming a completely different colour.
 *
 * Apparel colour names are almost always one of two shapes:
 *
 *   modifier + base   "Washed Olive", "Heather Charcoal", "Light Grey"
 *   tint     + base   "Slate Grey", "Steel Blue", "Desert Sand"
 *
 * Both are head-final in English — a "Slate Grey" is a grey that leans slate,
 * not a slate that leans grey — so the **rightmost** recognised colour word is
 * the base. Anything recognised to its left shades it; anything recognised as
 * a modifier adjusts lightness and saturation.
 *
 * Resolution order:
 *   1. The value is already a hex literal ("#1e293b") — use it as-is.
 *   2. The whole name is a known colour ("navy", "offwhite") — use that hex.
 *   3. Token resolution — base, tint and modifiers, as above.
 *   4. Nothing recognised — derive a stable hue from the name, so unknown
 *      colours are at least distinguishable rather than all rendering black.
 */

/** Curated palette for the colour names the catalogue actually uses. */
const NAMED_COLORS: Record<string, string> = {
  black: "#0a0a0a",
  jetblack: "#0a0a0a",
  offblack: "#1c1c1c",
  charcoal: "#36393f",
  graphite: "#3b3f45",
  white: "#f8fafc",
  offwhite: "#f1ede6",
  ivory: "#f5f0e6",
  cream: "#f0e6d2",
  bone: "#e3ddd1",
  gray: "#8b9099",
  grey: "#8b9099",
  lightgray: "#c3c8cf",
  lightgrey: "#c3c8cf",
  darkgray: "#4b5058",
  darkgrey: "#4b5058",
  silver: "#c9ced6",
  navy: "#1b2a4a",
  midnight: "#141d33",
  blue: "#2563eb",
  royalblue: "#2b4bb5",
  skyblue: "#7dd3fc",
  denim: "#3b5a80",
  teal: "#0f766e",
  green: "#2f7d4f",
  olive: "#5c6b3c",
  forest: "#25452f",
  sage: "#9caa8a",
  khaki: "#a89b74",
  mint: "#a8d5c2",
  beige: "#d8c7ac",
  sand: "#dcc9a8",
  tan: "#c9a87c",
  camel: "#bf9c6b",
  taupe: "#a89786",
  brown: "#6b4a34",
  chocolate: "#4a2f22",
  rust: "#9c4a24",
  terracotta: "#b3573a",
  burgundy: "#5c1f28",
  maroon: "#5c1f28",
  wine: "#4d1a2a",
  red: "#c0392b",
  crimson: "#a01c33",
  pink: "#e8a0b4",
  blush: "#e8c4c0",
  rose: "#c96b7e",
  purple: "#6b4a8c",
  lavender: "#b9aad4",
  lilac: "#c9b8dd",
  yellow: "#e3c04a",
  mustard: "#c9a227",
  gold: "#c2a04a",
  orange: "#d97b34",
  coral: "#e08b6f",
  peach: "#f0c0a0",
  stone: "#b5ada2",
  slate: "#5b6675",
  steel: "#1e293b",
  ecru: "#e6dcc8",
};

/**
 * Words that describe how a colour is treated rather than which colour it is.
 *
 * `lightness` is an absolute delta in percentage points; `saturation` is a
 * multiplier. The wash family ("faded", "washed", "dusty") is the interesting
 * one: those all mean roughly "this pigment has been beaten up", which reads
 * as a large drop in saturation with a small lift in lightness.
 *
 * "heather" is the strongest desaturation because a heathered fabric is
 * literally undyed fibre spun through the dyed fibre — it is grey-flecked by
 * construction, not by fading.
 */
const MODIFIERS: Record<string, { lightness: number; saturation: number }> = {
  light: { lightness: 14, saturation: 0.95 },
  pale: { lightness: 18, saturation: 0.7 },
  soft: { lightness: 10, saturation: 0.8 },
  dark: { lightness: -12, saturation: 1 },
  deep: { lightness: -10, saturation: 1.05 },
  rich: { lightness: -4, saturation: 1.2 },
  bright: { lightness: 2, saturation: 1.3 },
  faded: { lightness: 10, saturation: 0.45 },
  washed: { lightness: 8, saturation: 0.45 },
  dusty: { lightness: 4, saturation: 0.5 },
  muted: { lightness: 2, saturation: 0.55 },
  vintage: { lightness: 6, saturation: 0.55 },
  heather: { lightness: 12, saturation: 0.35 },
  heathered: { lightness: 12, saturation: 0.35 },
};

/** How far a preceding colour word pulls the base toward itself. */
const TINT_WEIGHT = 0.35;

/** Normalises "Light  Grey" / "light-grey" / "LIGHT_GREY" to "lightgrey". */
function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, "");
}

/** Splits a name into lowercase words, on any non-letter separator. */
function tokenize(name: string): string[] {
  return name
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean);
}

/** Deterministic 32-bit hash, so the same name always yields the same colour. */
function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

type Rgb = { r: number; g: number; b: number };
type Hsl = { h: number; s: number; l: number };

function hexToRgb(hex: string): Rgb {
  const v = hex.replace("#", "");
  const full =
    v.length === 3
      ? v
          .split("")
          .map((c) => c + c)
          .join("")
      : v.slice(0, 6);

  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }: Rgb): string {
  const channel = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;

  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  const l = (max + min) / 2;

  if (delta === 0) return { h: 0, s: 0, l: l * 100 };

  const s = delta / (1 - Math.abs(2 * l - 1));

  let h: number;
  if (max === rn) h = ((gn - bn) / delta) % 6;
  else if (max === gn) h = (bn - rn) / delta + 2;
  else h = (rn - gn) / delta + 4;

  return { h: (((h * 60) % 360) + 360) % 360, s: s * 100, l: l * 100 };
}

function hslToRgb({ h, s, l }: Hsl): Rgb {
  const sn = s / 100;
  const ln = l / 100;

  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = ln - c / 2;

  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];

  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

/** Mix two colours in RGB space. `weight` is how far to move toward `tint`. */
function blend(base: Rgb, tint: Rgb, weight: number): Rgb {
  return {
    r: base.r + (tint.r - base.r) * weight,
    g: base.g + (tint.g - base.g) * weight,
    b: base.b + (tint.b - base.b) * weight,
  };
}

/**
 * Resolve a name by its words: rightmost known colour is the base, other known
 * colours shade it, modifier words adjust it. Returns null when no word in the
 * name names a colour, so the caller can fall through.
 */
function resolveByTokens(tokens: string[]): string | null {
  const colorIndices = tokens
    .map((token, index) => (NAMED_COLORS[token] ? index : -1))
    .filter((index) => index >= 0);

  if (colorIndices.length === 0) return null;

  // Head-final: the last colour word is what the garment actually is.
  const baseIndex = colorIndices[colorIndices.length - 1];
  let rgb = hexToRgb(NAMED_COLORS[tokens[baseIndex]]);

  // Any colour word before it is a tint — "Slate Grey" is a grey pulled
  // toward slate. Without this, "Stone Grey" and "Slate Grey" would be
  // identical, and the catalogue uses both.
  for (const index of colorIndices) {
    if (index === baseIndex) continue;
    rgb = blend(rgb, hexToRgb(NAMED_COLORS[tokens[index]]), TINT_WEIGHT);
  }

  const modifiers = tokens
    .map((token) => MODIFIERS[token])
    .filter((modifier): modifier is NonNullable<typeof modifier> => !!modifier);

  if (modifiers.length === 0) return rgbToHex(rgb);

  const hsl = rgbToHsl(rgb);
  for (const modifier of modifiers) {
    hsl.l += modifier.lightness;
    hsl.s *= modifier.saturation;
  }

  // Clamped rather than wrapped: "Light White" must stay white, not roll over
  // into black.
  hsl.l = Math.max(0, Math.min(100, hsl.l));
  hsl.s = Math.max(0, Math.min(100, hsl.s));

  return rgbToHex(hslToRgb(hsl));
}

/**
 * Resolves a variant colour name to a CSS colour.
 *
 * Never returns a transparent or empty value, so a swatch always renders
 * something.
 */
export function resolveColorHex(name: string | null | undefined): string {
  if (!name) return "#6b7280";

  const trimmed = name.trim();
  if (!trimmed) return "#6b7280";

  // Already a hex literal (3, 6, or 8 digits).
  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(trimmed)) {
    return trimmed;
  }

  // The whole name, separators removed. Checked before token resolution so
  // curated compounds ("offwhite", "lightgrey", "royalblue") keep their exact
  // hand-picked hex rather than being recomputed from their parts.
  const key = normalize(trimmed);
  if (key && NAMED_COLORS[key]) return NAMED_COLORS[key];

  const resolved = resolveByTokens(tokenize(trimmed));
  if (resolved) return resolved;

  // Nothing in the name is a colour: derive a muted, readable colour from a
  // stable hash so distinct unknowns stay distinguishable.
  const hue = hashName(key || trimmed) % 360;
  return `hsl(${hue} 32% 52%)`;
}
