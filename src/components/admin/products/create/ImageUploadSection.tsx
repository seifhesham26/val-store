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
import { useUploadThing } from "@/components/ui/upload";
import { CropDialog } from "./CropDialog";
import { Trash2, Star, Loader2, ImageIcon, Upload } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ProductImage } from "@/components/shared/ProductImage";

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

  const { startUpload, isUploading } = useUploadThing("productImage", {
    onClientUploadComplete: (res) =>
      handleUploadComplete(res.map((f) => ({ url: f.ufsUrl, name: f.name }))),
    onUploadError: (error) => {
      toast.error(`Upload failed: ${error.message}`);
    },
  });

  const [queue, setQueue] = useState<File[]>([]);
  const [ready, setReady] = useState<File[]>([]);

  // Files are reviewed one at a time; the head of the queue is what the
  // dialog is showing.
  const handleResolve = (result: File | null) => {
    const rest = queue.slice(1);
    const collected = result ? [...ready, result] : ready;
    setQueue(rest);
    if (rest.length === 0) {
      setReady([]);
      if (collected.length > 0) void startUpload(collected);
    } else {
      setReady(collected);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    // Reset the input so picking the same file twice in a row still fires
    // a change event.
    e.target.value = "";
    if (files.length > 0) setQueue(files);
  };

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
    if (productId) {
      // Independent inserts with no ordering between them, so they go down
      // the connection together rather than costing a round trip each.
      //
      // `isPrimary` is decided by index rather than by `images.length` read
      // inside the loop. That value does not change while the batch is being
      // written — it is the gallery as it stood before the upload — so the
      // sequential version marked *every* image of a batch primary whenever
      // the gallery started empty.
      await Promise.all(
        res.map((file, index) =>
          addMutation.mutateAsync({
            productId,
            imageUrl: file.url,
            altText: file.name,
            isPrimary: images.length === 0 && index === 0,
          })
        )
      );
    } else {
      setLocalImages((prev) => [
        ...prev,
        ...res.map((file, index) => ({
          id: `local-${Date.now()}-${prev.length + index}`,
          imageUrl: file.url,
          altText: file.name,
          isPrimary: prev.length + index === 0,
          displayOrder: prev.length + index,
          isLocal: true,
        })),
      ]);
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
                <ProductImage
                  src={image.imageUrl}
                  alt={image.altText || "Product image"}
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

        <div className="flex flex-col items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="bg-transparent"
            onClick={() =>
              document.getElementById("product-image-input")?.click()
            }
            disabled={isUploading}
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            {isUploading ? "Uploading..." : "Select images"}
          </Button>
          <p className="text-xs text-muted-foreground">
            PNG, JPG, WebP up to 4MB each. Each image is framed before upload.
          </p>
          <input
            id="product-image-input"
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>

        <CropDialog file={queue[0] ?? null} onResolve={handleResolve} />
      </CardContent>
    </Card>
  );
}
