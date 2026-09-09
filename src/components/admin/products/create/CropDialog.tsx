"use client";

import { useCallback, useEffect, useState } from "react";
import Cropper from "react-easy-crop";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  MAX_CROP_EDGE,
  resolveCropDraw,
  type CropArea,
} from "@/lib/image-crop";

interface CropDialogProps {
  file: File | null;
  onResolve: (file: File | null) => void;
}

export function CropDialog({ file, onResolve }: CropDialogProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<CropArea | null>(null);
  const [busy, setBusy] = useState(false);

  // An object URL is a live handle into the browser's blob store; leaking
  // one per upload holds the whole file in memory for the tab's lifetime.
  useEffect(() => {
    if (!file) {
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setArea(null);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const applyCrop = useCallback(async () => {
    if (!file || !objectUrl || !area) return;
    setBusy(true);
    try {
      onResolve(await cropToFile(file, objectUrl, area));
    } finally {
      setBusy(false);
    }
  }, [file, objectUrl, area, onResolve]);

  return (
    <Dialog open={!!file} onOpenChange={(open) => !open && onResolve(null)}>
      <DialogContent className="bg-background text-foreground sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Frame this image</DialogTitle>
          <DialogDescription>
            The storefront shows product photos in a 3:4 frame. Crop to fit it,
            or use the image as-is — an uncropped image is shown whole against a
            blurred backdrop, never cut off.
          </DialogDescription>
        </DialogHeader>

        <div className="relative h-80 w-full bg-muted">
          {objectUrl && (
            <Cropper
              image={objectUrl}
              crop={crop}
              zoom={zoom}
              aspect={3 / 4}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_, pixels) => setArea(pixels)}
            />
          )}
        </div>

        <Slider
          value={[zoom]}
          min={1}
          max={3}
          step={0.01}
          onValueChange={([z]) => setZoom(z)}
          aria-label="Zoom"
        />

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onResolve(null)}
            disabled={busy}
          >
            Skip this image
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="bg-transparent"
              onClick={() => file && onResolve(file)}
              disabled={busy}
            >
              Use as-is
            </Button>
            <Button type="button" onClick={applyCrop} disabled={busy || !area}>
              Apply crop
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

async function cropToFile(
  file: File,
  objectUrl: string,
  area: CropArea
): Promise<File> {
  const img = await loadImage(objectUrl);
  const draw = resolveCropDraw(
    { width: img.naturalWidth, height: img.naturalHeight },
    area,
    MAX_CROP_EDGE
  );

  const canvas = document.createElement("canvas");
  canvas.width = draw.canvas.width;
  canvas.height = draw.canvas.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get a 2D canvas context");

  ctx.drawImage(
    img,
    draw.source.x,
    draw.source.y,
    draw.source.width,
    draw.source.height,
    0,
    0,
    draw.canvas.width,
    draw.canvas.height
  );

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.9)
  );
  if (!blob) throw new Error("Could not encode the cropped image");

  const name = file.name.replace(/\.[^.]+$/, "") + ".webp";
  return new File([blob], name, { type: "image/webp" });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read the image"));
    img.src = src;
  });
}
