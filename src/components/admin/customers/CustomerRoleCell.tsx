"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { trpc } from "@/lib/trpc";
import type { UserRole } from "@/domain/customers/value-objects/user-role";

const ROLE_LABELS: Record<UserRole, string> = {
  customer: "Customer",
  worker: "Worker",
  admin: "Admin",
  super_admin: "Super Admin",
};

const ASSIGNABLE_ROLES: UserRole[] = [
  "customer",
  "worker",
  "admin",
  "super_admin",
];

const ROLE_BADGE_VARIANT: Record<
  UserRole,
  "outline" | "secondary" | "default"
> = {
  customer: "outline",
  worker: "secondary",
  admin: "default",
  super_admin: "default",
};

/**
 * Promoting to `admin` or `super_admin` grants access to every customer's
 * data and order history, so it asks for a second click rather than
 * committing on the first one — the same bar as cancelling an order.
 */
const ROLES_REQUIRING_CONFIRMATION = new Set<UserRole>([
  "admin",
  "super_admin",
]);

interface CustomerRoleCellProps {
  userId: string;
  role: UserRole;
  /** False for a non-super_admin viewer, or for the viewer's own row. */
  editable: boolean;
}

export function CustomerRoleCell({
  userId,
  role,
  editable,
}: CustomerRoleCellProps) {
  const [pendingRole, setPendingRole] = useState<UserRole | null>(null);
  const utils = trpc.useUtils();

  const updateRole = trpc.admin.customers.updateRole.useMutation({
    onSuccess: () => {
      toast.success("Role updated");
      utils.admin.customers.list.invalidate();
      utils.admin.customers.getById.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update role");
    },
  });

  if (!editable) {
    return (
      <Badge variant={ROLE_BADGE_VARIANT[role]}>{ROLE_LABELS[role]}</Badge>
    );
  }

  const handleChange = (next: string) => {
    const nextRole = next as UserRole;
    if (nextRole === role) return;

    if (ROLES_REQUIRING_CONFIRMATION.has(nextRole)) {
      setPendingRole(nextRole);
      return;
    }

    updateRole.mutate({ userId, role: nextRole });
  };

  return (
    <>
      <Select
        value={role}
        onValueChange={handleChange}
        disabled={updateRole.isPending}
      >
        <SelectTrigger className="h-8 w-[130px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ASSIGNABLE_ROLES.map((r) => (
            <SelectItem key={r} value={r}>
              {ROLE_LABELS[r]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <AlertDialog
        open={pendingRole !== null}
        onOpenChange={(open) => !open && setPendingRole(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Change role to {pendingRole ? ROLE_LABELS[pendingRole] : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRole === "super_admin"
                ? "This grants full access to the admin area, including changing other people's roles."
                : "This grants write access to every admin screen, including this customer's own order and address history."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingRole) {
                  updateRole.mutate({ userId, role: pendingRole });
                }
                setPendingRole(null);
              }}
              disabled={updateRole.isPending}
            >
              {updateRole.isPending && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
