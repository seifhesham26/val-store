"use client";

/**
 * Product Edit Form Component
 *
 * Client component for editing product details.
 * Uses react-hook-form with zod validation.
 */

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { AdditionalDetailsSection } from "@/components/admin/products/create/AdditionalDetailsSection";
import { ImageUploadSection } from "@/components/admin/products/create/ImageUploadSection";
import { VariantsSection } from "@/components/admin/products/create/VariantsSection";

// Validation schema
const productFormSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  slug: z.string().min(1, "Slug is required"),
  sku: z.string().min(1, "SKU is required"),
  description: z.string(),
  basePrice: z.number().positive("Price must be positive"),
  salePrice: z.number().positive().nullable(),
  isActive: z.boolean(),
  isFeatured: z.boolean(),
  gender: z.enum(["men", "women", "unisex", "kids"]),
  material: z.string(),
  careInstructions: z.string(),
  metaTitle: z.string(),
  metaDescription: z.string(),
});

type ProductFormValues = z.infer<typeof productFormSchema>;

interface ProductEditFormProps {
  productId: string;
}

export function ProductEditForm({ productId }: ProductEditFormProps) {
  const router = useRouter();
  const utils = trpc.useUtils();

  // Fetch product data
  const { data: product, isLoading } = trpc.admin.products.getById.useQuery({
    id: productId,
  });

  // Update mutation
  const updateMutation = trpc.admin.products.update.useMutation({
    onSuccess: () => {
      toast.success("Product updated successfully");
      utils.admin.products.list.invalidate();
      router.push("/admin/products");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update product");
    },
  });

  // Initialize form with fetched data
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: "",
      slug: "",
      sku: "",
      description: "",
      basePrice: 0,
      salePrice: null,
      isActive: true,
      isFeatured: false,
      gender: "unisex",
      material: "",
      careInstructions: "",
      metaTitle: "",
      metaDescription: "",
    },
    values: product
      ? {
          name: product.name,
          slug: product.slug,
          sku: product.sku,
          description: product.description || "",
          basePrice: product.basePrice,
          salePrice: product.salePrice,
          isActive: product.isActive,
          isFeatured: product.isFeatured,
          gender: product.gender ?? "unisex",
          material: product.material ?? "",
          careInstructions: product.careInstructions ?? "",
          metaTitle: product.metaTitle ?? "",
          metaDescription: product.metaDescription ?? "",
        }
      : undefined,
  });

  // Handle form submission
  const onSubmit = (values: ProductFormValues) => {
    updateMutation.mutate({
      id: productId,
      data: {
        ...values,
        // null (not undefined) so clearing the field actually removes the sale
        // price — the use case treats undefined as "leave unchanged".
        salePrice: values.salePrice ?? null,
        sku: values.sku.trim(),
        // Blank optional text fields are stored as null rather than "".
        material: values.material.trim() || null,
        careInstructions: values.careInstructions.trim() || null,
        metaTitle: values.metaTitle.trim() || null,
        metaDescription: values.metaDescription.trim() || null,
      },
    });
  };

  // Generate slug from name
  const generateSlug = () => {
    const name = form.getValues("name");
    if (name) {
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      form.setValue("slug", slug);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!product) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">Product not found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Essential product details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter product name"
                        {...field}
                        onBlur={() => {
                          field.onBlur();
                          if (!form.getValues("slug")) {
                            generateSlug();
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Slug{" "}
                      <span className="text-xs font-normal text-muted-foreground">
                        (URL-friendly identifier)
                      </span>
                    </FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input placeholder="product-slug" {...field} />
                      </FormControl>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={generateSlug}
                      >
                        Generate
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="sku"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    SKU{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      (warehouse identifier — unrelated to the slug)
                    </span>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="VLK-TSHIRT-001" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe your product..."
                      rows={5}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Pricing */}
        <Card>
          <CardHeader>
            <CardTitle>Pricing</CardTitle>
            <CardDescription>Set product prices</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="basePrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Base Price ($)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseFloat(e.target.value) || 0)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="salePrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Sale Price ($){" "}
                      <span className="text-xs font-normal text-muted-foreground">
                        (Optional)
                      </span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Leave empty for no sale"
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value ? parseFloat(e.target.value) : null
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Status */}
        <Card>
          <CardHeader>
            <CardTitle>Status & Visibility</CardTitle>
            <CardDescription>Control product visibility</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Active</FormLabel>
                    <FormDescription>
                      Product is visible on the storefront
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isFeatured"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Featured</FormLabel>
                    <FormDescription>
                      Show in featured products section
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Additional details + SEO */}
        <AdditionalDetailsSection />

        {/* Images */}
        <ImageUploadSection productId={productId} />

        {/* Variants */}
        <VariantsSection productId={productId} />

        {/* Actions */}
        <div className="flex gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/admin/products")}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Save Changes
          </Button>
        </div>
      </form>
    </Form>
  );
}
