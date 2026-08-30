"use client";

/**
 * Wishlist Page (Account)
 *
 * Displays user's saved items within the account layout.
 */

import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

import { WishlistLoading } from "@/components/account/wishlist/WishlistLoading";
import { WishlistEmpty } from "@/components/account/wishlist/WishlistEmpty";
import { WishlistGrid } from "@/components/account/wishlist/WishlistGrid";

export default function WishlistPage() {
  const utils = trpc.useUtils();

  const { data: wishlistItems, isLoading } =
    trpc.public.wishlist.getMyWishlist.useQuery();

  const removeMutation = trpc.public.wishlist.removeFromWishlist.useMutation({
    onSuccess: () => {
      utils.public.wishlist.getMyWishlist.invalidate();
      utils.public.wishlist.getCount.invalidate();
      toast.success("Removed from wishlist");
    },
    onError: (err) => {
      toast.error("Failed to remove from wishlist", {
        description: err.message,
      });
    },
  });

  const handleRemove = (productId: string) => {
    removeMutation.mutate({ productId });
  };

  if (isLoading) return <WishlistLoading />;
  if (!wishlistItems || wishlistItems.length === 0) return <WishlistEmpty />;

  return <WishlistGrid items={wishlistItems} onRemove={handleRemove} />;
}
