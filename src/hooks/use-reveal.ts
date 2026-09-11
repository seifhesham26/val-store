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

import { useCallback, useRef, useState } from "react";
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
  /**
   * The attached node, tracked as state so the effect re-runs when it arrives.
   *
   * A plain ref is not enough. A component that early-returns a skeleton while
   * its query resolves does not render the ref'd element at all on first pass,
   * so the effect sees `null`; with a fixed dependency list it would never run
   * again once the real tree mounted, and every target inside it would sit at
   * `opacity: 0` forever. That is exactly what hid the product reviews panel.
   */
  const [node, setNode] = useState<T | null>(null);
  /**
   * Survives across effect runs on purpose.
   *
   * React runs effects twice in development (mount, clean up, mount again). A
   * set scoped to the effect body would be empty on the second run and every
   * element would be granted a second slot.
   */
  const claimedRef = useRef<WeakSet<Element>>(new WeakSet());

  useGSAP(
    () => {
      const container = containerRef.current;
      if (!container) return;

      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

      /**
       * Elements already granted a slot.
       *
       * A section whose content arrives from a query renders a skeleton first,
       * so the targets present when the region is first revealed are not the
       * targets that end up on screen. Without tracking this, the late arrivals
       * are never claimed by anything and sit at `opacity: 0` permanently —
       * which is what hid the homepage's New Arrivals carousel and part of the
       * product reviews panel.
       */
      const claimed = claimedRef.current;

      const unclaimed = () =>
        Array.from(
          container.querySelectorAll<HTMLElement>("[data-reveal]")
        ).filter((el) => !claimed.has(el));

      const reveal = (targets: HTMLElement[]) => {
        if (targets.length === 0) return;
        for (const el of targets) claimed.add(el);

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

      /**
       * Watch for targets that mount after the region has been revealed.
       *
       * Only started once the region has played, so below-the-fold content
       * still waits for the viewport rather than animating unseen.
       */
      let mutations: MutationObserver | null = null;

      const watchForLateArrivals = () => {
        mutations = new MutationObserver(() => reveal(unclaimed()));
        mutations.observe(container, { childList: true, subtree: true });
      };

      const play = () => {
        playedRef.current = true;
        reveal(unclaimed());
        watchForLateArrivals();
      };

      // `playedRef` in the condition, not inside `play`: React's second
      // development effect run tears the watcher down, and an early return
      // here would never rebuild it — leaving every late-arriving target
      // stranded at `opacity: 0`. Guarding entry instead means a re-run
      // re-establishes the watcher, while `claimed` stops anything being
      // animated twice.
      if (reducedMotion || playedRef.current) {
        play();
        return () => mutations?.disconnect();
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

      return () => {
        observer.disconnect();
        mutations?.disconnect();
      };
    },
    { scope: containerRef, dependencies: [node] }
  );

  /**
   * A callback ref, not the ref object — this is what lets the hook notice a
   * container that mounts later. Assigning `containerRef` keeps `useGSAP`'s
   * scope working; the state update is what re-runs the effect.
   */
  const setContainer = useCallback((el: T | null) => {
    containerRef.current = el;
    setNode(el);
  }, []);

  return setContainer;
}
