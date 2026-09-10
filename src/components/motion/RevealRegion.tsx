"use client";

/**
 * Attaches the reveal hook to an unstyled wrapper so a SERVER component can
 * put its subtree on the entrance timeline.
 *
 * `useReveal` finds its targets with `container.querySelectorAll("[data-reveal]")`,
 * so anything carrying `val-reveal` outside a reveal container stays at
 * `opacity: 0` forever. That shipped once already as an invisible banner.
 * Server components cannot call the hook themselves; they render this instead.
 */

import { useReveal } from "@/hooks/use-reveal";

export function RevealRegion({ children }: { children: React.ReactNode }) {
  const ref = useReveal<HTMLDivElement>();
  return <div ref={ref}>{children}</div>;
}
