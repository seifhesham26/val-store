"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/components/providers/cart-provider";

import { ProductImageGallery } from "@/components/products/product-detail/ProductImageGallery";
import { ProductInfo } from "@/components/products/product-detail/ProductInfo";
import { ProductVariantSelector } from "@/components/products/product-detail/ProductVariantSelector";
import { ProductActions } from "@/components/products/product-detail/ProductActions";

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

  const [isAdding, setIsAdding] = useState(false);
  const { addItem, openCart, isAuthenticated } = useCart();

  const handleAddToCart = async () => {
    if (!selectedSize) {
      toast.error("Please select a size");
      return;
    }

    if (!isAuthenticated) {
      toast.info("Please sign in to add items to your cart", {
        action: {
          label: "Sign In",
          onClick: () => {
            window.location.href = `/login?redirect=${encodeURIComponent(
              window?.location?.pathname || "/"
            )}`;
          },
        },
      });
      return;
    }

    setIsAdding(true);
    try {
      await addItem(product.id, quantity);
      toast.success(`${product.name} added to cart`);
      openCart();
    } catch (error) {
      console.error("Failed to add to cart:", error);
      toast.error("Failed to add to cart. Please try again.");
    } finally {
      setIsAdding(false);
    }
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
          <ProductImageGallery
            productId={product.id}
            productName={product.name}
            images={product.images}
            selectedImage={selectedImage}
            onSelectImage={setSelectedImage}
            isNew={product.isNew}
            isOnSale={product.isOnSale}
          />

          {/* Product Info */}
          <div className="py-4">
            <ProductInfo
              name={product.name}
              price={product.price}
              salePrice={product.salePrice}
              description={product.description}
            />

            <ProductVariantSelector
              colors={product.colors}
              sizes={product.sizes}
              selectedColor={selectedColor}
              selectedSize={selectedSize}
              quantity={quantity}
              onSelectColor={setSelectedColor}
              onSelectSize={setSelectedSize}
              onChangeQuantity={setQuantity}
            />

            <ProductActions
              isAuthenticated={isAuthenticated}
              isAdding={isAdding}
              inStock={product.inStock}
              onAddToCart={handleAddToCart}
              details={product.details}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
