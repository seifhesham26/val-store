/**
 * Coupon Field
 *
 * The one coupon control on the storefront. It takes no props: the cart owns
 * the applied code, so this reads `cart.get` and writes through
 * `cart.applyCoupon` / `cart.removeCoupon` rather than being handed state by
 * whichever surface mounts it.
 *
 * Two things it deliberately never shows:
 *
 * - **A discount amount.** Applying a coupon records the code and computes no
 *   money; checkout is the only thing that prices it. A number here would be a
 *   second answer that could disagree with the charge.
 * - **Anything about expiry.** The hold has an internal freshness window; it is
 *   a server implementation detail and a countdown would invite the customer to
 *   race it.
 *
 * A rejected code is an ordinary answer to a reasonable question, so it renders
 * inline under the input — the customer is looking straight at the field. A
 * coupon dropped by a background re-check is the opposite case and toasts,
 * because it happened while they were not looking.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Tag, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { useSession } from "@/lib/auth-client";

export function CouponField() {
  const { data: session } = useSession();
  const isAuthenticated = !!session?.user;
  const utils = trpc.useUtils();

  // Same key and same options as CartProvider's query, so this shares that
  // cache entry and issues no request of its own. A shorter staleTime here
  // would silently refetch the cart on every mount of this component.
  const { data: cart } = trpc.public.cart.get.useQuery(undefined, {
    enabled: isAuthenticated,
    staleTime: 1000 * 60,
    refetchOnWindowFocus: false,
  });

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const applyCoupon = trpc.public.cart.applyCoupon.useMutation({
    onSuccess: async (result) => {
      if (!result.applied) {
        // Not an exception — the procedure answers `{ applied: false, error }`
        // precisely so the message can land under the field.
        setError(result.error ?? "That code cannot be used right now.");
        return;
      }
      setCode("");
      setError(null);
      await utils.public.cart.get.invalidate();
    },
    onError: (err) => setError(err.message),
  });

  const removeCoupon = trpc.public.cart.removeCoupon.useMutation({
    onSuccess: async () => {
      setError(null);
      await utils.public.cart.get.invalidate();
    },
    onError: (err) => setError(err.message),
  });

  // `couponRemoved` is set on the single read that dropped the coupon, but that
  // response then sits in the React Query cache and re-renders with it. The ref
  // makes this fire once per occurrence rather than once per render, and the
  // stable sonner id collapses the two mounted CouponFields (drawer plus page)
  // into one toast rather than two.
  const notifiedRef = useRef<string | null>(null);

  useEffect(() => {
    const removed = cart?.couponRemoved;

    if (!removed) {
      notifiedRef.current = null;
      return;
    }

    const key = `${removed.code}:${removed.reason}`;
    if (notifiedRef.current === key) return;
    notifiedRef.current = key;

    toast.warning(`Coupon ${removed.code} was removed`, {
      id: `cart-coupon-removed-${removed.code}`,
      description: removed.reason,
    });
  }, [cart?.couponRemoved]);

  // A guest has no server cart to hold a code, and `applyCoupon` is a
  // protected procedure — rendering the field would offer an action that
  // cannot succeed.
  if (!isAuthenticated) return null;

  const applied = cart?.appliedCoupon ?? null;

  if (applied) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-val-accent/30 bg-val-accent/10 px-3 py-2">
        <span className="flex min-w-0 items-center gap-2">
          <Tag className="h-4 w-4 shrink-0 text-val-accent" />
          <span className="truncate font-mono text-sm font-semibold tracking-wide text-white">
            {applied.code}
          </span>
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => removeCoupon.mutate()}
          disabled={removeCoupon.isPending}
          className="h-8 shrink-0 bg-transparent text-gray-400 hover:bg-white/10 hover:text-white"
        >
          {removeCoupon.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <X className="h-4 w-4" />
          )}
          <span className="ml-1">Remove</span>
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = code.trim();
        if (!trimmed || applyCoupon.isPending) return;
        setError(null);
        applyCoupon.mutate({ code: trimmed });
      }}
    >
      <div className="flex gap-2">
        <Input
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          placeholder="Discount code"
          aria-label="Discount code"
          aria-invalid={error ? true : undefined}
          maxLength={64}
          className="h-9 flex-1 border-white/10 bg-white/5 font-mono uppercase text-white placeholder:text-gray-500 placeholder:normal-case"
        />
        <Button
          type="submit"
          disabled={!code.trim() || applyCoupon.isPending}
          className="h-9 shrink-0 bg-val-accent font-medium text-black hover:bg-val-accent/90"
        >
          {applyCoupon.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Apply"
          )}
        </Button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-400">
          {error}
        </p>
      )}
    </form>
  );
}
