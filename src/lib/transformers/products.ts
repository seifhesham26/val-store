import { getCachedProductBySlug, getCachedRelatedProducts } from "@/lib/cache";

type CachedProduct = NonNullable<
  Awaited<ReturnType<typeof getCachedProductBySlug>>
>;

export function transformProductForDetail(product: CachedProduct) {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    price: product.basePrice,
    salePrice: product.salePrice ?? undefined,
    description: product.description ?? "",
    details: product.careInstructions
      ? product.careInstructions.split("\n").filter(Boolean)
      : product.material
        ? [`Material: ${product.material}`]
        : [],
    sizes: [
      ...new Set(product.variants.map((v) => v.size).filter(Boolean)),
    ] as string[],
    colors: product.variants
      .filter((v) => v.color)
      .reduce(
        (acc, v) => {
          if (!acc.find((c) => c.name === v.color)) {
            acc.push({ name: v.color!, hex: "#000000" }); // Default hex
          }
          return acc;
        },
        [] as { name: string; hex: string }[]
      ),
    images: product.images.map((img) => img.imageUrl),
    // Kept so the page can resolve the chosen size/colour back to a real
    // variant id — without this the cart cannot record what was bought.
    variants: product.variants.map((v) => ({
      id: v.id,
      size: v.size,
      color: v.color,
      inStock: v.inStock,
      availableStock: v.availableStock,
    })),
    isOnSale:
      product.salePrice !== null && product.salePrice < product.basePrice,
    inStock: product.variants.some((v) => v.inStock),
  };
}

type CachedRelatedProducts = Awaited<
  ReturnType<typeof getCachedRelatedProducts>
>;

export function transformRelatedProducts(
  relatedProductsData: CachedRelatedProducts
) {
  return relatedProductsData.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    price: p.basePrice,
    salePrice: p.salePrice ?? undefined,
    primaryImage: p.primaryImage ?? undefined,
    variants: p.variants,
    isOnSale: p.salePrice !== null && p.salePrice < p.basePrice,
  }));
}
