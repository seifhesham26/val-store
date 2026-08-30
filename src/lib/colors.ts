/**
 * Colour name resolution
 *
 * `product_variants.color` stores a free-text name ("Navy", "Olive") — there is
 * no hex column in the schema. Swatches therefore have to resolve a name to a
 * displayable colour here.
 *
 * Resolution order:
 *   1. The value is already a hex literal ("#1e293b") — use it as-is.
 *   2. A known apparel colour name — use the curated hex.
 *   3. Anything else — derive a stable hue from the name so unknown colours are
 *      at least distinguishable from one another instead of all rendering black.
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

/** Normalises "Light  Grey" / "light-grey" / "LIGHT_GREY" to "lightgrey". */
function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, "");
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

/**
 * Resolves a variant colour name to a CSS colour.
 *
 * Never returns a transparent or empty value, so a swatch always renders
 * something.
 */
export function resolveColorHex(name: string | null | undefined): string {
  if (!name) return "#6b7280";

  const trimmed = name.trim();

  // Already a hex literal (3, 6, or 8 digits).
  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(trimmed)) {
    return trimmed;
  }

  const key = normalize(trimmed);
  if (key && NAMED_COLORS[key]) return NAMED_COLORS[key];

  // Unknown name: derive a muted, readable colour from a stable hash.
  const hue = hashName(key || trimmed) % 360;
  return `hsl(${hue} 32% 52%)`;
}
