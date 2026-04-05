"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ProductCard } from "@/components/products/ProductCard";

const PREVIEW_LIMIT = 4;

export function CollectionSection({
  title,
  description,
  href,
  queryParams,
}: {
  title: string;
  description: string;
  href: string;
  queryParams: { gender?: string; isFeatured?: boolean; isOnSale?: boolean };
}) {
  const { data, isLoading } = trpc.public.products.list.useQuery({
    limit: PREVIEW_LIMIT,
    ...queryParams,
  });

  const products = data?.products ?? [];

  return (
    <section>
      {/* Section Header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <h2 className="text-xl md:text-2xl font-semibold text-white">
            {title}
          </h2>
          <p className="text-gray-400 text-sm mt-1">{description}</p>
        </div>
        <Link
          href={href}
          className="group flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors shrink-0"
        >
          View All
          <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      {/* Products Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {[...Array(PREVIEW_LIMIT)].map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="aspect-3/4 bg-white/8 rounded-lg animate-pulse" />
              <div className="h-4 w-3/4 bg-white/8 rounded animate-pulse" />
              <div className="h-4 w-1/4 bg-white/8 rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : products.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              id={product.id}
              name={product.name}
              slug={product.slug}
              price={product.basePrice}
              salePrice={product.salePrice ?? undefined}
              primaryImage={product.primaryImage ?? undefined}
              isOnSale={
                product.salePrice !== null &&
                product.salePrice < product.basePrice
              }
              isFeatured={product.isFeatured}
              variants={product.variants}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-white/3 py-12 text-center">
          <p className="text-gray-500 text-sm">
            No products in this collection yet.
          </p>
        </div>
      )}
    </section>
  );
}
