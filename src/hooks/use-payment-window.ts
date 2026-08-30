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

import { useEffect, useState } from "react";

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

export function usePaymentWindow(
  deadline: string | Date | null | undefined
): PaymentWindow {
  const target = deadline ? new Date(deadline).getTime() : null;
  const hasWindow = target !== null && !Number.isNaN(target);

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!hasWindow) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [hasWindow, target]);

  if (!hasWindow) {
    return { open: false, remainingMs: null, label: null };
  }

  const remainingMs = Math.max(0, target - now);

  return {
    open: remainingMs > 0,
    remainingMs,
    label: formatRemaining(remainingMs),
  };
}
