"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches;
}

/**
 * Whether the visitor has asked their system to reduce motion.
 *
 * `useSyncExternalStore` rather than `useState` + `useEffect`: the media query
 * is external state, subscribing to it is exactly what this hook is for, and
 * React 19 flags setting state inside an effect. The cart badge uses the same
 * approach for the same reason.
 *
 * The server snapshot returns `true` — assume reduced motion until the client
 * says otherwise. Guessing the other way would start an animation during
 * hydration and then stop it, which is precisely the flash of movement someone
 * with this setting enabled is trying to avoid.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => true);
}
