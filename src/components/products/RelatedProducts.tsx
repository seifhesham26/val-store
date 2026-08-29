import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ProductCard,
  ProductCardProps,
} from "@/components/products/ProductCard";

interface RelatedProductsProps {
  products: ProductCardProps[];
  title?: string;
}

export function RelatedProducts({
  products,
  title = "You May Also Like",
}: RelatedProductsProps) {
  if (products.length === 0) return null;

  return (
    <section className="py-16 md:py-24 bg-black border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex items-end justify-between mb-10">
          <h2 className="text-2xl md:text-3xl font-bold text-white">{title}</h2>
          <Link href="/collections/all">
            <Button
              variant="outline"
              className="border-white/20 bg-transparent text-white hover:bg-white hover:text-black"
            >
              View All
            </Button>
          </Link>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {products.slice(0, 4).map((product) => (
            <ProductCard key={product.id} {...product} />
          ))}
        </div>
      </div>
    </section>
  );
}
