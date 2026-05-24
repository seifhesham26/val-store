"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type LocalVariant = {
  id: string;
  sku: string;
  size: string;
  color: string;
  stockQuantity: number;
  priceAdjustment: number;
  isNew?: boolean;
};

interface VariantsSectionProps {
  productId?: string;
  onVariantsChange?: (variants: Omit<LocalVariant, "id" | "isNew">[]) => void;
}

export function VariantsSection({
  productId,
  onVariantsChange,
}: VariantsSectionProps) {
  const [localAdditions, setLocalAdditions] = useState<LocalVariant[]>([]);
  const [editedVariants, setEditedVariants] = useState<
    Record<string, Partial<LocalVariant>>
  >({});

  const utils = trpc.useUtils();

  const { data: existingVariants, isLoading } =
    trpc.admin.variants.list.useQuery(
      { productId: productId! },
      { enabled: !!productId }
    );

  const addMutation = trpc.admin.variants.add.useMutation({
    onSuccess: () => {
      toast.success("Variant added");
      setLocalAdditions([]);
      utils.admin.variants.list.invalidate({ productId });
    },
    onError: (error) => toast.error(error.message),
  });

  const updateMutation = trpc.admin.variants.update.useMutation({
    onSuccess: (_, variables) => {
      toast.success("Variant updated");
      setEditedVariants((prev) => {
        const next = { ...prev };
        delete next[variables.id];
        return next;
      });
      utils.admin.variants.list.invalidate({ productId });
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteMutation = trpc.admin.variants.delete.useMutation({
    onSuccess: () => {
      toast.success("Variant deleted");
      utils.admin.variants.list.invalidate({ productId });
    },
    onError: (error) => toast.error(error.message),
  });

  // Derive combined variants from server + local
  const variants = useMemo(() => {
    const serverVariants: LocalVariant[] = (existingVariants ?? []).map(
      (v) => ({
        id: v.id,
        sku: editedVariants[v.id]?.sku ?? v.sku,
        size: editedVariants[v.id]?.size ?? v.size ?? "",
        color: editedVariants[v.id]?.color ?? v.color ?? "",
        stockQuantity: editedVariants[v.id]?.stockQuantity ?? v.stockQuantity,
        priceAdjustment:
          editedVariants[v.id]?.priceAdjustment ?? v.priceAdjustment,
        isNew: false,
      })
    );
    return [...serverVariants, ...localAdditions];
  }, [existingVariants, localAdditions, editedVariants]);

  // Notify parent when local additions change (for create form)
  const handleNotifyParent = useCallback(() => {
    if (onVariantsChange && !productId) {
      onVariantsChange(
        localAdditions.map(
          ({ sku, size, color, stockQuantity, priceAdjustment }) => ({
            sku,
            size,
            color,
            stockQuantity,
            priceAdjustment,
          })
        )
      );
    }
  }, [onVariantsChange, productId, localAdditions]);

  // Call parent callback when local additions change
  useEffect(() => {
    handleNotifyParent();
  }, [handleNotifyParent]);

  const addLocalVariant = () => {
    setLocalAdditions((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        sku: "",
        size: "",
        color: "",
        stockQuantity: 0,
        priceAdjustment: 0,
        isNew: true,
      },
    ]);
  };

  const updateLocalVariant = (
    id: string,
    field: keyof LocalVariant,
    value: string | number
  ) => {
    if (id.startsWith("new-")) {
      setLocalAdditions((prev) =>
        prev.map((v) => (v.id === id ? { ...v, [field]: value } : v))
      );
    } else {
      setEditedVariants((prev) => ({
        ...prev,
        [id]: { ...prev[id], [field]: value },
      }));
    }
  };

  const removeLocalVariant = (id: string) => {
    setLocalAdditions((prev) => prev.filter((v) => v.id !== id));
  };

  const saveVariant = async (variant: LocalVariant) => {
    if (!productId) return;

    if (variant.isNew) {
      await addMutation.mutateAsync({
        productId,
        sku: variant.sku,
        size: variant.size || undefined,
        color: variant.color || undefined,
        stockQuantity: variant.stockQuantity,
        priceAdjustment: variant.priceAdjustment,
      });
    } else {
      await updateMutation.mutateAsync({
        id: variant.id,
        data: {
          sku: variant.sku,
          size: variant.size || null,
          color: variant.color || null,
          stockQuantity: variant.stockQuantity,
          priceAdjustment: variant.priceAdjustment,
        },
      });
    }
  };

  const deleteVariant = async (id: string, isNew?: boolean) => {
    if (isNew || !productId) {
      removeLocalVariant(id);
    } else {
      await deleteMutation.mutateAsync({ id });
    }
  };

  if (productId && isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Product Variants</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Product Variants</CardTitle>
        <CardDescription>
          Add size and color combinations with stock levels
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {variants.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No variants yet. Add your first variant below.
          </p>
        ) : (
          variants.map((variant) => (
            <div
              key={variant.id}
              className="grid gap-4 p-4 border rounded-lg bg-muted/30"
            >
              <div className="grid gap-4 sm:grid-cols-5">
                <div className="space-y-2">
                  <Label>SKU *</Label>
                  <Input
                    placeholder="VAL-001-M-BLK"
                    value={variant.sku}
                    onChange={(e) =>
                      updateLocalVariant(variant.id, "sku", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Size</Label>
                  <Input
                    placeholder="M"
                    value={variant.size}
                    onChange={(e) =>
                      updateLocalVariant(variant.id, "size", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Color</Label>
                  <Input
                    placeholder="Black"
                    value={variant.color}
                    onChange={(e) =>
                      updateLocalVariant(variant.id, "color", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Stock</Label>
                  <Input
                    type="number"
                    min="0"
                    value={variant.stockQuantity}
                    onChange={(e) =>
                      updateLocalVariant(
                        variant.id,
                        "stockQuantity",
                        parseInt(e.target.value) || 0
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Price +/-</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={variant.priceAdjustment}
                    onChange={(e) =>
                      updateLocalVariant(
                        variant.id,
                        "priceAdjustment",
                        parseFloat(e.target.value) || 0
                      )
                    }
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                {productId && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => saveVariant(variant)}
                    disabled={addMutation.isPending || updateMutation.isPending}
                  >
                    {addMutation.isPending || updateMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : variant.isNew ? (
                      "Save"
                    ) : (
                      "Update"
                    )}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => deleteVariant(variant.id, variant.isNew)}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          ))
        )}
        <Button type="button" variant="outline" onClick={addLocalVariant}>
          <Plus className="h-4 w-4 mr-2" />
          Add Variant
        </Button>
      </CardContent>
    </Card>
  );
}
