"use client";

/**
 * Dynamic Collection Page
 *
 * Handles any category slug from the database.
 * Fetches category details by slug and displays products using InfiniteProductGrid.
 */

import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { InfiniteProductGrid } from "@/components/products/InfiniteProductGrid";
import { Loader2 } from "lucide-react";
import Link from "next/link";

export default function DynamicCollectionPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const { data: category, isLoading } =
    trpc.public.categories.getBySlug.useQuery({ slug }, { enabled: !!slug });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (!category) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <h1 className="text-3xl font-bold text-white">Collection Not Found</h1>
        <p className="text-gray-400">
          The collection you&apos;re looking for doesn&apos;t exist.
        </p>
        <Link
          href="/collections"
          className="text-sm text-white underline underline-offset-4 hover:text-gray-300 transition-colors"
        >
          Browse all collections
        </Link>
      </div>
    );
  }

  return (
    <InfiniteProductGrid
      categoryId={category.id}
      title={category.name}
      description={category.description ?? undefined}
    />
  );
}
