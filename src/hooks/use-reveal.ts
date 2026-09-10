"use client";

/**
 * Reveal every `[data-reveal]` descendant of a container, one at a time.
 *
 * The hook does not decide timing — `conductor.enqueue` does, so a section that
 * scrolls into view while another is still playing queues behind rather than
 * animating over it.
 *
 * `useGSAP` rather than a bare `useEffect`: it scopes the timeline to the ref
 * and reverts it on unmount. Without that, navigating away mid-animation leaves
 * a live tween writing inline styles to detached nodes.
 *
 * The reduced-motion preference is read directly from `matchMedia` inside this
 * effect rather than through `usePrefersReducedMotion`. That hook's server
 * snapshot deliberately returns `true` (assume reduced motion until the client
 * proves otherwise, so hydration never flashes movement) — consuming it here
 * would let the effect observe `true` on first run, take the instant-show
 * path, latch `playedRef`, and never animate for anyone. Reading `matchMedia`
 * directly is safe because this callback only ever runs client-side.
 */

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { enqueue } from "@/lib/motion/conductor";

/** Shown instantly, no tween — used for drained elements and reduced motion. */
function showNow(elements: Element[]) {
  for (const el of elements) {
    el.classList.add("val-reveal--shown");
  }
}

export function useReveal<T extends HTMLElement>() {
  const containerRef = useRef<T | null>(null);
  const playedRef = useRef(false);

  useGSAP(
    () => {
      const container = containerRef.current;
      if (!container || playedRef.current) return;

      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

      const play = () => {
        if (playedRef.current) return;
        playedRef.current = true;

        const targets = Array.from(
          container.querySelectorAll<HTMLElement>("[data-reveal]")
        );
        if (targets.length === 0) return;

        const { slots, drainedCount } = enqueue(
          targets.length,
          performance.now(),
          reducedMotion
        );

        showNow(targets.slice(targets.length - drainedCount));

        if (slots.length === 0) return;

        const timeline = gsap.timeline();
        slots.forEach((slot, i) => {
          timeline.to(
            targets[i],
            {
              opacity: 1,
              y: 0,
              duration: slot.durationMs / 1000,
              ease: "power2.out",
              // Class stays in sync so a mid-flight unmount does not leave the
              // element stuck at opacity 0 when React remounts it.
              onComplete: () => targets[i].classList.add("val-reveal--shown"),
            },
            slot.startMs / 1000
          );
        });
      };

      if (reducedMotion) {
        play();
        return;
      }

      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            observer.disconnect();
            play();
          }
        },
        { rootMargin: "0px 0px -10% 0px" }
      );

      observer.observe(container);
      return () => observer.disconnect();
    },
    { scope: containerRef, dependencies: [] }
  );

  return containerRef;
}
