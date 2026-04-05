"use client";

import { useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/products/ProductCard";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";

interface NewArrivalsProps {
  title?: string;
  subtitle?: string;
}

export function NewArrivals({
  title = "New Arrivals",
  subtitle = "Fresh drops just for you",
}: NewArrivalsProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const { data: products, isLoading } = trpc.public.products.list.useQuery(
    { limit: 8 },
    { staleTime: 1000 * 60 * 5 }
  );

  const items = products?.products ?? [];

  const scroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const scrollAmount = 300;
      scrollContainerRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  return (
    <section className="py-16 md:py-24 bg-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex items-end justify-between mb-10">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-2">
              {title}
            </h2>
            <p className="text-gray-400">{subtitle}</p>
          </div>

          {/* Navigation Arrows */}
          <div className="hidden md:flex gap-2">
            <button
              onClick={() => scroll("left")}
              className="p-2 rounded-full border border-white/20 text-white hover:bg-white hover:text-black transition-colors"
              aria-label="Scroll left"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => scroll("right")}
              className="p-2 rounded-full border border-white/20 text-white hover:bg-white hover:text-black transition-colors"
              aria-label="Scroll right"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Horizontal Scroll Container */}
        <div
          ref={scrollContainerRef}
          className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 scrollbar-hide"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="shrink-0 w-64 md:w-72 snap-start space-y-3"
                >
                  <Skeleton className="aspect-3/4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))
            : items.map((product) => (
                <div
                  key={product.id}
                  className="shrink-0 w-64 md:w-72 snap-start"
                >
                  <ProductCard
                    id={product.id}
                    name={product.name}
                    slug={product.slug}
                    price={product.basePrice}
                    salePrice={product.salePrice ?? undefined}
                    primaryImage={product.primaryImage ?? undefined}
                    isNew
                    isOnSale={
                      product.salePrice !== null &&
                      product.salePrice < product.basePrice
                    }
                    variants={product.variants}
                  />
                </div>
              ))}
        </div>

        {/* View All Button */}
        <div className="text-center mt-10">
          <Link href="/collections/new">
            <Button
              size="lg"
              className="bg-white text-black hover:bg-val-silver px-8 py-6 text-base font-medium tracking-wide"
            >
              View All New Arrivals
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
