/**
 * useInfiniteScroll Hook
 *
 * A reusable hook for implementing infinite scroll with intersection observer.
 * Works with tRPC's useInfiniteQuery.
 *
 * Usage:
 * const { ref, isNearBottom } = useInfiniteScroll({
 *   onLoadMore: () => fetchNextPage(),
 *   enabled: hasNextPage && !isFetchingNextPage,
 * });
 */

import { useEffect, useRef, useCallback, useState } from "react";

interface UseInfiniteScrollOptions {
  /** Callback to load more items */
  onLoadMore: () => void;
  /** Whether to enable the observer */
  enabled?: boolean;
  /** Root margin for intersection observer (default: PREFETCH_MARGIN) */
  rootMargin?: string;
  /** Threshold for intersection (default: 0.1) */
  threshold?: number;
}

/**
 * How far ahead of the sentinel to start loading the next page.
 *
 * This was 100px, which meant the request only began once the customer was
 * essentially already at the bottom — so they met the spinner every single
 * time, on every page, no matter how fast the query was. Roughly a screen's
 * worth of lead time is enough for the next page to arrive before it is
 * scrolled into view, which is the difference between "infinite scroll" and
 * "scroll, wait, scroll, wait".
 */
const PREFETCH_MARGIN = "800px";

interface UseInfiniteScrollReturn {
  /** Ref to attach to the sentinel element */
  ref: React.RefCallback<HTMLElement>;
  /** Whether the sentinel is near the bottom (visible) */
  isNearBottom: boolean;
}

export function useInfiniteScroll({
  onLoadMore,
  enabled = true,
  rootMargin = PREFETCH_MARGIN,
  threshold = 0.1,
}: UseInfiniteScrollOptions): UseInfiniteScrollReturn {
  const [isNearBottom, setIsNearBottom] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLElement | null>(null);

  const handleIntersection = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      setIsNearBottom(entry.isIntersecting);

      if (entry.isIntersecting && enabled) {
        onLoadMore();
      }
    },
    [onLoadMore, enabled]
  );

  // Cleanup observer
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  // Ref callback to handle sentinel element
  const ref = useCallback(
    (node: HTMLElement | null) => {
      // Cleanup previous observer
      if (observerRef.current) {
        observerRef.current.disconnect();
      }

      // Store reference
      sentinelRef.current = node;

      // Create new observer if we have a node
      if (node) {
        observerRef.current = new IntersectionObserver(handleIntersection, {
          rootMargin,
          threshold,
        });
        observerRef.current.observe(node);
      }
    },
    [handleIntersection, rootMargin, threshold]
  );

  return { ref, isNearBottom };
}

/**
 * Infinite scroll with container scroll
 *
 * Alternative hook for infinite scroll within a scrollable container.
 */
export function useContainerInfiniteScroll(
  containerRef: React.RefObject<HTMLElement>,
  onLoadMore: () => void,
  enabled: boolean = true,
  threshold: number = 100
) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (!enabled) return;

      const { scrollTop, scrollHeight, clientHeight } = container;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

      if (distanceFromBottom < threshold) {
        onLoadMore();
      }
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [containerRef, onLoadMore, enabled, threshold]);
}
