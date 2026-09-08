"use client";

/**
 * Wishlist Page (Account)
 *
 * Displays user's saved items within the account layout.
 */

import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { cachePatch, runOptimistic } from "@/lib/optimistic-patches";
import { showRetryToast } from "@/lib/optimistic-toast";

import { WishlistLoading } from "@/components/account/wishlist/WishlistLoading";
import { WishlistEmpty } from "@/components/account/wishlist/WishlistEmpty";
import { WishlistGrid } from "@/components/account/wishlist/WishlistGrid";

export default function WishlistPage() {
  const utils = trpc.useUtils();

  const { data: wishlistItems, isLoading } =
    trpc.public.wishlist.getMyWishlist.useQuery();

  // Hoisted so the mutation's own `onError` can re-run it without TypeScript
  // having to infer the mutation's type from options that reference it.
  function retryRemove(productId: string) {
    removeMutation.mutate({ productId });
  }

  const removeMutation = trpc.public.wishlist.removeFromWishlist.useMutation({
    // Three caches move together: the grid, the navbar count, and the heart on
    // any product card showing this product.
    onMutate: ({ productId }) =>
      runOptimistic([
        cachePatch({
          cancel: () => utils.public.wishlist.getMyWishlist.cancel(),
          read: () => utils.public.wishlist.getMyWishlist.getData(),
          write: (data) =>
            utils.public.wishlist.getMyWishlist.setData(undefined, data),
          invalidate: () => utils.public.wishlist.getMyWishlist.invalidate(),
          patch: (items) =>
            items?.filter((item) => item.productId !== productId),
        }),
        cachePatch({
          cancel: () => utils.public.wishlist.getCount.cancel(),
          read: () => utils.public.wishlist.getCount.getData(),
          write: (data) =>
            utils.public.wishlist.getCount.setData(undefined, data),
          invalidate: () => utils.public.wishlist.getCount.invalidate(),
          patch: (current) =>
            current && { count: Math.max(0, current.count - 1) },
        }),
        cachePatch({
          cancel: () => utils.public.wishlist.checkStatus.cancel({ productId }),
          read: () => utils.public.wishlist.checkStatus.getData({ productId }),
          write: (data) =>
            utils.public.wishlist.checkStatus.setData({ productId }, data),
          invalidate: () =>
            utils.public.wishlist.checkStatus.invalidate({ productId }),
          patch: () => ({ inWishlist: false }) as const,
        }),
      ]),
    onSuccess: () => {
      toast.success("Removed from wishlist");
    },
    onError: (_err, variables, handle) => {
      handle?.rollback();
      showRetryToast("Couldn't remove that from your wishlist.", () =>
        retryRemove(variables.productId)
      );
    },
    onSettled: (_data, _err, _variables, handle) => {
      handle?.settle();
    },
  });

  const handleRemove = (productId: string) => {
    removeMutation.mutate({ productId });
  };

  if (isLoading) return <WishlistLoading />;
  if (!wishlistItems || wishlistItems.length === 0) return <WishlistEmpty />;

  return <WishlistGrid items={wishlistItems} onRemove={handleRemove} />;
}
