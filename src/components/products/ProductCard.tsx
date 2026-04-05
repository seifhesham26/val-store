"use client";

import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { WishlistButton } from "@/components/products/WishlistButton";
import {
  QuickAddSliderBar,
  type QuickAddVariant,
} from "@/components/products/QuickAddSliderBar";

export interface ProductCardProps {
  id: string;
  name: string;
  slug: string;
  price: number;
  salePrice?: number;
  primaryImage?: string;
  secondaryImage?: string;
  isNew?: boolean;
  isOnSale?: boolean;
  isFeatured?: boolean;
  variants?: QuickAddVariant[];
}

export function ProductCard({
  id,
  name,
  slug,
  price,
  salePrice,
  primaryImage,
  isNew = false,
  isOnSale = false,
  variants = [],
}: ProductCardProps) {
  const formattedPrice = price.toFixed(2);
  const formattedSalePrice = salePrice?.toFixed(2);

  return (
    <div className="group relative">
      {/* Image Container — wrapped in a link */}
      <Link href={`/products/${slug}`} className="block">
        <div className="relative aspect-3/4 overflow-hidden bg-val-steel">
          {/* Product Image or gradient fallback */}
          {primaryImage ? (
            <Image
              src={primaryImage}
              alt={name}
              fill
              sizes="(max-width: 768px) 50vw, 25vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              unoptimized
            />
          ) : (
            <div className="absolute inset-0 bg-linear-to-br from-gray-700 via-gray-800 to-gray-900" />
          )}

          {/* Badges */}
          <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
            {isNew && (
              <Badge className="bg-val-accent text-white text-xs px-2 py-0.5">
                New
              </Badge>
            )}
            {isOnSale && (
              <Badge variant="destructive" className="text-xs px-2 py-0.5">
                Sale
              </Badge>
            )}
          </div>

          {/* Wishlist Button */}
          <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-all duration-300">
            <WishlistButton
              productId={id}
              className="bg-black/50 hover:bg-val-accent text-white"
            />
          </div>
        </div>
      </Link>

      {/* Quick Add Slider — outside the link to avoid nested interactive elements */}
      <div className="absolute bottom-0 inset-x-0 p-2 pt-8 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 z-10 bg-linear-to-t from-black/90 via-black/60 to-transparent">
        <QuickAddSliderBar
          productId={id}
          productName={name}
          variants={variants}
        />
      </div>

      {/* Product Info */}
      <div className="mt-3">
        <Link href={`/products/${slug}`}>
          <h3 className="text-sm font-medium text-white truncate hover:text-val-accent transition-colors">
            {name}
          </h3>
        </Link>
        <div className="flex items-center gap-2 mt-1">
          {salePrice ? (
            <>
              <span className="text-red-400 font-medium">
                ${formattedSalePrice}
              </span>
              <span className="text-gray-500 line-through text-sm">
                ${formattedPrice}
              </span>
            </>
          ) : (
            <span className="text-gray-300">${formattedPrice}</span>
          )}
        </div>
      </div>
    </div>
  );
}
