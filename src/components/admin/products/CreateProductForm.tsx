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
import { AdditionalDetailsSection } from "./create/AdditionalDetailsSection";
import { BasicInfoSection } from "./create/BasicInfoSection";
import { PricingSection } from "./create/PricingSection";
import { SidebarActions } from "./create/SidebarActions";
import { ImageUploadSection } from "@/components/admin/products/create/ImageUploadSection";
import { VariantsSection } from "@/components/admin/products/create/VariantsSection";

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

  // One mutation, one transaction. Images and variants travel with the product
  // rather than being saved afterwards in a loop, so a failure leaves nothing
  // behind instead of a half-built product the admin has to go and find.
  const createMutation = trpc.admin.products.create.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      router.push(`/admin/products/${data.id}`);
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
      gender: "unisex",
      material: "",
      careInstructions: "",
      metaTitle: "",
      metaDescription: "",
    },
  });

  const isSubmitting = createMutation.isPending;

  // Handle form submission
  const onSubmit = (values: CreateProductValues) => {
    createMutation.mutate({
      ...values,
      // Trimmed like every other identifier: a trailing space here is invisible
      // in the field and would make the SKU miss its own uniqueness check.
      sku: values.sku.trim(),
      // Blank optional text fields are stored as null rather than "".
      material: values.material.trim() || null,
      careInstructions: values.careInstructions.trim() || null,
      metaTitle: values.metaTitle.trim() || null,
      metaDescription: values.metaDescription.trim() || null,
      images: pendingImages.map((image) => ({
        imageUrl: image.imageUrl,
        altText: image.altText?.trim() || null,
        isPrimary: image.isPrimary ?? false,
      })),
      // Blank size/colour mean "this variant has no such axis", not "".
      variants: pendingVariants.map((variant) => ({
        sku: variant.sku.trim(),
        size: variant.size.trim() || null,
        color: variant.color.trim() || null,
        stockQuantity: variant.stockQuantity,
        priceAdjustment: variant.priceAdjustment,
      })),
    });
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

            <AdditionalDetailsSection />

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
