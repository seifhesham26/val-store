"use client";

import { useCallback, useMemo, useImperativeHandle, forwardRef } from "react";
import { trpc } from "@/lib/trpc";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreVertical,
  Edit,
  Trash2,
  Loader2,
  Eye,
  EyeOff,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import Image from "next/image";
import type { ProductFilters } from "./ProductsListHeader";

const ITEMS_PER_PAGE = 10;

export interface ProductsTableHandle {
  getProducts: () => Array<{
    id: string;
    name: string;
    slug: string;
    basePrice: number;
    currentPrice: number;
    stock: number;
    isActive: boolean;
    isFeatured: boolean;
    isOnSale: boolean;
    discountPercentage: number;
    primaryImage: string | null;
  }>;
}

interface ProductsTableProps {
  filters: ProductFilters;
  search: string;
}

export const ProductsTable = forwardRef<
  ProductsTableHandle,
  ProductsTableProps
>(function ProductsTable({ filters, search }, ref) {
  const utils = trpc.useUtils();

  // Build query input from filters
  const queryInput = useMemo(
    () => ({
      limit: ITEMS_PER_PAGE,
      ...(filters.isActive !== undefined && { isActive: filters.isActive }),
      ...(filters.categoryId && { categoryId: filters.categoryId }),
    }),
    [filters]
  );

  // Use infinite query for infinite scroll
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    trpc.admin.products.list.useInfiniteQuery(queryInput, {
      getNextPageParam: (lastPage) => {
        if (lastPage.page < lastPage.totalPages) {
          return lastPage.page + 1;
        }
        return undefined;
      },
      initialCursor: 1,
    });

  // Flatten all pages into a single products array
  const allProducts = useMemo(
    () => data?.pages.flatMap((page) => page.products) || [],
    [data]
  );
  const total = data?.pages[0]?.total || 0;

  // Apply client-side search filter
  const products = useMemo(() => {
    if (!search.trim()) return allProducts;
    const q = search.toLowerCase();
    return allProducts.filter((p) => p.name.toLowerCase().includes(q));
  }, [allProducts, search]);

  // Expose products for CSV export
  useImperativeHandle(ref, () => ({
    getProducts: () => products,
  }));

  // Infinite scroll hook
  const { ref: sentinelRef } = useInfiniteScroll({
    onLoadMore: () => fetchNextPage(),
    enabled: hasNextPage && !isFetchingNextPage,
  });

  // Delete mutation
  const deleteMutation = trpc.admin.products.delete.useMutation({
    onSuccess: () => {
      toast.success("Product deleted successfully");
      utils.admin.products.list.invalidate();
    },
    onError: () => {
      toast.error("Failed to delete product");
    },
  });

  // Toggle status mutation
  const toggleMutation = trpc.admin.products.toggleStatus.useMutation({
    onSuccess: (_, variables) => {
      const product = products.find((p) => p.id === variables.id);
      toast.success(
        product?.isActive
          ? "Product hidden from storefront"
          : "Product visible on storefront"
      );
      utils.admin.products.list.invalidate();
    },
    onError: () => {
      toast.error("Failed to update product status");
    },
  });

  const handleDelete = useCallback(
    (id: string) => {
      if (confirm("Are you sure you want to delete this product?")) {
        deleteMutation.mutate({ id });
      }
    },
    [deleteMutation]
  );

  if (isLoading) {
    return (
      <div className="rounded-md border p-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Products count */}
      <p className="text-sm text-muted-foreground">
        Showing {products.length} of {total} products
        {search.trim() && ` (filtered by "${search}")`}
      </p>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">Image</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Base Price</TableHead>
              <TableHead>Current Price</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[70px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products && products.length > 0 ? (
              products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    {product.primaryImage ? (
                      <Image
                        src={product.primaryImage}
                        alt={product.name}
                        width={48}
                        height={48}
                        className="h-12 w-12 rounded-md object-cover"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-md bg-muted" />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>Uncategorized</TableCell>
                  <TableCell>${product.basePrice.toFixed(2)}</TableCell>
                  <TableCell>
                    ${product.currentPrice.toFixed(2)}
                    {product.isOnSale && (
                      <span className="ml-2 text-xs text-destructive">
                        -{product.discountPercentage}%
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span
                      className={
                        product.stock < 10
                          ? "text-destructive font-medium"
                          : "text-foreground"
                      }
                    >
                      {product.stock}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleMutation.mutate({ id: product.id })}
                      disabled={toggleMutation.isPending}
                    >
                      <Badge
                        variant={product.isActive ? "default" : "secondary"}
                      >
                        {product.isActive ? "Active" : "Hidden"}
                      </Badge>
                    </Button>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link
                            href={`/products/${product.slug}`}
                            target="_blank"
                          >
                            <ExternalLink className="mr-2 h-4 w-4" />
                            View on Store
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/admin/products/${product.id}`}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            toggleMutation.mutate({ id: product.id })
                          }
                          disabled={toggleMutation.isPending}
                        >
                          {product.isActive ? (
                            <>
                              <EyeOff className="mr-2 h-4 w-4" />
                              Hide from Store
                            </>
                          ) : (
                            <>
                              <Eye className="mr-2 h-4 w-4" />
                              Show on Store
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDelete(product.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <p className="text-muted-foreground">No products found</p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Infinite scroll sentinel + loading indicator */}
      {hasNextPage && (
        <div
          ref={sentinelRef}
          className="flex items-center justify-center py-4"
        >
          {isFetchingNextPage ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : (
            <span className="text-sm text-muted-foreground">
              Scroll for more...
            </span>
          )}
        </div>
      )}

      {/* End of list indicator */}
      {!hasNextPage && products.length > 0 && (
        <p className="text-center text-sm text-muted-foreground py-4">
          You&apos;ve reached the end of the list
        </p>
      )}
    </div>
  );
});
