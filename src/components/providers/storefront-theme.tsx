"use client";

import { useEffect, useLayoutEffect } from "react";

/**
 * Keeps the storefront on the dark token set.
 *
 * The root layout server-renders `<html class="dark">`, which is what makes
 * every shadcn primitive and every Radix portal resolve the right tokens — a
 * portal attaches under `<body>`, so a class on a storefront wrapper would
 * never reach it, but a class on `<html>` does.
 *
 * The admin tree runs `next-themes`, which writes the resolved theme onto that
 * same element. That is correct while you are in `/admin`, but the provider
 * unmounts on the way out and leaves `class="light"` behind, and the root
 * layout does not re-render its `className` on a client-side navigation. Both
 * directions are reachable by a normal click — `AdminSidebar` links to `/` and
 * `Navbar` links to `/admin` — so without this the storefront renders on the
 * light palette until the next hard reload.
 *
 * A layout effect rather than a passive one: it runs before the browser paints
 * the new route, so the corrected class is in place for the first frame
 * instead of one frame late.
 */
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function StorefrontTheme() {
  useIsomorphicLayoutEffect(() => {
    const root = document.documentElement;
    if (!root.classList.contains("dark")) {
      root.classList.remove("light");
      root.classList.add("dark");
    }
  });

  return null;
}
