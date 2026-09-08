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
import { quantityInCart, remainingCapacity } from "@/lib/cart-stock-limit";
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

export function ProductDetail({ product }: ProductDetailProps) {
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(
    product.colors?.[0]?.name || null
  );
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState<string>(
    product.images?.[0] || ""
  );

  const { addItem, openCart, isAuthenticated, items } = useCart();

  // One shared, self-refreshing stock source. The server-rendered numbers below
  // are a 60s-cached snapshot; this keeps the ceiling current without a reload.
  const stock = useVariantStock(product.variants.map((v) => v.id));

  const hasSizes = product.sizes.length > 0;
  const hasColors = (product.colors?.length ?? 0) > 0;

  // Resolve the chosen size/colour back to the concrete variant row.
  const selectedVariant =
    product.variants.find(
      (v) =>
        (!hasSizes || v.size === selectedSize) &&
        (!hasColors || v.color === selectedColor)
    ) ?? null;

  // Raw availability for the chosen variant: the live cached figure when there
  // is one, otherwise the server-rendered snapshot. Null while no concrete
  // variant is resolved, so nothing is claimed before the customer has chosen.
  const variantStock = selectedVariant
    ? (stock.get(selectedVariant.id) ?? selectedVariant.availableStock)
    : null;

  // How many *more* may be added, which is not the same number: the server
  // enforces `already in cart + requested <= stock`, and until now the client
  // did not know that, so the stepper offered five with three already held.
  const inCartQuantity = selectedVariant
    ? quantityInCart(items, product.id, selectedVariant.id)
    : quantityInCart(items, product.id, null);

  const maxQuantity = selectedVariant
    ? remainingCapacity(variantStock, inCartQuantity)
    : null;

  // Only claim "out of stock" once we actually know which variant is meant.
  // Before a size is picked there is no resolved variant, and reporting that as
  // out of stock would tell the customer a perfectly available product is
  // unavailable. In that state the button stays enabled and the click handler
  // below explains what is missing.
  //
  // Read from raw stock, never from `maxQuantity`: a customer holding all five
  // of a five-stock item is at the ceiling, not looking at a sold-out product,
  // and the two deserve different words.
  const isSelectionInStock =
    product.variants.length === 0
      ? (product.inStock ?? false)
      : selectedVariant
        ? (variantStock ?? 0) > 0
        : true;

  /** In stock, but the cart already holds every unit that exists. */
  const atCeiling = isSelectionInStock && maxQuantity === 0;

  // Clamp on read rather than writing state during render: switching to a
  // lower-stock variant, or adding until the ceiling drops, must not leave a
  // quantity that cannot be fulfilled.
  const effectiveQuantity =
    maxQuantity !== null && maxQuantity > 0
      ? Math.min(quantity, maxQuantity)
      : quantity;

  const handleAddToCart = () => {
    if (hasSizes && !selectedSize) {
      toast.error("Please select a size");
      return;
    }

    if (product.variants.length > 0 && !selectedVariant) {
      toast.error("That combination is not available");
      return;
    }

    // Local, immediate, debounced. A failure surfaces from the provider as a
    // toast with a Retry action, carrying the server's own message — which is
    // why there is nothing to catch here and no dialog to open.
    addItem(product.id, effectiveQuantity, selectedVariant?.id ?? null, {
      productName: product.name,
      productPrice: product.salePrice ?? product.price,
      productImage: product.images?.[0] ?? null,
      variantLabel: selectedVariant
        ? [selectedVariant.size, selectedVariant.color]
            .filter(Boolean)
            .join(" / ")
        : null,
      maxStock: variantStock ?? effectiveQuantity,
    });

    // The product page keeps the auto-open: there is no burst-pressing problem
    // behind a full-width button, and the drawer is the confirmation.
    openCart();
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

            <ProductActions
              isAuthenticated={isAuthenticated}
              inStock={isSelectionInStock}
              atCeiling={atCeiling}
              inCartQuantity={inCartQuantity}
              onAddToCart={handleAddToCart}
              details={product.details}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
