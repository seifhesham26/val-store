"use client";

/**
 * Wishlist Button
 *
 * Heart icon button to toggle wishlist status.
 */

import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

// UUID v4 format check — prevents queries with mock/placeholder IDs (e.g. "na1")
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isValidUUID = (id: string) => UUID_RE.test(id);

interface WishlistButtonProps {
  productId: string;
  variant?: "default" | "ghost" | "outline" | "secondary";
  className?: string;
}

export function WishlistButton({
  productId,
  variant = "ghost",
  className,
}: WishlistButtonProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const utils = trpc.useUtils();

  // Only query when user is logged in AND productId is a real UUID
  const isRealProduct = isValidUUID(productId);

  // Check status
  const { data: wishlistStatus } = trpc.public.wishlist.checkStatus.useQuery(
    { productId },
    {
      enabled: !!session?.user && isRealProduct,
      initialData: { inWishlist: false },
    }
  );

  const isInWishlist = wishlistStatus?.inWishlist ?? false;

  const addMutation = trpc.public.wishlist.addToWishlist.useMutation({
    onMutate: async () => {
      await utils.public.wishlist.checkStatus.cancel({ productId });
      const previousStatus = utils.public.wishlist.checkStatus.getData({
        productId,
      }) as { inWishlist: boolean } | undefined;
      utils.public.wishlist.checkStatus.setData(
        { productId },
        { inWishlist: true }
      );
      return { previousStatus };
    },
    onSuccess: () => {
      utils.public.wishlist.getMyWishlist.invalidate();
      utils.public.wishlist.getCount.invalidate();
      toast("Added to wishlist");
    },
    onError: (_err, _variables, context) => {
      utils.public.wishlist.checkStatus.setData(
        { productId },
        context?.previousStatus ?? { inWishlist: false }
      );
      toast.error("Failed to add to wishlist");
    },
    onSettled: () => {
      utils.public.wishlist.checkStatus.invalidate({ productId });
    },
  });

  const removeMutation = trpc.public.wishlist.removeFromWishlist.useMutation({
    onMutate: async () => {
      await utils.public.wishlist.checkStatus.cancel({ productId });
      const previousStatus = utils.public.wishlist.checkStatus.getData({
        productId,
      }) as { inWishlist: boolean } | undefined;
      utils.public.wishlist.checkStatus.setData(
        { productId },
        { inWishlist: false }
      );
      return { previousStatus };
    },
    onSuccess: () => {
      utils.public.wishlist.getMyWishlist.invalidate();
      utils.public.wishlist.getCount.invalidate();
      toast("Removed from wishlist");
    },
    onError: (_err, _variables, context) => {
      utils.public.wishlist.checkStatus.setData(
        { productId },
        context?.previousStatus ?? { inWishlist: true }
      );
      toast.error("Failed to remove from wishlist");
    },
    onSettled: () => {
      utils.public.wishlist.checkStatus.invalidate({ productId });
    },
  });

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!session?.user) {
      router.push(`/login?redirect=${window.location.pathname}`);
      return;
    }

    if (!isRealProduct) {
      toast.error("This product is not available for wishlisting yet.");
      return;
    }

    if (isInWishlist) {
      removeMutation.mutate({ productId });
    } else {
      addMutation.mutate({ productId });
    }
  };

  return (
    <Button
      variant={variant}
      size="icon"
      className={cn("rounded-full", className)}
      onClick={handleToggle}
    >
      <Heart
        className={cn(
          "h-5 w-5 transition-colors",
          isInWishlist ? "fill-red-500 text-red-500" : "text-muted-foreground"
        )}
      />
      <span className="sr-only">
        {isInWishlist ? "Remove from wishlist" : "Add to wishlist"}
      </span>
    </Button>
  );
}
