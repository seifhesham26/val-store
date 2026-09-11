/**
 * Valkyrie Loader
 *
 * The store's branded loading indicator: a hexagonal shield track with a
 * travelling steel-accent segment orbiting a pulsing "V" chevron. Used instead
 * of a generic spinner anywhere the storefront waits on data.
 *
 * Motion is disabled automatically under `prefers-reduced-motion` (see the
 * Valkyrie loading system block in `globals.css`).
 */

import { cn } from "@/lib/utils";

const SIZES = {
  xs: 16,
  sm: 22,
  md: 34,
  lg: 52,
} as const;

/** Pointy-top hexagon inscribed in the 48x48 viewBox. Perimeter ~= 125.4. */
const HEX_POINTS = "24,3 42,13.5 42,34.5 24,45 6,34.5 6,13.5";

interface ValkyrieLoaderProps {
  /** Visual size of the mark. Defaults to `md`. */
  size?: keyof typeof SIZES;
  /** Optional caption rendered under the mark. */
  label?: string;
  /** Render bare, with no wrapper or screen-reader text — for use inside a control that already has a visible label. */
  inline?: boolean;
  className?: string;
}

export function ValkyrieLoader({
  size = "md",
  label,
  inline,
  className,
}: ValkyrieLoaderProps) {
  const px = SIZES[size];

  const svg = (
    <svg
      width={px}
      height={px}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden={inline ? true : undefined}
      className={inline ? cn("shrink-0", className) : undefined}
    >
      <defs>
        <linearGradient
          id="val-loader-arc"
          x1="4"
          y1="4"
          x2="44"
          y2="44"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="var(--val-silver)" />
          <stop offset="0.55" stopColor="var(--val-accent)" />
          <stop offset="1" stopColor="var(--val-accent)" stopOpacity="0.15" />
        </linearGradient>
      </defs>

      {/* Static shield track */}
      <polygon
        points={HEX_POINTS}
        stroke="currentColor"
        strokeOpacity="0.14"
        strokeWidth="1.5"
        strokeLinejoin="round"
        className="val-loader__track"
      />

      {/* Travelling accent segment */}
      <polygon
        points={HEX_POINTS}
        stroke="url(#val-loader-arc)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="30 95.4"
        className="val-loader__ring"
      />

      {/* Core chevron */}
      <path
        d="M16.5 20.5 24 30l7.5-9.5"
        stroke="var(--val-accent-light)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="val-loader__mark"
      />
    </svg>
  );

  if (inline) {
    return svg;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex flex-col items-center gap-3", className)}
    >
      {svg}

      {label ? (
        <span className="val-loader__label text-[11px] font-medium uppercase tracking-[0.28em] text-gray-500">
          {label}
        </span>
      ) : null}

      <span className="sr-only">Loading</span>
    </div>
  );
}
