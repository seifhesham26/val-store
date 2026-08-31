import Link from "next/link";
import Image from "next/image";
import { Heart, ShoppingCart, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/currency";
import { AppRouter } from "@/server";
import { inferRouterOutputs } from "@trpc/server";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type WishlistItem =
  RouterOutputs["public"]["wishlist"]["getMyWishlist"][number];

interface WishlistGridProps {
  items: WishlistItem[];
  onRemove: (productId: string) => void;
}

export function WishlistGrid({ items, onRemove }: WishlistGridProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">My Wishlist</h2>
        <p className="text-gray-400">
          {items.length} saved item{items.length !== 1 && "s"}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => {
          // `inStock` is real stock — active *and* at least one available
          // variant with units left. A sold-out product must not offer a route
          // to the cart, because the product page has nothing to add.
          const outOfStock = !item.inStock;

          return (
            <div
              key={item.productId}
              className="bg-zinc-900 border border-white/10 rounded-lg overflow-hidden flex flex-col group"
            >
              <div className="relative aspect-square bg-white/[0.04]">
                {item.productImage ? (
                  <Image
                    src={item.productImage}
                    alt={item.productImageAlt ?? item.productName}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    className={`object-cover ${
                      outOfStock ? "opacity-40 grayscale" : ""
                    }`}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-600">
                    <Heart className="h-10 w-10" />
                  </div>
                )}

                {outOfStock && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <Badge
                      variant="outline"
                      className="border-white/20 bg-black/80 text-white text-xs tracking-wide uppercase"
                    >
                      Out of Stock
                    </Badge>
                  </div>
                )}
              </div>

              <div className="p-4 flex-1 flex flex-col">
                <Link
                  href={`/products/${item.productSlug}`}
                  className="hover:text-val-accent transition-colors"
                >
                  <h3 className="text-sm font-medium text-white line-clamp-1">
                    {item.productName}
                  </h3>
                </Link>
                <p
                  className={`font-semibold mt-1 ${
                    outOfStock ? "text-gray-500" : "text-white"
                  }`}
                >
                  {formatCurrency(
                    Number(item.productSalePrice ?? item.productPrice)
                  )}
                </p>
                {outOfStock && (
                  <p className="text-xs text-gray-500 mt-1">
                    Unavailable right now — it stays saved here.
                  </p>
                )}

                <div className="flex gap-2 mt-auto pt-4">
                  {/* A wishlist entry is a product, not a variant — the size
                      and colour were never chosen. Send the customer to the
                      product page to pick, rather than guessing for them. */}
                  {outOfStock ? (
                    <Button
                      disabled
                      className="flex-1 bg-white/5 text-gray-500 font-medium text-sm"
                      size="sm"
                    >
                      Out of Stock
                    </Button>
                  ) : (
                    <Button
                      asChild
                      className="flex-1 bg-val-accent hover:bg-val-accent/90 text-black font-medium text-sm"
                      size="sm"
                    >
                      <Link href={`/products/${item.productSlug}`}>
                        <ShoppingCart className="mr-2 h-4 w-4" />
                        Choose Options
                      </Link>
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => onRemove(item.productId)}
                    className="border-white/10 text-red-400 hover:text-red-300 hover:bg-red-500/10 hover:border-red-500/20 h-9 w-9"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
