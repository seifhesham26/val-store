"use client";

/**
 * Create Product Form Component
 *
 * Unified form for creating new products with images and variants.
 * Uses react-hook-form with zod validation + tRPC mutation.
 * After creation, redirects to the edit page.
 */

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { trpc } from "@/lib/trpc";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Form } from "@/components/ui/form";
import { createProductSchema, type CreateProductValues } from "./create/schema";
import { BasicInfoSection } from "./create/BasicInfoSection";
import { PricingSection } from "./create/PricingSection";
import { SidebarActions } from "./create/SidebarActions";
import { ImageUploadSection } from "@/components/admin/create-product/ImageUploadSection";
import { VariantsSection } from "@/components/admin/create-product/VariantsSection";

type PendingImage = {
  imageUrl: string;
  altText?: string;
  isPrimary?: boolean;
};

type PendingVariant = {
  sku: string;
  size: string;
  color: string;
  stockQuantity: number;
  priceAdjustment: number;
};

export function CreateProductForm() {
  const router = useRouter();
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [pendingVariants, setPendingVariants] = useState<PendingVariant[]>([]);

  // Fetch categories for dropdown
  const { data: categories, isLoading: categoriesLoading } =
    trpc.admin.categories.list.useQuery({});

  // tRPC mutations
  const addImageMutation = trpc.admin.images.add.useMutation();
  const addVariantMutation = trpc.admin.variants.add.useMutation();

  // Create mutation — after product creation, save images and variants
  const createMutation = trpc.admin.products.create.useMutation({
    onSuccess: async (data) => {
      const productId = data.id;

      // Save pending images
      for (const img of pendingImages) {
        try {
          await addImageMutation.mutateAsync({
            productId,
            imageUrl: img.imageUrl,
            altText: img.altText || "",
            isPrimary: img.isPrimary ?? false,
          });
        } catch {
          toast.error("Failed to save an image");
        }
      }

      // Save pending variants
      for (const variant of pendingVariants) {
        try {
          await addVariantMutation.mutateAsync({
            productId,
            sku: variant.sku,
            size: variant.size || undefined,
            color: variant.color || undefined,
            stockQuantity: variant.stockQuantity,
            priceAdjustment: variant.priceAdjustment,
          });
        } catch {
          toast.error("Failed to save a variant");
        }
      }

      toast.success(data.message);
      router.push(`/admin/products/${productId}`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create product");
    },
  });

  // Initialize form
  const form = useForm<CreateProductValues>({
    resolver: zodResolver(createProductSchema),
    defaultValues: {
      name: "",
      slug: "",
      sku: "",
      description: "",
      categoryId: "",
      basePrice: 0,
      salePrice: undefined,
      isActive: true,
      isFeatured: false,
    },
  });

  const isSubmitting =
    createMutation.isPending ||
    addImageMutation.isPending ||
    addVariantMutation.isPending;

  // Handle form submission
  const onSubmit = (values: CreateProductValues) => {
    createMutation.mutate(values);
  };

  // Publish = submit with isActive: true
  const handlePublish = () => {
    form.setValue("isActive", true);
    form.handleSubmit(onSubmit)();
  };

  // Save as Draft = submit with isActive: false
  const handleSaveDraft = () => {
    form.setValue("isActive", false);
    form.handleSubmit(onSubmit)();
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

  // Auto-generate SKU from name
  const generateSKU = () => {
    const name = form.getValues("name");
    if (name) {
      const sku =
        "VAL-" +
        name
          .toUpperCase()
          .replace(/[^A-Z0-9]+/g, "-")
          .substring(0, 20);
      form.setValue("sku", sku);
    }
  };

  return (
    <Form {...form}>
      <form className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content - Left 2/3 */}
          <div className="lg:col-span-2 space-y-6">
            <BasicInfoSection
              form={form}
              categories={categories}
              categoriesLoading={categoriesLoading}
              generateSlug={generateSlug}
              generateSKU={generateSKU}
            />

            <PricingSection form={form} />

            <ImageUploadSection onImagesChange={setPendingImages} />

            <VariantsSection onVariantsChange={setPendingVariants} />
          </div>

          {/* Sidebar - Right 1/3 */}
          <SidebarActions
            form={form}
            isPending={isSubmitting}
            handlePublish={handlePublish}
            handleSaveDraft={handleSaveDraft}
          />
        </div>
      </form>
    </Form>
  );
}
