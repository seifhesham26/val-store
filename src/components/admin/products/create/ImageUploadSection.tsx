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
import { UploadDropzone } from "@/components/ui/upload";
import { Trash2, Star, Loader2, ImageIcon } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import Image from "next/image";

type LocalImage = {
  id: string;
  imageUrl: string;
  altText: string | null;
  isPrimary: boolean;
  displayOrder: number;
  isLocal?: boolean;
};

interface ImageUploadSectionProps {
  productId?: string;
  onImagesChange?: (
    images: { imageUrl: string; altText?: string; isPrimary?: boolean }[]
  ) => void;
}

export function ImageUploadSection({
  productId,
  onImagesChange,
}: ImageUploadSectionProps) {
  const [localImages, setLocalImages] = useState<LocalImage[]>([]);
  const utils = trpc.useUtils();

  const { data: existingImages, isLoading } = trpc.admin.images.list.useQuery(
    { productId: productId! },
    { enabled: !!productId }
  );

  const addMutation = trpc.admin.images.add.useMutation({
    onSuccess: () => {
      toast.success("Image added");
      utils.admin.images.list.invalidate({ productId });
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteMutation = trpc.admin.images.delete.useMutation({
    onSuccess: () => {
      toast.success("Image deleted");
      utils.admin.images.list.invalidate({ productId });
    },
    onError: (error) => toast.error(error.message),
  });

  const setPrimaryMutation = trpc.admin.images.setPrimary.useMutation({
    onSuccess: () => {
      toast.success("Primary image updated");
      utils.admin.images.list.invalidate({ productId });
    },
    onError: (error) => toast.error(error.message),
  });

  // Combine server images with local additions
  const images = useMemo(() => {
    const serverImages: LocalImage[] = (existingImages ?? []).map((img) => ({
      id: img.id,
      imageUrl: img.imageUrl,
      altText: img.altText,
      isPrimary: img.isPrimary,
      displayOrder: img.displayOrder,
      isLocal: false,
    }));
    return [...serverImages, ...localImages];
  }, [existingImages, localImages]);

  // Notify parent when local images change
  const handleNotifyParent = useCallback(() => {
    if (onImagesChange && !productId) {
      onImagesChange(
        localImages.map(({ imageUrl, altText, isPrimary }) => ({
          imageUrl,
          altText: altText ?? undefined,
          isPrimary,
        }))
      );
    }
  }, [onImagesChange, productId, localImages]);

  useEffect(() => {
    handleNotifyParent();
  }, [handleNotifyParent]);

  const handleUploadComplete = async (res: { url: string; name: string }[]) => {
    for (const file of res) {
      if (productId) {
        await addMutation.mutateAsync({
          productId,
          imageUrl: file.url,
          altText: file.name,
          isPrimary: images.length === 0,
        });
      } else {
        setLocalImages((prev) => [
          ...prev,
          {
            id: `local-${Date.now()}-${prev.length}`,
            imageUrl: file.url,
            altText: file.name,
            isPrimary: prev.length === 0,
            displayOrder: prev.length,
            isLocal: true,
          },
        ]);
      }
    }
    toast.success(`${res.length} image(s) uploaded`);
  };

  const deleteImage = async (id: string) => {
    if (id.startsWith("local-") || !productId) {
      setLocalImages((prev) => prev.filter((img) => img.id !== id));
    } else {
      await deleteMutation.mutateAsync({ id });
    }
  };

  const setPrimaryImage = async (imageId: string) => {
    if (imageId.startsWith("local-") || !productId) {
      setLocalImages((prev) =>
        prev.map((img) => ({ ...img, isPrimary: img.id === imageId }))
      );
    } else {
      await setPrimaryMutation.mutateAsync({ productId: productId!, imageId });
    }
  };

  if (productId && isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Product Images</CardTitle>
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
        <CardTitle>Product Images</CardTitle>
        <CardDescription>
          Upload product photos. First image becomes the primary image.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {images.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {images.map((image) => (
              <div
                key={image.id}
                className="relative group aspect-square rounded-lg overflow-hidden border bg-muted"
              >
                <Image
                  src={image.imageUrl}
                  alt={image.altText || "Product image"}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 50vw, 25vw"
                />
                {image.isPrimary && (
                  <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full flex items-center gap-1">
                    <Star className="h-3 w-3 fill-current" />
                    Primary
                  </div>
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  {!image.isPrimary && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setPrimaryImage(image.id)}
                      disabled={setPrimaryMutation.isPending}
                    >
                      <Star className="h-4 w-4 mr-1" />
                      Set Primary
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteImage(image.id)}
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
            ))}
          </div>
        )}

        {images.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <ImageIcon className="h-12 w-12 mb-2" />
            <p>No images uploaded yet</p>
          </div>
        )}

        <UploadDropzone
          endpoint="productImage"
          onClientUploadComplete={handleUploadComplete}
          onUploadError={(error: Error) => {
            toast.error(`Upload failed: ${error.message}`);
          }}
          className="border-dashed"
        />
      </CardContent>
    </Card>
  );
}
