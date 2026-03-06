"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Minus,
  Plus,
  Share2,
  Truck,
  RefreshCw,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WishlistButton } from "@/components/products/WishlistButton";

import Image from "next/image";

interface ProductDetailProps {
  product: {
    id: string;
    name: string;
    slug: string;
    price: number;
    salePrice?: number;
    description: string;
    details?: string[];
    sizes: string[];
    colors?: { name: string; hex: string }[];
    images: string[];
    isNew?: boolean;
    isOnSale?: boolean;
    inStock?: boolean;
  };
}

export function ProductDetail({ product }: ProductDetailProps) {
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(
    product.colors?.[0]?.name || null
  );
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState<string>(
    product.images?.[0] || ""
  );

  const handleAddToCart = () => {
    if (!selectedSize) {
      alert("Please select a size");
      return;
    }
    // TODO: Integrate with cart
    console.log("Adding to cart:", {
      product,
      selectedSize,
      selectedColor,
      quantity,
    });
  };

  return (
    <div className="min-h-screen bg-black">
      {/* Breadcrumb */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <Link
          href="/collections/all"
          className="inline-flex items-center text-sm text-gray-400 hover:text-white transition-colors"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back to Shop
        </Link>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid md:grid-cols-2 gap-8 lg:gap-16">
          {/* Image Gallery */}
          <div className="space-y-4">
            {/* Main Image */}
            <div className="relative aspect-3/4 bg-val-steel overflow-hidden border border-white/10 rounded-lg">
              {selectedImage ? (
                <Image
                  src={selectedImage}
                  alt={product.name}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover"
                  priority
                />
              ) : (
                <div className="absolute inset-0 bg-linear-to-br from-gray-700 via-gray-800 to-gray-900" />
              )}

              {/* Badges */}
              <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
                {product.isNew && (
                  <Badge className="bg-val-accent text-white">New</Badge>
                )}
                {product.isOnSale && <Badge variant="destructive">Sale</Badge>}
              </div>

              {/* Wishlist & Share */}
              <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
                <WishlistButton
                  productId={product.id}
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
            {product.images && product.images.length > 1 && (
              <div className="grid grid-cols-4 gap-2">
                {product.images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(img)}
                    className={`relative aspect-square overflow-hidden rounded-md border-2 transition-all ${
                      selectedImage === img
                        ? "border-white"
                        : "border-transparent opacity-70 hover:opacity-100"
                    }`}
                  >
                    <Image
                      src={img}
                      alt={`${product.name} thumbnail ${i + 1}`}
                      fill
                      sizes="(max-width: 768px) 25vw, 12vw"
                      className="object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="py-4">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-4">
              {product.name}
            </h1>

            {/* Price */}
            <div className="flex items-center gap-3 mb-6">
              {product.salePrice ? (
                <>
                  <span className="text-2xl font-bold text-red-400">
                    ${product.salePrice.toFixed(2)}
                  </span>
                  <span className="text-lg text-gray-500 line-through">
                    ${product.price.toFixed(2)}
                  </span>
                  <Badge variant="destructive" className="ml-2">
                    {Math.round((1 - product.salePrice / product.price) * 100)}%
                    OFF
                  </Badge>
                </>
              ) : (
                <span className="text-2xl font-bold text-white">
                  ${product.price.toFixed(2)}
                </span>
              )}
            </div>

            {/* Description */}
            <p className="text-gray-400 mb-8 leading-relaxed">
              {product.description}
            </p>

            {/* Color Selection */}
            {product.colors && product.colors.length > 0 && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-white mb-3">
                  Color: {selectedColor}
                </label>
                <div className="flex gap-2">
                  {product.colors.map((color) => (
                    <button
                      key={color.name}
                      onClick={() => setSelectedColor(color.name)}
                      className={`w-10 h-10 rounded-full border-2 transition-all ${
                        selectedColor === color.name
                          ? "border-white scale-110"
                          : "border-transparent"
                      }`}
                      style={{ backgroundColor: color.hex }}
                      aria-label={color.name}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Size Selection */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-white">
                  Size: {selectedSize || "Select a size"}
                </label>
                <button className="text-sm text-val-accent hover:underline">
                  Size Guide
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {product.sizes.map((size) => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    className={`px-4 py-2 border rounded-md transition-all ${
                      selectedSize === size
                        ? "bg-white text-black border-white"
                        : "border-white/20 text-white hover:border-white"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Quantity */}
            <div className="mb-8">
              <label className="block text-sm font-medium text-white mb-3">
                Quantity
              </label>
              <div className="flex items-center gap-4">
                <div className="flex items-center border border-white/20 rounded-md">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="p-3 text-white hover:bg-white/10 transition-colors"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="px-4 text-white font-medium">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="p-3 text-white hover:bg-white/10 transition-colors"
                    aria-label="Increase quantity"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Add to Cart */}
            <div className="flex gap-4 mb-8">
              <Button
                onClick={handleAddToCart}
                className="flex-1 bg-white text-black hover:bg-val-silver py-6 text-lg font-medium"
                disabled={!product.inStock}
              >
                {product.inStock ? "Add to Cart" : "Out of Stock"}
              </Button>
            </div>

            {/* Trust Badges */}
            <div className="grid grid-cols-3 gap-4 pt-8 border-t border-white/10">
              <div className="text-center">
                <Truck className="h-6 w-6 mx-auto text-val-accent mb-2" />
                <p className="text-xs text-gray-400">Free Shipping</p>
              </div>
              <div className="text-center">
                <RefreshCw className="h-6 w-6 mx-auto text-val-accent mb-2" />
                <p className="text-xs text-gray-400">Easy Returns</p>
              </div>
              <div className="text-center">
                <Shield className="h-6 w-6 mx-auto text-val-accent mb-2" />
                <p className="text-xs text-gray-400">Secure Payment</p>
              </div>
            </div>

            {/* Product Details */}
            {product.details && product.details.length > 0 && (
              <div className="mt-8 pt-8 border-t border-white/10">
                <h3 className="text-lg font-medium text-white mb-4">
                  Product Details
                </h3>
                <ul className="space-y-2">
                  {product.details.map((detail, idx) => (
                    <li
                      key={idx}
                      className="text-gray-400 text-sm flex items-start"
                    >
                      <span className="mr-2">•</span>
                      {detail}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
