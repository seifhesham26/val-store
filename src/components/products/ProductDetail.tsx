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
import {
  StockIssueDialog,
  type StockIssue,
} from "@/components/products/StockIssueDialog";
import { useVariantStock } from "@/hooks/use-variant-stock";

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
    variants: {
      id: string;
      size: string | null;
      color: string | null;
      inStock: boolean;
      availableStock: number;
    }[];
    isNew?: boolean;
    isOnSale?: boolean;
    inStock?: boolean;
  };
}

/**
 * Pull the remaining count out of the server's message ("Only 2 left in stock"),
 * so the dialog can offer to add what is actually available.
 */
function parseStockFromMessage(message: string): number | null {
  if (/out of stock/i.test(message)) return 0;
  const match = message.match(/only\s+(\d+)\s+left/i);
  return match ? Number(match[1]) : null;
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
  const [stockIssue, setStockIssue] = useState<StockIssue | null>(null);
  const { addItem, openCart, isAuthenticated } = useCart();

  // One shared, self-refreshing stock source. The server-rendered numbers below
  // are a 60s-cached snapshot; this keeps the ceiling current without a reload.
  const stock = useVariantStock(product.variants.map((v) => v.id));

  const hasSizes = product.sizes.length > 0;
  const hasColors = (product.colors?.length ?? 0) > 0;

  // Resolve the chosen size/colour back to the concrete variant row.
  const variantLabel = [selectedColor, selectedSize]
    .filter(Boolean)
    .join(" / ");

  const selectedVariant =
    product.variants.find(
      (v) =>
        (!hasSizes || v.size === selectedSize) &&
        (!hasColors || v.color === selectedColor)
    ) ?? null;

  // How many of the current selection can actually be ordered. Prefers the live
  // cached figure and falls back to the server-rendered snapshot. Null while no
  // concrete variant is resolved, so the stepper stays unconstrained until the
  // customer has actually chosen something.
  const maxQuantity = selectedVariant
    ? (stock.get(selectedVariant.id) ?? selectedVariant.availableStock)
    : null;

  // Only claim "out of stock" once we actually know which variant is meant.
  // Before a size is picked there is no resolved variant, and reporting that as
  // out of stock would tell the customer a perfectly available product is
  // unavailable. In that state the button stays enabled and the click handler
  // below explains what is missing.
  const isSelectionInStock =
    product.variants.length === 0
      ? (product.inStock ?? false)
      : selectedVariant
        ? (maxQuantity ?? 0) > 0
        : true;

  // Clamp on read rather than writing state during render: switching to a
  // lower-stock variant must not leave a quantity that cannot be fulfilled.
  const effectiveQuantity =
    maxQuantity !== null && maxQuantity > 0
      ? Math.min(quantity, maxQuantity)
      : quantity;

  const handleAddToCart = async () => {
    if (hasSizes && !selectedSize) {
      toast.error("Please select a size");
      return;
    }

    if (product.variants.length > 0 && !selectedVariant) {
      toast.error("That combination is not available");
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
      await addItem(product.id, effectiveQuantity, selectedVariant?.id ?? null);
      toast.success(`${product.name} added to cart`);
      openCart();
    } catch (error) {
      // The client already caps at the cached ceiling, so reaching here means
      // stock moved underneath us — worth a dialog rather than a toast, and
      // worth refreshing the cache so the page corrects itself.
      stock.refresh();
      const message = error instanceof Error ? error.message : "";
      const remaining = parseStockFromMessage(message);

      setStockIssue({
        productName: product.name,
        productImage: product.images?.[0] ?? null,
        variantLabel: variantLabel || null,
        requested: effectiveQuantity,
        available: remaining,
        message: message || undefined,
      });
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
              quantity={effectiveQuantity}
              onSelectColor={setSelectedColor}
              onSelectSize={setSelectedSize}
              onChangeQuantity={setQuantity}
              maxQuantity={maxQuantity}
            />

            <StockIssueDialog
              issue={stockIssue}
              onOpenChange={(open) => !open && setStockIssue(null)}
              onUseMax={(max) => setQuantity(max)}
            />

            <ProductActions
              isAuthenticated={isAuthenticated}
              isAdding={isAdding}
              inStock={isSelectionInStock}
              onAddToCart={handleAddToCart}
              details={product.details}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
