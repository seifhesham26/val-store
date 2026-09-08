/**
 * Retry toast
 *
 * One shape for "that didn't save, and here is the button that tries again",
 * so a failed optimistic write looks the same on every surface. The revert
 * itself is the caller's job — this is only the affordance that follows it.
 */

import { toast } from "sonner";

export const RETRY_ACTION_LABEL = "Retry";

export function showRetryToast(message: string, onRetry: () => void): void {
  toast.error(message, {
    action: { label: RETRY_ACTION_LABEL, onClick: onRetry },
  });
}
