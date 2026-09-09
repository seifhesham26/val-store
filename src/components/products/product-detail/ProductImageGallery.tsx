"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { ProductImage } from "@/components/shared/ProductImage";
import { ImageLightbox } from "@/components/products/product-detail/ImageLightbox";
import { WishlistButton } from "@/components/wishlist/WishlistButton";
import { Share2 } from "lucide-react";

interface ProductImageGalleryProps {
  productId: string;
  productName: string;
  images: string[];
  selectedImage: string;
  onSelectImage: (image: string) => void;
  isNew?: boolean;
  isOnSale?: boolean;
}

export function ProductImageGallery({
  productId,
  productName,
  images,
  selectedImage,
  onSelectImage,
  isNew,
  isOnSale,
}: ProductImageGalleryProps) {
  const [lightboxSrc, setLightboxSrc] = React.useState<string | null>(null);

  return (
    <div className="space-y-4">
      {/* Main Image */}
      <div className="relative aspect-3/4 bg-val-steel overflow-hidden border border-white/10 rounded-lg">
        {selectedImage ? (
          // The zoom control covers the image area only. Badges, wishlist
          // and share stay siblings layered above it (z-10) — nesting them
          // inside would be a <button> inside a <button>.
          <button
            type="button"
            className="absolute inset-0 cursor-zoom-in"
            aria-label={`Zoom ${productName}`}
            onClick={() => setLightboxSrc(selectedImage)}
          >
            <ProductImage
              src={selectedImage}
              alt={productName}
              sizes="(max-width: 768px) 100vw, 50vw"
              priority
            />
          </button>
        ) : (
          <div className="absolute inset-0 bg-linear-to-br from-gray-700 via-gray-800 to-gray-900" />
        )}

        {/* Badges */}
        <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
          {isNew && <Badge className="bg-val-accent text-white">New</Badge>}
          {isOnSale && <Badge variant="destructive">Sale</Badge>}
        </div>

        {/* Wishlist & Share */}
        <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
          <WishlistButton
            productId={productId}
            className="bg-black/50 text-white hover:text-val-accent"
          />
          <button
            className="p-2 rounded-full bg-black/50 text-white hover:text-val-accent transition-colors"
            aria-label="Share"
          >
            <Share2 className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Thumbnail Gallery */}
      {images && images.length > 1 && (
        <div className="grid grid-cols-4 gap-2">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => onSelectImage(img)}
              className={`relative aspect-square overflow-hidden rounded-md border-2 transition-all ${
                selectedImage === img
                  ? "border-white"
                  : "border-transparent opacity-70 hover:opacity-100"
              }`}
            >
              <ProductImage
                src={img}
                alt={`${productName} thumbnail ${i + 1}`}
                sizes="(max-width: 768px) 25vw, 12vw"
              />
            </button>
          ))}
        </div>
      )}

      <ImageLightbox
        src={lightboxSrc}
        alt={productName}
        onClose={() => setLightboxSrc(null)}
      />
    </div>
  );
}
