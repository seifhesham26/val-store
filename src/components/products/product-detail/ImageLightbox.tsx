"use client";

import * as React from "react";
import Image from "next/image";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { unoptimizedFor } from "@/lib/image-hosts";

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
/** Zoom level a tap toggles to when zooming in from 1x. */
const TAP_ZOOM = 2;
/** Pointer travel (px) beyond which a press-and-release counts as a drag, not a tap. */
const MOVE_THRESHOLD_PX = 5;
/** Wheel sensitivity as a multiplier per pixel of deltaY. */
const WHEEL_ZOOM_FACTOR = 0.0015;

interface ImageLightboxProps {
  src: string | null;
  alt: string;
  onClose: () => void;
}

/**
 * Full-screen zoom view for a product photo.
 *
 * The content is a Radix portal attached to `<body>`, so it escapes every
 * theme wrapper — it sets both halves of its colour pair explicitly
 * (`bg-black/95 text-white`) rather than a background alone. That is the
 * recurring white-on-white bug this codebase keeps shipping.
 *
 * The photo is shown whole on a deliberate black field, not through
 * `ProductImage`: the blurred letterbox backdrop would be pure noise here.
 *
 * Touch zooming is tap-to-toggle, not pinch, by deliberate choice: the image
 * carries `touch-none`, which disables the browser's own pinch gesture, and
 * a tap covers the real need (get closer to a detail) without two-pointer
 * gesture maths. Tapping zooms to 2x centred on the tapped point; tapping
 * again returns to 1x.
 */
export function ImageLightbox({ src, alt, onClose }: ImageLightboxProps) {
  const [zoom, setZoom] = React.useState(MIN_ZOOM);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const dragStart = React.useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
    moved: boolean;
  } | null>(null);

  // A newly opened image starts fresh, not at whatever the last one was.
  React.useEffect(() => {
    if (src !== null) {
      setZoom(MIN_ZOOM);
      setPan({ x: 0, y: 0 });
      dragStart.current = null;
    }
  }, [src]);

  const handleWheel = (e: React.WheelEvent) => {
    const next = Math.min(
      MAX_ZOOM,
      Math.max(MIN_ZOOM, zoom * Math.exp(-e.deltaY * WHEEL_ZOOM_FACTOR))
    );
    setZoom(next);
    if (next === MIN_ZOOM) {
      setPan({ x: 0, y: 0 });
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Recorded at every zoom level, even 1x where drag-pan is disabled: the
    // pointer-up handler needs it to tell a tap from the end of a drag.
    dragStart.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      baseX: pan.x,
      baseY: pan.y,
      moved: false,
    };
    if (zoom <= MIN_ZOOM) return;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragStart.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    if (
      Math.abs(e.clientX - drag.startX) > MOVE_THRESHOLD_PX ||
      Math.abs(e.clientY - drag.startY) > MOVE_THRESHOLD_PX
    ) {
      drag.moved = true;
    }
    // Panning stays gated on being zoomed in; the move tracking above runs
    // anyway so a 1x drag still suppresses the tap.
    if (zoom <= MIN_ZOOM) return;
    setPan({
      x: drag.baseX + (e.clientX - drag.startX),
      y: drag.baseY + (e.clientY - drag.startY),
    });
  };

  const handlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragStart.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragStart.current = null;
    if (drag.moved) return;
    toggleZoomAt(e.currentTarget, e.clientX, e.clientY);
  };

  /**
   * Toggle between 1x and TAP_ZOOM, keeping the tapped point where it is.
   *
   * The transform is `translate(pan) scale(zoom)`, so pan is applied in
   * pre-scale pixels: the point at offset `d` from the container centre sits
   * at `d + pan` before the tap and at `zoom * d + pan` after. Solving for
   * the tapped point to land on the centre (`0`) gives
   * `pan = -zoom * d` — clamped only by MAX_ZOOM, matching how wheel zoom
   * leaves pan untouched.
   */
  const toggleZoomAt = (
    container: HTMLDivElement,
    clientX: number,
    clientY: number
  ) => {
    if (zoom <= MIN_ZOOM) {
      const rect = container.getBoundingClientRect();
      const offsetX = clientX - (rect.left + rect.width / 2);
      const offsetY = clientY - (rect.top + rect.height / 2);
      setZoom(TAP_ZOOM);
      setPan({
        x: -TAP_ZOOM * offsetX,
        y: -TAP_ZOOM * offsetY,
      });
    } else {
      setZoom(MIN_ZOOM);
      setPan({ x: 0, y: 0 });
    }
  };

  return (
    <Dialog
      open={src !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-none w-screen h-screen bg-black/95 text-white border-0 p-0">
        <DialogTitle className="sr-only">{alt}</DialogTitle>
        <div
          className="relative h-full w-full overflow-hidden"
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
        >
          {src !== null && (
            <Image
              src={src}
              alt={alt}
              fill
              sizes="100vw"
              quality={100}
              unoptimized={unoptimizedFor(src)}
              draggable={false}
              className="touch-none select-none object-contain"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                cursor: zoom > MIN_ZOOM ? "grab" : "default",
              }}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
