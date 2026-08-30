"use client";

/**
 * Payment Window Notice
 *
 * An unpaid card order has already reserved its stock, so it is held for a
 * fixed window and then released automatically. During that window it must not
 * be cancelled by hand — the customer may be on Stripe's page entering a card,
 * and taking the stock back mid-payment would leave Stripe charging for an
 * order that no longer exists.
 *
 * This says so, and counts down, so the disabled Cancel button is explained
 * rather than just broken-looking.
 */

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

interface PaymentWindowNoticeProps {
  /** ISO timestamp — no tRPC date transformer, so dates arrive as strings. */
  deadline: string;
}

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${`${seconds}`.padStart(2, "0")}`;
}

export function PaymentWindowNotice({ deadline }: PaymentWindowNoticeProps) {
  const target = new Date(deadline).getTime();

  // The admin area is client-rendered and this only appears once the order has
  // loaded over tRPC, so seeding from the clock here is safe.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = target - now;
  const elapsed = remaining <= 0;

  return (
    <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
      <Clock className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        {elapsed ? (
          <p>
            The payment window has closed. This order will be cancelled and its
            stock returned on the next check.
          </p>
        ) : (
          <>
            <p>
              Waiting for payment —{" "}
              <span className="font-semibold tabular-nums">
                {formatRemaining(remaining)}
              </span>{" "}
              left.
            </p>
            <p className="mt-1 text-xs opacity-80">
              It cannot be cancelled while the customer may still be paying. If
              no payment arrives it is cancelled automatically and the stock
              goes back.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
