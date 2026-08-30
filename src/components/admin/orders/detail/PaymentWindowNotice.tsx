"use client";

/**
 * Payment Window Notice
 *
 * An unpaid card order has already reserved its stock, so it is held for a
 * fixed window and then resolved automatically. During that window it must not
 * be cancelled by hand — the customer may be on Stripe's page entering a card,
 * and taking the stock back mid-payment would leave Stripe charging for an
 * order that no longer exists.
 *
 * This says so, and counts down, so the disabled Cancel button is explained
 * rather than just looking broken.
 */

import { Clock } from "lucide-react";
import { usePaymentWindow } from "@/hooks/use-payment-window";

interface PaymentWindowNoticeProps {
  /** ISO timestamp — no tRPC date transformer, so dates arrive as strings. */
  deadline: string;
}

export function PaymentWindowNotice({ deadline }: PaymentWindowNoticeProps) {
  const { open, label } = usePaymentWindow(deadline);

  return (
    <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
      <Clock className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        {open ? (
          <>
            <p>
              Waiting for payment —{" "}
              <span className="font-semibold tabular-nums">{label}</span> left.
            </p>
            <p className="mt-1 text-xs opacity-80">
              It cannot be cancelled while the customer may still be paying.
            </p>
          </>
        ) : (
          <p>
            The payment window has closed. On the next check this order is
            either recovered — if the payment went through and the confirmation
            was simply lost — or cancelled with its stock returned.
          </p>
        )}
      </div>
    </div>
  );
}
