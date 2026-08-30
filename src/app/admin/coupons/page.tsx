"use client";

/**
 * Admin Coupons Page
 *
 * List and manage discount coupons.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { CouponsHeader } from "@/components/admin/coupons/CouponsHeader";
import {
  CouponsTable,
  type CouponRow,
} from "@/components/admin/coupons/CouponsTable";
import { CouponFormDialog } from "@/components/admin/coupons/CouponFormDialog";

export default function AdminCouponsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<CouponRow | null>(null);

  const { data: coupons, isLoading } = trpc.admin.coupons.list.useQuery();
  const utils = trpc.useUtils();

  const createMutation = trpc.admin.coupons.create.useMutation({
    onSuccess: () => {
      utils.admin.coupons.list.invalidate();
      setDialogOpen(false);
      toast.success("Coupon created");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.admin.coupons.update.useMutation({
    onSuccess: () => {
      utils.admin.coupons.list.invalidate();
      setDialogOpen(false);
      setEditingCoupon(null);
      toast.success("Coupon updated");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.admin.coupons.delete.useMutation({
    onSuccess: () => {
      utils.admin.coupons.list.invalidate();
      toast.success("Coupon deleted");
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleMutation = trpc.admin.coupons.toggleActive.useMutation({
    onSuccess: () => {
      utils.admin.coupons.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  /** Blank optional field means "clear it", not "leave it alone". */
  const text = (form: FormData, name: string) => {
    const value = (form.get(name) as string | null)?.trim();
    return value ? value : null;
  };

  const wholeNumber = (form: FormData, name: string) => {
    const value = text(form, name);
    if (value === null) return null;
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const startsAt = text(formData, "startsAt");
    const expiresAt = text(formData, "expiresAt");

    const data = {
      code: formData.get("code") as string,
      description: text(formData, "description"),
      discountType: formData.get("discountType") as "percentage" | "fixed",
      discountValue: formData.get("discountValue") as string,
      minPurchaseAmount: text(formData, "minPurchaseAmount"),
      maxDiscountAmount: text(formData, "maxDiscountAmount"),
      usageLimit: wholeNumber(formData, "usageLimit"),
      perUserLimit: wholeNumber(formData, "perUserLimit") ?? 1,
      isActive: formData.get("isActive") === "on",
      // A date input gives a bare day. Start of that day for "starts", end of
      // it for "expires" — otherwise a coupon dated today expires at midnight
      // this morning, i.e. before the day it is supposed to cover.
      //
      // Anchored to UTC rather than the browser's zone: the column has no time
      // zone, so parsing as local time would store a different instant
      // depending on where the admin happens to be sitting.
      startsAt: startsAt ? new Date(`${startsAt}T00:00:00.000Z`) : null,
      expiresAt: expiresAt ? new Date(`${expiresAt}T23:59:59.999Z`) : null,
    };

    if (editingCoupon) {
      updateMutation.mutate({ id: editingCoupon.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <CouponsHeader
        onAdd={() => {
          setEditingCoupon(null);
          setDialogOpen(true);
        }}
      />
      <CouponsTable
        coupons={coupons ?? []}
        onEdit={(coupon) => {
          setEditingCoupon(coupon);
          setDialogOpen(true);
        }}
        onToggle={(id) => toggleMutation.mutate({ id })}
        onDelete={(id) => deleteMutation.mutate({ id })}
      />
      <CouponFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingCoupon(null);
        }}
        coupon={editingCoupon}
        isPending={createMutation.isPending || updateMutation.isPending}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
