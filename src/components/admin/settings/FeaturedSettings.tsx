"use client";

/**
 * Featured Settings
 *
 * Curates the homepage's featured products and category cards. Everything here
 * writes to `featured_items`, which the homepage now actually reads — when a
 * section is empty it falls back to `products.isFeatured` and the first active
 * categories, so clearing a list is a safe thing to do.
 */

import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowDown, ArrowUp, Loader2, Plus, Search, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface FeaturedItem {
  id: string;
  itemId: string;
  displayOrder: number;
}

const PRODUCTS_SECTION = "homepage_featured";
const CATEGORIES_SECTION = "homepage_categories";

export function FeaturedSettings() {
  const utils = trpc.useUtils();

  const { data: featuredProducts, isLoading: productsLoading } =
    trpc.admin.settings.getFeaturedItems.useQuery({
      section: PRODUCTS_SECTION,
    });

  const { data: featuredCategories, isLoading: categoriesLoading } =
    trpc.admin.settings.getFeaturedItems.useQuery({
      section: CATEGORIES_SECTION,
    });

  // Names, so a curated row shows what it is rather than a UUID fragment.
  const { data: productPage } = trpc.admin.products.list.useQuery({
    limit: 100,
  });
  const { data: categoryList } = trpc.admin.categories.list.useQuery({});

  const productNames = useMemo(
    () => new Map((productPage?.products ?? []).map((p) => [p.id, p.name])),
    [productPage]
  );
  const categoryNames = useMemo(
    () => new Map((categoryList?.categories ?? []).map((c) => [c.id, c.name])),
    [categoryList]
  );

  const refresh = () => {
    utils.admin.settings.getFeaturedItems.invalidate();
  };

  const addFeatured = trpc.admin.settings.addFeaturedItem.useMutation({
    onSuccess: () => {
      toast.success("Added to the homepage");
      refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  const removeFeatured = trpc.admin.settings.removeFeaturedItem.useMutation({
    onSuccess: () => {
      toast.success("Removed from the homepage");
      refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  const reorderFeatured = trpc.admin.settings.reorderFeaturedItems.useMutation({
    onSuccess: refresh,
    onError: (err) => toast.error(err.message),
  });

  if (productsLoading || categoriesLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <FeaturedList
        title="Featured Products"
        description="Shown in the Best Sellers section on the homepage."
        emptyHint="Nothing curated — the homepage is falling back to products marked Featured on their own edit page."
        itemType="product"
        items={featuredProducts ?? []}
        names={productNames}
        candidates={(productPage?.products ?? []).map((p) => ({
          id: p.id,
          name: p.name,
        }))}
        onAdd={(itemId, displayOrder) =>
          addFeatured.mutate({
            itemType: "product",
            itemId,
            section: PRODUCTS_SECTION,
            displayOrder,
          })
        }
        onRemove={(id) => removeFeatured.mutate({ id })}
        onReorder={(orderedIds) =>
          reorderFeatured.mutate({ section: PRODUCTS_SECTION, orderedIds })
        }
        isPending={addFeatured.isPending || reorderFeatured.isPending}
      />

      <FeaturedList
        title="Featured Categories"
        description="The category cards on the homepage. Three fit the grid."
        emptyHint="Nothing curated — the homepage is falling back to the first active categories by display order."
        itemType="category"
        items={featuredCategories ?? []}
        names={categoryNames}
        candidates={(categoryList?.categories ?? []).map((c) => ({
          id: c.id,
          name: c.name,
        }))}
        onAdd={(itemId, displayOrder) =>
          addFeatured.mutate({
            itemType: "category",
            itemId,
            section: CATEGORIES_SECTION,
            displayOrder,
          })
        }
        onRemove={(id) => removeFeatured.mutate({ id })}
        onReorder={(orderedIds) =>
          reorderFeatured.mutate({ section: CATEGORIES_SECTION, orderedIds })
        }
        isPending={addFeatured.isPending || reorderFeatured.isPending}
      />
    </div>
  );
}

interface FeaturedListProps {
  title: string;
  description: string;
  emptyHint: string;
  itemType: "product" | "category";
  items: FeaturedItem[];
  names: Map<string, string>;
  candidates: { id: string; name: string }[];
  onAdd: (itemId: string, displayOrder: number) => void;
  onRemove: (id: string) => void;
  onReorder: (orderedIds: string[]) => void;
  isPending: boolean;
}

function FeaturedList({
  title,
  description,
  emptyHint,
  itemType,
  items,
  names,
  candidates,
  onAdd,
  onRemove,
  onReorder,
  isPending,
}: FeaturedListProps) {
  const [search, setSearch] = useState("");

  const ordered = [...items].sort((a, b) => a.displayOrder - b.displayOrder);
  const chosen = new Set(ordered.map((item) => item.itemId));

  const query = search.trim().toLowerCase();
  const matches = query
    ? candidates
        .filter(
          (candidate) =>
            !chosen.has(candidate.id) &&
            candidate.name.toLowerCase().includes(query)
        )
        .slice(0, 6)
    : [];

  /** Swap a row with its neighbour, then send the whole order back. */
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= ordered.length) return;

    const next = [...ordered];
    [next[index], next[target]] = [next[target], next[index]];
    onReorder(next.map((item) => item.id));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={"Search " + itemType + "s to add..."}
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {matches.length > 0 && (
          <div className="mb-4 space-y-1 rounded-lg border p-2">
            {matches.map((candidate) => (
              <div
                key={candidate.id}
                className="flex items-center justify-between gap-3 rounded px-2 py-1.5 hover:bg-accent/50"
              >
                <span className="text-sm">{candidate.name}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={isPending}
                  onClick={() => {
                    onAdd(candidate.id, ordered.length);
                    setSearch("");
                  }}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Add
                </Button>
              </div>
            ))}
          </div>
        )}

        {query && matches.length === 0 && (
          <p className="mb-4 px-2 text-sm text-muted-foreground">
            No matches — or everything matching is already on the list.
          </p>
        )}

        {ordered.length > 0 ? (
          <div className="space-y-2">
            {ordered.map((item, index) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-accent/50"
              >
                <div className="flex flex-col">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-6"
                    disabled={index === 0 || isPending}
                    onClick={() => move(index, -1)}
                    aria-label="Move up"
                  >
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-6"
                    disabled={index === ordered.length - 1 || isPending}
                    onClick={() => move(index, 1)}
                    aria-label="Move down"
                  >
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                </div>
                <div className="flex-1">
                  <p className="font-medium">
                    {/* An id with no name is one whose row has since been
                        deleted. The homepage skips it; say so here too. */}
                    {names.get(item.itemId) ?? (
                      <span className="text-destructive">
                        Deleted {itemType}
                      </span>
                    )}
                  </p>
                </div>
                <Badge variant="outline">#{index + 1}</Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => onRemove(item.id)}
                  aria-label="Remove"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed py-8 text-center text-muted-foreground">
            <p>Nothing curated yet</p>
            <p className="mx-auto mt-1 max-w-md text-sm">{emptyHint}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
