"use client";

/**
 * usePaymentWindow
 *
 * A live countdown to an unpaid card order's deadline.
 *
 * The server tells us when the window closes; whether it is still open is a
 * function of the clock, so it has to be recomputed rather than read from a
 * flag baked into the response. Otherwise the moment passes on screen while
 * the UI still believes the order is in flight — and, in the admin, keeps the
 * Cancel button disabled until someone reloads.
 */

import { useEffect, useState, useSyncExternalStore } from "react";

export interface PaymentWindow {
  /** Still inside the window. */
  open: boolean;
  /** Milliseconds left, floored at zero. Null when there is no window. */
  remainingMs: number | null;
  /** `m:ss`, or null when there is no window. */
  label: string | null;
}

function formatRemaining(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${`${seconds}`.padStart(2, "0")}`;
}

// `Date.now()` differs between the server render and the client's first
// paint, so seeding state from it (the old `useState(() => Date.now())`)
// produced two different countdown labels for the same markup — a hydration
// mismatch. The navbar and cart badges solve the same class of problem with
// `useSyncExternalStore` forced to a stable value until mount; this does the
// same rather than reading the live clock during the render React has to
// reconcile against server-rendered HTML.
const emptySubscribe = () => () => {};
function useIsClient(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

export function usePaymentWindow(
  deadline: string | Date | null | undefined
): PaymentWindow {
  const target = deadline ? new Date(deadline).getTime() : null;
  const hasWindow = target !== null && !Number.isNaN(target);
  const isClient = useIsClient();

  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (!hasWindow) return;

    const tick = () => setNow(Date.now());

    // Deliberately not called synchronously here. Setting state in an effect
    // body triggers a cascading render, which `react-hooks/set-state-in-effect`
    // rejects outright — and the point of this effect is to subscribe to an
    // external clock, not to derive state during render. A zero-delay timer
    // reads the same value on the next tick instead, so the placeholder below
    // is visible for one frame rather than a whole second.
    const immediate = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);

    return () => {
      clearTimeout(immediate);
      clearInterval(id);
    };
  }, [hasWindow, target]);

  if (!hasWindow) {
    return { open: false, remainingMs: null, label: null };
  }

  // Server render and the client's pre-hydration pass both land here: `now`
  // stays null until the effect above runs on the client. Assume the window
  // is still open rather than flashing "closed" for a moment and flipping
  // back once the real clock is read.
  if (!isClient || now === null) {
    return { open: true, remainingMs: null, label: "--:--" };
  }

  const remainingMs = Math.max(0, target - now);

  return {
    open: remainingMs > 0,
    remainingMs,
    label: formatRemaining(remainingMs),
  };
}
