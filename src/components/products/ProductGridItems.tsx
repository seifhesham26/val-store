"use client";

/**
 * Exit and reorder for the product grid.
 *
 * This is the one place Framer Motion earns its bundle. When a filter or sort
 * changes, products *leave* the DOM — CSS cannot animate a node that is already
 * gone, and GSAP has no idea the React data changed. `AnimatePresence` does.
 *
 * `LazyMotion` + `m` rather than the full `motion` bundle: the feature set is
 * loaded asynchronously, so the baseline cost is a few kilobytes instead of ~30.
 *
 * Exits are a deliberate exception to the Timeline Law. Cards leave *together*
 * as one 120ms gesture rather than one at a time — sequencing twelve exits
 * ahead of twelve entrances would cost nearly three seconds per sort change.
 * Entrances stay strictly sequential and are still granted by the conductor.
 */

import { AnimatePresence, LazyMotion, domAnimation, m } from "motion/react";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

export function ProductGridItems({
  /** Changes whenever the filter or sort changes, forcing a full swap. */
  transitionKey,
  className,
  children,
}: {
  transitionKey: string;
  className?: string;
  children: React.ReactNode;
}) {
  const reducedMotion = usePrefersReducedMotion();

  if (reducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <LazyMotion features={domAnimation} strict>
      <AnimatePresence mode="wait" initial={false}>
        <m.div
          key={transitionKey}
          className={className}
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.985 }}
          transition={{ duration: 0.12, ease: "easeOut" }}
        >
          {children}
        </m.div>
      </AnimatePresence>
    </LazyMotion>
  );
}
