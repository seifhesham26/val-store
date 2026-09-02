"use client";

import { Eye } from "lucide-react";
import { useAdminWriteAccess } from "@/hooks/use-admin-write-access";

/**
 * Tells a `worker` why their edits will not stick, before they try one.
 *
 * A read-only account can open every admin screen — that is the point of the
 * tier — so without this the first sign of the restriction is a failed save
 * on a form they just filled in. The server rejects that correctly, but
 * "correctly" and "comprehensibly" are different things.
 *
 * Renders nothing for an admin or super_admin, and nothing while the role is
 * still resolving, so it never flashes at someone it does not apply to.
 */
export function AdminReadOnlyBanner() {
  const { isReadOnly } = useAdminWriteAccess();

  if (!isReadOnly) return null;

  return (
    <div
      role="status"
      className="flex items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-6 py-2 text-sm text-amber-900 dark:text-amber-200"
    >
      <Eye className="size-4 shrink-0" aria-hidden="true" />
      <span>
        <strong className="font-medium">Read-only access.</strong> You can view
        everything here, but saving, creating and deleting are disabled for your
        account.
      </span>
    </div>
  );
}
